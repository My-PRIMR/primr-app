/**
 * Background course generation logic.
 * Runs sequentially through all chapter_lessons, generating outline + lesson for each.
 */
import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/db'
import { courses, chapterLessons, lessons } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'
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
- Return ONLY valid JSON. No markdown fences, no explanation.`

async function generateOutline(params: {
  title: string
  audience: string
  level: string
  documentText?: string
}): Promise<LessonOutline> {
  const userContent = params.documentText?.trim()
    ? `Title: ${params.title}\nAudience: ${params.audience}\nLevel: ${params.level}\n\nSource document:\n"""\n${params.documentText}\n"""`
    : `Title: ${params.title}\nTopic: ${params.title}\nAudience: ${params.audience}\nLevel: ${params.level}`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: OUTLINE_SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: userContent },
      { role: 'assistant', content: '{' },
    ],
  })

  const raw = message.content[0].type === 'text' ? '{' + message.content[0].text : ''
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  return JSON.parse(cleaned) as LessonOutline
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
- Return ONLY valid JSON. No explanation, no markdown fences, no extra text.`

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
}): Promise<string> {  // returns lessonId
  const userMessage = [
    `Generate a Primr lesson from this outline:\n\n${JSON.stringify(params.outline, null, 2)}`,
    params.documentText?.trim()
      ? `\n\nSource document (use this as the primary source for all content — do not invent material not present in this document):\n"""\n${params.documentText}\n"""`
      : '',
  ].join('')

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 16384,
    system: OUTLINE_LESSON_SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: userMessage },
      { role: 'assistant', content: '{' },
    ],
  })

  const raw = message.content[0].type === 'text' ? '{' + message.content[0].text : ''
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  const manifest: LessonManifest = JSON.parse(cleaned)

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
}

export async function runCourseGeneration(
  courseId: string,
  lessonInputs: LessonGenInput[],
  userId: string | null,
): Promise<void> {
  console.log(`[course-gen] Starting generation for course ${courseId}, ${lessonInputs.length} lessons`)

  await db.update(courses).set({ status: 'generating', updatedAt: new Date() }).where(eq(courses.id, courseId))

  let allSucceeded = true

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
      })

      const lessonId = await generateLesson({
        outline,
        documentText: input.sourceText,
        userId,
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
      allSucceeded = false
    }
  }

  const finalStatus = allSucceeded ? 'ready' : 'ready'  // still ready, failed lessons can be retried
  await db.update(courses).set({ status: finalStatus, updatedAt: new Date() }).where(eq(courses.id, courseId))
  console.log(`[course-gen] Course ${courseId} generation complete (status: ${finalStatus})`)
}
