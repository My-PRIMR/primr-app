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
import type { LessonManifest } from '@primr/components'
import type { LessonOutline } from '@/types/outline'

const client = new Anthropic()

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
      "type": "hero|narrative|step-navigator|quiz|flashcard|fill-in-the-blank",
      "summary": "1-2 sentence description of what this block covers",
      "itemCount": number (optional — for quiz: number of questions, flashcard: number of cards, step-navigator: number of steps)
    }
  ]
}

Rules:
- Always start with a 'hero' block (summary = tagline for the lesson)
- Include 8–12 blocks total
- Each interactive block (quiz, flashcard, fill-in-the-blank) must be preceded by a narrative or step-navigator block that teaches the material it will test — never place an interactive block without a teaching block immediately before it
- Use step-navigator for multi-part concepts or processes; use narrative for explanations and context
- Mix interactive types for engagement: use at least 2 different interactive types (quiz, flashcard, fill-in-the-blank)
- Summaries should be specific to the content, not generic
- If a source document is provided, ALL block summaries must describe content drawn directly from that document. Do not introduce topics not covered in the document.
- Return ONLY valid JSON. No markdown fences, no explanation, no preamble. Start your response with { and end with }.`

async function generateOutline(params: {
  title: string
  audience: string
  level: string
  documentText?: string
  focus?: string
  model?: string
  skipHero?: boolean
}): Promise<LessonOutline> {
  const focusLine = params.focus?.trim() ? `Focus/Scope: ${params.focus.trim()}\n` : ''
  const heroOverride = params.skipHero
    ? '\n\nIMPORTANT: Do NOT include a hero block. Start the lesson directly with a narrative or step-navigator block.'
    : ''
  const userContent = params.documentText?.trim()
    ? `Title: ${params.title}\nAudience: ${params.audience}\nLevel: ${params.level}\n${focusLine}\nSource document:\n"""\n${params.documentText}\n"""\n\nRespond with JSON only.`
    : `Title: ${params.title}\nTopic: ${params.title}\nAudience: ${params.audience}\nLevel: ${params.level}\n${focusLine}\nRespond with JSON only.`

  const message = await client.messages.create({
    model: params.model ?? DEFAULT_MODEL,
    max_tokens: 2048,
    system: OUTLINE_SYSTEM_PROMPT + heroOverride,
    messages: [{ role: 'user', content: userContent }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''
  return JSON.parse(extractJSON(raw)) as LessonOutline
}

// ── Lesson generation ─────────────────────────────────────────────────────────

const BLOCK_SCHEMAS = `Block prop schemas:

hero:
  title: string (required) — large serif title
  tagline?: string — one sentence
  meta?: Array<{ label: string, icon?: 'clock' | 'level' | 'tag' }>
  cta?: string — CTA button label (default: "Start lesson")

narrative:
  body: string (required) — markdown text
  title?: string — serif heading
  eyebrow?: string — small uppercase label

step-navigator:
  steps: Array<{ title: string, body: string, hint?: string }>
  badge?: string — e.g. "Step walkthrough"
  title?: string

quiz:
  questions: Array<{ prompt: string, options: string[], correctIndex: number, explanation?: string }>
  badge?: string
  title?: string
  passScore?: number — 0 to 1

flashcard:
  cards: Array<{ front: string, back: string }>
  badge?: string
  title?: string

fill-in-the-blank:
  prompt: string — text with {{blank}} placeholders
  answers: Array<string | string[]> — one entry per blank, can be array of accepted answers
  badge?: string
  title?: string
  hint?: string
  IMPORTANT: Each answer must be 1-2 words only, no punctuation.`

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
- Keep content concise: narrative body max ~150 words, quiz explanations max ~30 words, step body max ~100 words
- Flashcard decks: max 6 cards. Quiz: max 5 questions. Step-navigator: max 5 steps.
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
}): Promise<string> {  // returns lessonId
  const focusLine = params.focus?.trim() ? `\n\nFocus/Scope: ${params.focus.trim()} — only include content relevant to this focus.` : ''
  const userMessage = [
    `Generate a Primr lesson from this outline:\n\n${JSON.stringify(params.outline, null, 2)}`,
    focusLine,
    params.documentText?.trim()
      ? `\n\nSource document (use this as the primary source for all content — do not invent material not present in this document):\n"""\n${params.documentText}\n"""`
      : '',
  ].join('')

  let systemPrompt = OUTLINE_LESSON_SYSTEM_PROMPT
  if (params.passiveLesson) {
    systemPrompt += '\n\nIMPORTANT: Generate only informational content blocks (hero, narrative, step-navigator). Do not include any interactive or assessment blocks (quiz, flashcard, fill-in-the-blank, or similar). The lesson should be purely informational — no questions, no exercises.'
  }
  if (params.skipHero) {
    systemPrompt += '\n\nIMPORTANT: Do NOT generate a hero block. The outline may list one — skip it. Start directly with the second block.'
  }

  const message = await client.messages.create({
    model: params.model ?? DEFAULT_MODEL,
    max_tokens: 16384,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage + '\n\nRespond with JSON only.' }],
  })

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

// ── Main entry point ──────────────────────────────────────────────────────────

export interface LessonGenInput {
  chapterLessonId: string
  title: string
  sourceText?: string
  audience?: string
  level?: string
  focus?: string
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

  await db.update(courses).set({ status: 'generating', updatedAt: new Date() }).where(eq(courses.id, courseId))

  const failedIds = new Set<string>()

  for (const input of lessonInputs) {
    console.log(`[course-gen] Generating lesson: "${input.title}" (${input.chapterLessonId})`)

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
      })

      const lessonId = await generateLesson({
        outline,
        documentText: input.sourceText,
        userId,
        focus: input.focus,
        model,
        passiveLesson,
        skipHero,
      })

      await db.update(chapterLessons)
        .set({ generationStatus: 'done', lessonId })
        .where(eq(chapterLessons.id, input.chapterLessonId))

      console.log(`[course-gen] Done: "${input.title}" → lesson ${lessonId}`)
    } catch (err) {
      console.error(`[course-gen] Failed: "${input.title}":`, err)
      await db.update(chapterLessons)
        .set({ generationStatus: 'failed' })
        .where(eq(chapterLessons.id, input.chapterLessonId))
      failedIds.add(input.chapterLessonId)
    }
  }

  // Course is always marked ready; failed lessons can be individually retried
  const courseRecord = await db.query.courses.findFirst({ where: eq(courses.id, courseId) })
  await db.update(courses).set({ status: 'ready', updatedAt: new Date() }).where(eq(courses.id, courseId))

  const doneCount = lessonInputs.length - failedIds.size
  console.log(`[course-gen] Course ${courseId} generation complete — ${doneCount}/${lessonInputs.length} done, ${failedIds.size} failed`)

  if (creatorEmail && courseRecord) {
    const appBase = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'https://app.primr.me'
    const courseUrl = `${appBase}/creator/courses/${courseId}/edit`
    const hasFailures = failedIds.size > 0
    const subject = hasFailures
      ? `Your course "${courseRecord.title}" finished with ${failedIds.size} failed lesson${failedIds.size !== 1 ? 's' : ''}`
      : `Your course "${courseRecord.title}" is ready`

    const html = hasFailures
      ? `<p>Your Primr course <strong>${courseRecord.title}</strong> finished generating.</p>
         <p>✅ ${doneCount} lesson${doneCount !== 1 ? 's' : ''} generated successfully<br>
         ❌ ${failedIds.size} lesson${failedIds.size !== 1 ? 's' : ''} failed — you can retry them from the course editor.</p>
         <p><a href="${courseUrl}">Open course editor →</a></p>`
      : `<p>Your Primr course <strong>${courseRecord.title}</strong> is ready with ${doneCount} lesson${doneCount !== 1 ? 's' : ''}.</p>
         <p><a href="${courseUrl}">Open course →</a></p>`

    const text = hasFailures
      ? `Your course "${courseRecord.title}" finished. ${doneCount} lessons done, ${failedIds.size} failed.\n\nOpen the course editor to retry failed lessons: ${courseUrl}`
      : `Your course "${courseRecord.title}" is ready with ${doneCount} lessons.\n\n${courseUrl}`

    const result = await sendEmail({ to: creatorEmail, subject, html, text })
    if (!result.ok && !result.skipped) {
      console.error(`[course-gen] Failed to send completion email to ${creatorEmail}:`, result.error)
    }
  }
}
