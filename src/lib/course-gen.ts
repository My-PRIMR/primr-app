/**
 * Background course generation logic.
 * Runs sequentially through all chapter_lessons, generating outline + lesson for each.
 */
import Anthropic from '@anthropic-ai/sdk'
import { extractJSON } from './extract-json'
import { db } from '@/db'
import { courses, chapterLessons } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { DEFAULT_MODEL } from '@/lib/models'
import { sendEmail } from '@/lib/email'
import { courseCompleteEmail } from '@/lib/email-templates'
import { PASSIVE_LESSON_OVERRIDE } from '@/lib/block-schemas'
import type { LessonOutline } from '@/types/outline'
import { generateLessonFromOutline } from '@/lib/lesson-gen'

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
- Organize the rest of the lesson into multiple "learning units" (amount depends on the complexity -- keep units small, but allow many for complex topics). Each unit consists of:
    1. ONE teaching block — narrative, step-navigator, or media — that provides complete, self-contained context on a concept
    2. MULTIPLE interactive blocks — quiz, flashcard, or fill-in-the-blank, etc... — that test only what the preceding teaching block explicitly covered
       Use 1-2 interactive blocks for focused content, more blocks when the teaching block covers multiple distinct facts or sub-topics
- Teaching blocks must be comprehensive: a learner who reads/watches the teaching block should be able to answer every question in the follow-up interactive block(s) without any outside knowledge
- Interactive block summaries must name the specific facts, terms, or concepts from their teaching block that they will test
- Only use 'media' blocks when a video URL is explicitly provided in the source material
- Use step-navigator for processes and multi-step how-tos; use narrative for explanations, definitions, and context
- Use at least 2 different interactive block types across the lesson (quiz, flashcard, fill-in-the-blank, etc...)
- Use as many block groups (teaching + follow-up interactives) as needed to cover the topic effectively, but keep each group focused on a single concept or sub-topic
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

async function generateLesson(params: {
  outline: LessonOutline
  documentText?: string
  userId: string | null
  focus?: string
  model?: string
  passiveLesson?: boolean
  skipHero?: boolean
  includeImages?: boolean
  videoUrl?: string
  videoStartTime?: number
  videoEndTime?: number
  signal?: AbortSignal
}): Promise<string> {  // returns lessonId
  const { lessonId } = await generateLessonFromOutline({
    outline: params.outline,
    documentText: params.documentText,
    focus: params.focus,
    model: params.model,
    passiveLesson: params.passiveLesson,
    skipHero: params.skipHero,
    includeImages: params.includeImages,
    videoUrl: params.videoUrl,
    videoStartTime: params.videoStartTime,
    videoEndTime: params.videoEndTime,
    userId: params.userId,
    signal: params.signal,
  })
  return lessonId
}

// ── Retry helpers ────────────────────────────────────────────────────────────

const MAX_RETRY_ATTEMPTS = 3
const INITIAL_BACKOFF_MS = 2000

function isRetryableError(err: unknown): boolean {
  if (err instanceof Anthropic.RateLimitError) return true
  if (err instanceof Anthropic.InternalServerError) return true
  if (err instanceof Anthropic.APIConnectionError) return true
  return false
}

function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason)
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason) }, { once: true })
  })
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
  includeImages?: boolean,
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
      for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
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
            includeImages,
            videoUrl: input.videoUrl,
            videoStartTime: input.videoStartTime,
            videoEndTime: input.videoEndTime,
            signal: lessonCtrl.signal,
          })

          await db.update(chapterLessons)
            .set({ generationStatus: 'done', lessonId })
            .where(eq(chapterLessons.id, input.chapterLessonId))

          console.log(`[course-gen] Done: "${input.title}" → lesson ${lessonId}`)
          break // success — exit retry loop
        } catch (err) {
          // Course cancelled — other workers will also see the aborted signal
          if (courseCtrl.signal.aborted) return

          // Lesson individually cancelled — no retry
          if (lessonCtrl.signal.aborted) {
            console.log(`[course-gen] Cancelled: "${input.title}"`)
            await db.update(chapterLessons)
              .set({ generationStatus: 'failed' })
              .where(eq(chapterLessons.id, input.chapterLessonId))
            failedIds.add(input.chapterLessonId)
            break
          }

          const canRetry = isRetryableError(err) && attempt < MAX_RETRY_ATTEMPTS
          if (canRetry) {
            const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1)
            console.warn(`[course-gen] Retryable error on "${input.title}" (attempt ${attempt}/${MAX_RETRY_ATTEMPTS}), retrying in ${backoffMs}ms`, err)
            await db.update(chapterLessons)
              .set({ generationStatus: 'retrying' })
              .where(eq(chapterLessons.id, input.chapterLessonId))
            try {
              await abortableSleep(backoffMs, lessonCtrl.signal)
            } catch {
              // Aborted during sleep — mark failed and exit
              await db.update(chapterLessons)
                .set({ generationStatus: 'failed' })
                .where(eq(chapterLessons.id, input.chapterLessonId))
              failedIds.add(input.chapterLessonId)
              break
            }
            await db.update(chapterLessons)
              .set({ generationStatus: 'generating' })
              .where(eq(chapterLessons.id, input.chapterLessonId))
            continue
          }

          // Non-retryable or final attempt — mark failed
          console.error(`[course-gen] Failed: "${input.title}" (attempt ${attempt}/${MAX_RETRY_ATTEMPTS})`, err)
          await db.update(chapterLessons)
            .set({ generationStatus: 'failed' })
            .where(eq(chapterLessons.id, input.chapterLessonId))
          failedIds.add(input.chapterLessonId)
          break
        }
      }
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
