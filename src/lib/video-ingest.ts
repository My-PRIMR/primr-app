/**
 * Video ingestion pipeline.
 * Extracts chapters + captions from YouTube via yt-dlp, then generates a
 * chapter-structured Primr lesson with one media clip per chapter and
 * quizzes consolidated at the end.
 */
import Anthropic from '@anthropic-ai/sdk'
import { extractJSON } from './extract-json'
import { AssemblyAI } from 'assemblyai'
import { exec } from 'child_process'
import { promisify } from 'util'
import { readFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { lessons } from '@/db/schema'
import type { LessonManifest } from '@primr/components'

const anthropic = new Anthropic()
const assemblyai = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY! })
const execAsync = promisify(exec)

// ── Types ─────────────────────────────────────────────────────────────────────

interface Chapter {
  title: string
  start_time: number  // seconds
  end_time: number    // seconds
}

interface YoutubeData {
  videoTitle: string
  chapters: Chapter[]
  transcriptText: string                              // full, for outline
  chapterTranscripts: Array<{ chapter: Chapter; text: string }>
}

type Json3Event = { tStartMs?: number; segs?: Array<{ utf8: string }> }

// ── Prompts ───────────────────────────────────────────────────────────────────

const BLOCK_SCHEMAS = `Block prop schemas:

hero:
  title: string (required) — large serif lesson title
  tagline?: string — one sentence
  meta?: Array<{ label: string, icon?: 'clock' | 'level' | 'tag' }>
  cta?: string — CTA button label

narrative:
  body: string (required) — markdown text
  title?: string — serif heading
  eyebrow?: string — small uppercase label

step-navigator:
  steps: Array<{ title: string, body: string, hint?: string }>
  badge?: string
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
  answers: Array<string | string[]> — one entry per blank; can be array of synonyms
  badge?: string
  title?: string
  hint?: string
  IMPORTANT: Each answer must be 1–2 words only, no punctuation.

media:
  url: string (required) — original YouTube or Vimeo URL
  title?: string — chapter title
  badge?: string — e.g. "Chapter 1"
  caption?: string — one sentence describing what the clip covers
  startTime?: number — clip start in seconds
  endTime?: number — clip end in seconds
  completeOn?: 'mount' | 'end' — default 'end'`

// Outline prompt — chapter-aware
const OUTLINE_SYSTEM_PROMPT = `You are an expert instructional designer. Given a video transcript (split by chapter) and a list of chapters with timestamps, generate a lesson outline as JSON.

The lesson MUST follow this exact structure:
1. A single 'hero' block at the very start
2. For EACH chapter: one 'media' block (the clip) followed by 1–2 content blocks (narrative or step-navigator only — NO quiz/flashcard/fill-in-the-blank here)
3. 1–3 'quiz' blocks at the very end ONLY, covering knowledge from across all chapters

Return this exact JSON structure:
{
  "title": "string",
  "slug": "kebab-case-slug",
  "blocks": [
    { "id": "hero", "type": "hero", "summary": "..." },

    { "id": "ch0-media", "type": "media", "chapterIndex": 0, "summary": "Chapter title — what the clip covers" },
    { "id": "ch0-content", "type": "narrative|step-navigator", "chapterIndex": 0, "summary": "...", "itemCount": number },

    { "id": "ch1-media", "type": "media", "chapterIndex": 1, "summary": "..." },
    { "id": "ch1-content", "type": "narrative|step-navigator", "chapterIndex": 1, "summary": "...", "itemCount": number },

    { "id": "quiz-1", "type": "quiz", "summary": "Tests knowledge from all chapters", "itemCount": 5 }
  ]
}

Rules:
- chapterIndex is the 0-based index into the chapters array provided
- Never put quizzes, flashcards, or fill-in-the-blank blocks inside chapter sections
- All quizzes must appear after the last chapter's content blocks
- All content must be grounded in the transcript — do not invent material
- Return ONLY valid JSON. No markdown fences, no explanation, no preamble. Start your response with { and end with }.`

// Lesson prompt — uses enriched outline that already has startTime/endTime injected
const LESSON_SYSTEM_PROMPT = `You are an expert instructional designer. Generate a complete Primr lesson as JSON from the provided outline and chapter transcripts.

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
- For 'media' blocks: use the original video URL, and use the startTime/endTime values from the outline exactly
- Use each block's chapterIndex to find the right chapter transcript for content
- Body/prompt fields support markdown: **bold**, *italic*, \`code\`
- Keep content concise: narrative body max ~150 words, step body max ~80 words, quiz explanation max ~25 words
- Flashcard decks: max 6 cards. Quiz: max 5 questions. Step-navigator: max 5 steps.
- Return ONLY valid JSON. No explanation, no markdown fences, no extra text, no preamble. Start your response with { and end with }.`

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function parseEvents(events: Json3Event[]): string {
  return events
    .flatMap(e => e.segs ?? [])
    .map(s => s.utf8?.replace(/\n/g, ' ') ?? '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitTranscriptByChapters(
  events: Json3Event[],
  chapters: Chapter[]
): Array<{ chapter: Chapter; text: string }> {
  return chapters.map(ch => {
    const startMs = ch.start_time * 1000
    const endMs = ch.end_time * 1000
    const chEvents = events.filter(e => (e.tStartMs ?? 0) >= startMs && (e.tStartMs ?? 0) < endMs)
    return { chapter: ch, text: parseEvents(chEvents) }
  })
}

const MAX_TRANSCRIPT_CHARS = 40_000
const MAX_CHAPTER_CHARS = 4_000   // per chapter in manifest prompt

// ── YouTube data fetch (chapters + captions in one yt-dlp call) ───────────────

async function fetchYouTubeData(videoUrl: string): Promise<YoutubeData> {
  const outBase = join(tmpdir(), `primr-yt-${Date.now()}`)
  const subFile = `${outBase}.en.json3`

  try {
    const { stdout } = await execAsync(
      `yt-dlp --write-auto-subs --sub-langs en --sub-format json3 --skip-download --print-json -o "${outBase}" "${videoUrl}"`,
      { timeout: 60_000 }
    )

    const meta = JSON.parse(stdout) as { title: string; chapters?: Chapter[] }
    const chapters: Chapter[] = meta.chapters ?? []

    const subRaw = await readFile(subFile, 'utf8')
    const subData = JSON.parse(subRaw) as { events?: Json3Event[] }
    const events = subData.events ?? []

    const transcriptText = parseEvents(events).slice(0, MAX_TRANSCRIPT_CHARS)

    const chapterTranscripts = chapters.length > 0
      ? splitTranscriptByChapters(events, chapters)
      : []

    return { videoTitle: meta.title, chapters, transcriptText, chapterTranscripts }
  } finally {
    unlink(subFile).catch(() => {})
  }
}

// ── Main pipeline ─────────────────────────────────────────────────────────────

export async function runVideoIngestion(params: {
  lessonId: string
  videoUrl: string
  title?: string
  audience?: string
  level?: string
}): Promise<void> {
  const { lessonId, videoUrl, title, audience = 'General', level = 'beginner' } = params
  console.log(`[video-ingest] Starting for lesson ${lessonId}, url=${videoUrl}`)

  try {
    // ── Step 1: Mark as generating ───────────────────────────────────────────
    await db.update(lessons)
      .set({ generationStatus: 'generating', updatedAt: new Date() })
      .where(eq(lessons.id, lessonId))

    // ── Step 2: Get transcript + chapters ─────────────────────────────────────
    const isYouTube = /youtu\.be|youtube\.com/.test(videoUrl)
    let transcriptText: string
    let chapters: Chapter[] = []
    let chapterTranscripts: Array<{ chapter: Chapter; text: string }> = []

    if (isYouTube) {
      console.log(`[video-ingest] Fetching YouTube data (captions + chapters)...`)
      const t0 = Date.now()
      const data = await fetchYouTubeData(videoUrl)
      transcriptText = data.transcriptText
      chapters = data.chapters
      chapterTranscripts = data.chapterTranscripts
      console.log(`[video-ingest] YouTube data done in ${Date.now() - t0}ms, chapters=${chapters.length}, chars=${transcriptText.length}`)
    } else {
      console.log(`[video-ingest] Submitting to AssemblyAI...`)
      const t0 = Date.now()
      const transcript = await assemblyai.transcripts.transcribe({ audio: videoUrl, speech_models: ['universal-2'] })
      console.log(`[video-ingest] Transcription done in ${Date.now() - t0}ms, status=${transcript.status}`)
      if (transcript.status === 'error' || !transcript.text) {
        throw new Error(`AssemblyAI transcription failed: ${transcript.error ?? 'no text returned'}`)
      }
      transcriptText = transcript.text.slice(0, MAX_TRANSCRIPT_CHARS)
    }

    // ── Step 3: Generate outline ─────────────────────────────────────────────
    console.log(`[video-ingest] Generating outline (${chapters.length} chapters)...`)

    const chapterList = chapters.length > 0
      ? `\nChapters:\n${chapters.map((ch, i) => `  ${i}: "${ch.title}" (${ch.start_time}s–${ch.end_time}s)`).join('\n')}`
      : ''

    const chapterTranscriptSection = chapterTranscripts.length > 0
      ? `\nPer-chapter transcripts:\n${chapterTranscripts.map((ct, i) =>
          `--- Chapter ${i}: ${ct.chapter.title} ---\n${ct.text.slice(0, MAX_CHAPTER_CHARS)}`
        ).join('\n\n')}`
      : `\nTranscript:\n"""\n${transcriptText}\n"""`

    const outlineUserContent = [
      `Video URL: ${videoUrl}`,
      title ? `Title: ${title}` : '',
      `Audience: ${audience}`,
      `Level: ${level}`,
      chapterList,
      chapterTranscriptSection,
    ].filter(Boolean).join('\n')

    const outlineMsg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: OUTLINE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: outlineUserContent + '\n\nRespond with JSON only.' }],
    })
    const outlineRaw = outlineMsg.content[0].type === 'text' ? outlineMsg.content[0].text : ''
    const outline = JSON.parse(extractJSON(outlineRaw))
    console.log(`[video-ingest] Outline: ${outline.blocks.length} blocks`)

    // ── Step 4: Inject chapter timestamps into media blocks ───────────────────
    for (const block of outline.blocks) {
      if (block.type === 'media' && typeof block.chapterIndex === 'number') {
        const ch = chapters[block.chapterIndex]
        if (ch) {
          block.startTime = ch.start_time
          block.endTime = ch.end_time
        }
      }
    }

    // ── Step 5: Generate full manifest ───────────────────────────────────────
    console.log(`[video-ingest] Generating lesson manifest...`)

    const chapterTranscriptContext = chapterTranscripts.length > 0
      ? chapterTranscripts.map((ct, i) =>
          `--- Chapter ${i}: ${ct.chapter.title} (${ct.chapter.start_time}s–${ct.chapter.end_time}s) ---\n${ct.text.slice(0, MAX_CHAPTER_CHARS)}`
        ).join('\n\n')
      : transcriptText

    const lessonUserContent = [
      `Video URL: ${videoUrl}`,
      `Generate a Primr lesson from this outline:\n\n${JSON.stringify(outline, null, 2)}`,
      `\nChapter transcripts (use the matching chapterIndex for each block's content):\n${chapterTranscriptContext}`,
    ].join('\n\n')

    const lessonMsg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 16384,
      system: LESSON_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: lessonUserContent + '\n\nRespond with JSON only.' }],
    })
    const lessonRaw = lessonMsg.content[0].type === 'text' ? lessonMsg.content[0].text : ''
    const manifest: LessonManifest = JSON.parse(extractJSON(lessonRaw))

    const slug = `${slugify(manifest.slug || manifest.title)}-${Math.random().toString(36).slice(2, 7)}`
    manifest.slug = slug

    // ── Step 6: Persist manifest ─────────────────────────────────────────────
    await db.update(lessons)
      .set({
        title: manifest.title,
        slug,
        manifest,
        generationStatus: 'done',
        updatedAt: new Date(),
      })
      .where(eq(lessons.id, lessonId))

    console.log(`[video-ingest] Done. Lesson ${lessonId} ready with ${manifest.blocks.length} blocks.`)
  } catch (err) {
    console.error(`[video-ingest] Failed for lesson ${lessonId}:`, err)
    await db.update(lessons)
      .set({ generationStatus: 'failed', updatedAt: new Date() })
      .where(eq(lessons.id, lessonId))
      .catch(() => {})
  }
}
