/**
 * Background course generation logic.
 * Runs sequentially through all chapter_lessons, generating outline + lesson for each.
 */
import Anthropic from '@anthropic-ai/sdk'
import { extractJSON } from './extract-json'
import { db } from '@/db'
import { courses, chapterLessons, lessons } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { DEFAULT_MODEL } from '@/lib/models'
import { sendEmail } from '@/lib/email'
import { courseCompleteEmail } from '@/lib/email-templates'
import { BLOCK_SCHEMAS, PASSIVE_LESSON_OVERRIDE, INFORMATIONAL_TYPES } from '@/lib/block-schemas'
import type { LessonManifest } from '@primr/components'
import type { LessonOutline } from '@/types/outline'

const client = new Anthropic()

// ── Cancellation registry ─────────────────────────────────────────────────────

// One AbortController per active course generation run.
const courseControllers = new Map<string, AbortController>()

// One AbortController per lesson currently being generated (replaced each iteration).
// Aborting a lesson controller cancels the current API calls but lets the loop continue.
const lessonControllers = new Map<string, AbortController>()

export function cancelCourseGeneration(courseId: string) {
  const ctrl = courseControllers.get(courseId)
  if (ctrl) {
    ctrl.abort()
    courseControllers.delete(courseId)
  }
}

export function cancelLessonGeneration(chapterLessonId: string) {
  const ctrl = lessonControllers.get(chapterLessonId)
  if (ctrl) {
    ctrl.abort()
    lessonControllers.delete(chapterLessonId)
  }
}

// ── Outline generation ────────────────────────────────────────────────────────

const OUTLINE_SYSTEM_PROMPT = `You are an expert instructional designer. Given a lesson title, topic description, target audience, and level, generate a lesson outline as JSON.

Return this exact structure:
{
  "title": "string",
  "slug": "kebab-case-slug",
  "audience": "string (echo back)",
  "level": "beginner|intermediate|advanced (echo back)",
  "blocks": [
    {
      "id": "unique-kebab-id",
      "type": "hero|narrative|step-navigator|media|quiz|flashcard|fill-in-the-blank",
      "summary": "1-2 sentence description of what this block teaches or tests",
      "itemCount": number (optional — for quiz: number of questions, flashcard: number of cards, step-navigator: number of steps)
    }
  ]
}

Rules:
- Always start with a 'hero' block (summary = one-sentence lesson tagline)
- Organize the rest of the lesson into 2–4 "learning units". Each unit consists of:
    1. ONE teaching block — narrative, step-navigator, or media — that provides complete, self-contained context on a concept
    2. ONE to THREE interactive blocks — quiz, flashcard, or fill-in-the-blank — that test only what the preceding teaching block explicitly covered
       Use 1 interactive block for focused content, 2–3 when the teaching block covers multiple distinct facts or sub-topics
- Teaching blocks must be comprehensive: a learner who reads/watches the teaching block should be able to answer every question in the follow-up interactive block(s) without any outside knowledge
- Interactive block summaries must name the specific facts, terms, or concepts from their teaching block that they will test
- Only use 'media' blocks when a video URL is explicitly provided in the source material
- Use step-navigator for processes and multi-step how-tos; use narrative for explanations, definitions, and context
- Use at least 2 different interactive block types across the lesson (quiz, flashcard, fill-in-the-blank)
- Aim for 10–16 blocks total (hero + 2–4 learning units × 2–4 blocks each)
- If a source document is provided, ALL block content must draw directly from it — do not introduce topics not in the document
- Return ONLY valid JSON. No markdown fences, no explanation, no preamble. Start your response with { and end with }.`

async function generateOutline(params: {
  title: string
  audience: string
  level: string
  documentText?: string
  focus?: string
  model?: string
  skipHero?: boolean
  passiveLesson?: boolean
  videoUrl?: string
  videoStartTime?: number
  videoEndTime?: number
  signal?: AbortSignal
}): Promise<LessonOutline> {
  const focusLine = params.focus?.trim() ? `Focus/Scope: ${params.focus.trim()}\n` : ''
  const heroOverride = params.skipHero
    ? '\n\nIMPORTANT: Do NOT include a hero block. Start the lesson directly with a narrative or step-navigator block.'
    : ''
  const passiveOverride = params.passiveLesson ? PASSIVE_LESSON_OVERRIDE : ''

  const videoLine = params.videoUrl
    ? `Video URL: ${params.videoUrl}${params.videoStartTime != null ? ` | Start: ${params.videoStartTime}s` : ''}${params.videoEndTime != null ? ` | End: ${params.videoEndTime}s` : ''} — you may use a "media" block with this URL as the teaching portion of a learning unit\n`
    : ''

  const userContent = params.documentText?.trim()
    ? `Title: ${params.title}\nAudience: ${params.audience}\nLevel: ${params.level}\n${focusLine}${videoLine}\nSource document:\n"""\n${params.documentText}\n"""\n\nRespond with JSON only.`
    : `Title: ${params.title}\nTopic: ${params.title}\nAudience: ${params.audience}\nLevel: ${params.level}\n${focusLine}${videoLine}\nRespond with JSON only.`

  const message = await client.messages.create({
    model: params.model ?? DEFAULT_MODEL,
    max_tokens: 2048,
    system: OUTLINE_SYSTEM_PROMPT + heroOverride + passiveOverride,
    messages: [{ role: 'user', content: userContent }],
  }, { signal: params.signal })

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''
  return JSON.parse(extractJSON(raw)) as LessonOutline
}

// ── Lesson generation ─────────────────────────────────────────────────────────

const OUTLINE_LESSON_SYSTEM_PROMPT = `You are an expert instructional designer. Generate a complete Primr lesson as JSON from the provided outline. Each block in the outline specifies a type, summary of what it should cover, and optionally an item count.

Return this structure:
{
  "id": "kebab-case-id",
  "title": "Lesson Title",
  "slug": "kebab-case-slug",
  "blocks": [{ "id": "block-id", "type": "block-type", "props": { ... } }]
}

${BLOCK_SCHEMAS}

Rules:
- Generate exactly the blocks listed in the outline, in the same order, with the same IDs and types
- Use each block's summary to guide the content you generate for its props
- If itemCount is specified, generate exactly that many items (questions, cards, steps, etc.)
- Tailor content to the specified audience and level
- Body/prompt fields support markdown: **bold**, *italic*, __underline__, \`code\`, and links
- TEACHING BLOCKS (narrative, step-navigator, media): must be self-contained and comprehensive. Narrative body should be 120–200 words and explicitly state every fact, term, and answer that the subsequent interactive block(s) will test. A learner should be able to answer every question solely from the teaching block — never assume outside knowledge.
- INTERACTIVE BLOCKS (quiz, flashcard, fill-in-the-blank): every correct answer must be directly stated in the preceding teaching block. Do not test facts that were not explicitly taught.
- Flashcard decks: max 6 cards. Quiz: max 5 questions. Step-navigator: max 5 steps.
- Quiz explanations (max 30 words) should reference where in the teaching block the answer was covered.
- Return ONLY valid JSON. No explanation, no markdown fences, no extra text, no preamble. Start your response with { and end with }.`

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

async function generateLesson(params: {
  outline: LessonOutline
  documentText?: string
  userId: string | null
  focus?: string
  model?: string
  passiveLesson?: boolean
  skipHero?: boolean
  videoUrl?: string
  videoStartTime?: number
  videoEndTime?: number
  signal?: AbortSignal
}): Promise<string> {  // returns lessonId
  const focusLine = params.focus?.trim() ? `\n\nFocus/Scope: ${params.focus.trim()} — only include content relevant to this focus.` : ''
  const videoLine = params.videoUrl
    ? `\n\nVideo URL: ${params.videoUrl}${params.videoStartTime != null ? ` (start: ${params.videoStartTime}s` : ''}${params.videoEndTime != null ? `, end: ${params.videoEndTime}s)` : (params.videoStartTime != null ? ')' : '')} — use this URL in any media block props`
    : ''
  const userMessage = [
    `Generate a Primr lesson from this outline:\n\n${JSON.stringify(params.outline, null, 2)}`,
    focusLine,
    videoLine,
    params.documentText?.trim()
      ? `\n\nSource document (use this as the primary source for all content — do not invent material not present in this document):\n"""\n${params.documentText}\n"""`
      : '',
  ].join('')

  let systemPrompt = OUTLINE_LESSON_SYSTEM_PROMPT
  if (params.passiveLesson) {
    systemPrompt += PASSIVE_LESSON_OVERRIDE
  }
  if (params.skipHero) {
    systemPrompt += '\n\nIMPORTANT: Do NOT generate a hero block. The outline may list one — skip it. Start directly with the second block.'
  }

  const message = await client.messages.create({
    model: params.model ?? DEFAULT_MODEL,
    max_tokens: 16384,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage + '\n\nRespond with JSON only.' }],
  }, { signal: params.signal })

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''
  const manifest: LessonManifest = JSON.parse(extractJSON(raw))

  const slug = `${slugify(manifest.slug || manifest.title)}-${Math.random().toString(36).slice(2, 7)}`
  manifest.slug = slug

  const [lesson] = await db.insert(lessons).values({
    slug,
    title: manifest.title,
    manifest,
    createdBy: params.userId,
  }).returning()

  return lesson.id
}

// ── Concurrency ───────────────────────────────────────────────────────────────

// Max number of lessons to generate simultaneously. Each lesson makes 2 API
// calls (outline + content), so this is effectively 2× the API concurrency.
// Override via COURSE_GEN_CONCURRENCY env var.
const GENERATION_CONCURRENCY = parseInt(process.env.COURSE_GEN_CONCURRENCY ?? '5', 10)

// ── Main entry point ──────────────────────────────────────────────────────────

export interface LessonGenInput {
  chapterLessonId: string
  title: string
  sourceText?: string
  audience?: string
  level?: string
  focus?: string
  videoUrl?: string
  videoStartTime?: number
  videoEndTime?: number
}

export async function runCourseGeneration(
  courseId: string,
  lessonInputs: LessonGenInput[],
  userId: string | null,
  model?: string,
  passiveLesson?: boolean,
  creatorEmail?: string,
  skipHero?: boolean,
): Promise<void> {
  console.log(`[course-gen] Starting generation for course ${courseId}, ${lessonInputs.length} lessons`)

  const courseCtrl = new AbortController()
  courseControllers.set(courseId, courseCtrl)

  await db.update(courses).set({ status: 'generating', updatedAt: new Date() }).where(eq(courses.id, courseId))

  const failedIds = new Set<string>()

  // Per-lesson work extracted so workers can pull from a shared queue.
  async function processLesson(input: LessonGenInput): Promise<void> {
    if (courseCtrl.signal.aborted) return

    // Stop if the course was deleted while generation was running
    const courseExists = await db.query.courses.findFirst({ where: eq(courses.id, courseId) })
    if (!courseExists) {
      console.log(`[course-gen] Course ${courseId} was deleted — stopping generation`)
      courseCtrl.abort()  // signal other workers to stop too
      return
    }

    // Skip if this specific lesson was deleted
    const lessonExists = await db.query.chapterLessons.findFirst({ where: eq(chapterLessons.id, input.chapterLessonId) })
    if (!lessonExists) {
      console.log(`[course-gen] Lesson ${input.chapterLessonId} ("${input.title}") was deleted — skipping`)
      return
    }

    console.log(`[course-gen] Generating lesson: "${input.title}" (${input.chapterLessonId})`)

    // Per-lesson controller linked to the course controller so a course abort
    // immediately cancels the in-flight API call. Aborting the lesson controller
    // alone only cancels this lesson — other workers continue.
    const lessonCtrl = new AbortController()
    lessonControllers.set(input.chapterLessonId, lessonCtrl)
    const onCourseAbort = () => lessonCtrl.abort()
    courseCtrl.signal.addEventListener('abort', onCourseAbort, { once: true })

    await db.update(chapterLessons)
      .set({ generationStatus: 'generating' })
      .where(eq(chapterLessons.id, input.chapterLessonId))

    try {
      const outline = await generateOutline({
        title: input.title,
        audience: input.audience || 'General',
        level: input.level || 'beginner',
        documentText: input.sourceText,
        focus: input.focus,
        model,
        skipHero,
        passiveLesson,
        videoUrl: input.videoUrl,
        videoStartTime: input.videoStartTime,
        videoEndTime: input.videoEndTime,
        signal: lessonCtrl.signal,
      })

      const lessonId = await generateLesson({
        outline,
        documentText: input.sourceText,
        userId,
        focus: input.focus,
        model,
        passiveLesson,
        skipHero,
        videoUrl: input.videoUrl,
        videoStartTime: input.videoStartTime,
        videoEndTime: input.videoEndTime,
        signal: lessonCtrl.signal,
      })

      await db.update(chapterLessons)
        .set({ generationStatus: 'done', lessonId })
        .where(eq(chapterLessons.id, input.chapterLessonId))

      console.log(`[course-gen] Done: "${input.title}" → lesson ${lessonId}`)
    } catch (err) {
      // Course cancelled — other workers will also see the aborted signal
      if (courseCtrl.signal.aborted) return

      // Lesson individually cancelled or errored — mark failed, worker continues
      const wasCancelled = lessonCtrl.signal.aborted
      console.error(`[course-gen] ${wasCancelled ? 'Cancelled' : 'Failed'}: "${input.title}"`, wasCancelled ? '' : err)
      await db.update(chapterLessons)
        .set({ generationStatus: 'failed' })
        .where(eq(chapterLessons.id, input.chapterLessonId))
      failedIds.add(input.chapterLessonId)
    } finally {
      courseCtrl.signal.removeEventListener('abort', onCourseAbort)
      lessonControllers.delete(input.chapterLessonId)
    }
  }

  try {
    // Worker pool: up to GENERATION_CONCURRENCY workers pull from the shared queue.
    // queue.shift() is synchronous so there are no race conditions between workers.
    const queue = [...lessonInputs]
    const workers = Array.from(
      { length: Math.min(GENERATION_CONCURRENCY, lessonInputs.length) },
      async () => {
        while (queue.length > 0 && !courseCtrl.signal.aborted) {
          await processLesson(queue.shift()!)
        }
      },
    )
    await Promise.all(workers)
  } finally {
    courseControllers.delete(courseId)
  }

  // Course is always marked ready; failed lessons can be individually retried
  const courseRecord = await db.query.courses.findFirst({ where: eq(courses.id, courseId) })
  if (!courseRecord) {
    console.log(`[course-gen] Course ${courseId} was deleted before generation finished — nothing to finalize`)
    return
  }
  await db.update(courses).set({ status: 'ready', updatedAt: new Date() }).where(eq(courses.id, courseId))

  const doneCount = lessonInputs.length - failedIds.size
  console.log(`[course-gen] Course ${courseId} generation complete — ${doneCount}/${lessonInputs.length} done, ${failedIds.size} failed`)

  if (creatorEmail && courseRecord) {
    const appBase = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'https://app.primr.me'
    const courseUrl = `${appBase}/creator/courses/${courseId}/edit`
    const result = await sendEmail({
      to: creatorEmail,
      ...await courseCompleteEmail({ courseTitle: courseRecord.title, courseUrl, doneCount, failedCount: failedIds.size }),
    })
    if (!result.ok && !result.skipped) {
      console.error(`[course-gen] Failed to send completion email to ${creatorEmail}:`, result.error)
    }
  }
}
