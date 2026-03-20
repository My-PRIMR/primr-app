/**
 * Video ingestion pipeline.
 * Extracts chapters + captions from YouTube (Innertube + optional AssemblyAI fallback), then generates a
 * chapter-structured Primr lesson with one media clip per chapter and
 * quizzes consolidated at the end.
 */
import Anthropic from '@anthropic-ai/sdk'
import { extractJSON } from './extract-json'
import { AssemblyAI } from 'assemblyai'
import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { lessons } from '@/db/schema'
import type { LessonManifest } from '@primr/components'

const anthropic = new Anthropic()
const assemblyai = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY! })
// ── Types ─────────────────────────────────────────────────────────────────────

interface Chapter {
  title: string
  start_time: number  // seconds
  end_time: number    // seconds
}

interface YoutubeData {
  videoTitle: string
  durationSec: number
  audioUrl: string | null
  chapters: Chapter[]
  transcriptText: string                              // full, for outline
  chapterTranscripts: Array<{ chapter: Chapter; text: string }>
}


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
- If only ONE chapter is provided, still output one media block + 1–2 content blocks for that chapter, then 1–3 quiz blocks at the end (do not stop after hero + one content block).
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

const UPLOAD_OUTLINE_SYSTEM_PROMPT = `You are an expert instructional designer. Given a transcript from an uploaded media file, generate a lesson outline as JSON.

The lesson MUST follow this exact structure:
1. A single 'hero' block at the very start
2. 3-7 content blocks (narrative or step-navigator) covering core concepts
3. 1-3 'quiz' blocks at the very end

Return this exact JSON structure:
{
  "title": "string",
  "slug": "kebab-case-slug",
  "blocks": [
    { "id": "hero", "type": "hero", "summary": "..." },
    { "id": "concept-1", "type": "narrative|step-navigator", "summary": "...", "itemCount": number },
    { "id": "concept-2", "type": "narrative|step-navigator", "summary": "...", "itemCount": number },
    { "id": "quiz-1", "type": "quiz", "summary": "Tests key ideas", "itemCount": 5 }
  ]
}

Rules:
- Do not emit media blocks for uploaded-file lessons.
- All quizzes must appear after the last concept/content block.
- All content must be grounded in the transcript — do not invent material.
- Return ONLY valid JSON. No markdown fences, no explanation, no preamble. Start your response with { and end with }.`

const UPLOAD_LESSON_SYSTEM_PROMPT = `You are an expert instructional designer. Generate a complete Primr lesson as JSON from the provided outline and transcript.

Return this structure:
{
  "id": "kebab-case-id",
  "title": "Lesson Title",
  "slug": "kebab-case-slug",
  "blocks": [{ "id": "block-id", "type": "block-type", "props": { ... } }]
}

${BLOCK_SCHEMAS}

Rules:
- Generate exactly the blocks listed in the outline, in the same order, with the same IDs and types.
- Do not include media blocks for uploaded-file lessons.
- Body/prompt fields support markdown: **bold**, *italic*, \`code\`.
- Keep content concise: narrative body max ~150 words, step body max ~80 words, quiz explanation max ~25 words.
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

function extractVideoId(url: string): string {
  const m = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (!m) throw new Error(`Cannot extract video ID from URL: ${url}`)
  return m[1]
}

const MAX_TRANSCRIPT_CHARS = 40_000
const MAX_CHAPTER_CHARS = 4_000   // per chapter in manifest prompt
/** Innertube often returns HTTP 400 for get_transcript; below this we fall back to AssemblyAI. */
const MIN_TRANSCRIPT_CHARS = 120

async function fetchCaptionTrackSegments(
  captionBaseUrl: string
): Promise<Array<{ start_ms: string; snippet: { text: string } }>> {
  const json3Url = captionBaseUrl.includes('fmt=') ? captionBaseUrl : `${captionBaseUrl}&fmt=json3`
  const res = await fetch(json3Url)
  if (!res.ok) throw new Error(`caption track fetch failed: ${res.status}`)
  const data = (await res.json()) as {
    events?: Array<{ tStartMs?: number; segs?: Array<{ utf8?: string }> }>
  }
  const events = Array.isArray(data.events) ? data.events : []
  return events
    .map(ev => {
      const text = (ev.segs ?? [])
        .map(s => s.utf8 ?? '')
        .join('')
        .replace(/\s+/g, ' ')
        .trim()
      return {
        start_ms: String(ev.tStartMs ?? 0),
        snippet: { text },
      }
    })
    .filter(seg => seg.snippet.text.length > 0)
}

function buildTranscriptFromSegments(
  segments: Array<{ start_ms?: string; snippet?: { text?: string } }>,
  chapters: Chapter[]
): { transcriptText: string; chapterTranscripts: Array<{ chapter: Chapter; text: string }> } {
  const segText = (seg: { snippet?: { text?: string } }): string =>
    seg?.snippet?.text?.replace(/\s+/g, ' ').trim() ?? ''

  const transcriptText = segments
    .map(segText)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TRANSCRIPT_CHARS)

  const chapterTranscripts = chapters.length > 0
    ? chapters.map(ch => {
        const startMs = ch.start_time * 1000
        const endMs = ch.end_time * 1000
        const text = segments
          .filter(seg => {
            const ms = parseInt(seg?.start_ms ?? '0', 10)
            return ms >= startMs && ms < endMs
          })
          .map(segText)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
        return { chapter: ch, text }
      })
    : []

  return { transcriptText, chapterTranscripts }
}

function estimateDurationFromTranscript(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length
  // ~2.2 words/sec spoken English; clamp for sane clip bounds
  return Math.max(90, Math.min(7200, Math.ceil(words / 2.2)))
}

/** When YouTube captions exist but segment timestamps do not align, split text across chapters by duration weight. */
function distributeTranscriptAcrossChapters(
  chapters: Chapter[],
  transcriptText: string
): Array<{ chapter: Chapter; text: string }> {
  const words = transcriptText.split(/\s+/).filter(Boolean)
  if (words.length === 0) {
    return chapters.map(ch => ({ chapter: ch, text: '' }))
  }
  const weights = chapters.map(ch => Math.max(1, ch.end_time - ch.start_time))
  const totalW = weights.reduce((a, b) => a + b, 0)
  let offset = 0
  return chapters.map((ch, i) => {
    if (i === chapters.length - 1) {
      return { chapter: ch, text: words.slice(offset).join(' ').trim() }
    }
    const share = weights[i]! / totalW
    const n = Math.max(1, Math.floor(words.length * share))
    const slice = words.slice(offset, offset + n).join(' ')
    offset += n
    return { chapter: ch, text: slice.trim() }
  })
}

async function transcribeVideoUrlWithAssemblyAI(videoUrl: string): Promise<{ text: string; durationSec: number }> {
  if (!process.env.ASSEMBLYAI_API_KEY?.trim()) {
    throw new Error(
      'ASSEMBLYAI_API_KEY is required when YouTube captions are unavailable (Innertube transcript failed or empty)'
    )
  }
  const transcript = await assemblyai.transcripts.transcribe({ audio: videoUrl, speech_models: ['universal-2'] })
  if (transcript.status === 'error' || !transcript.text) {
    throw new Error(`AssemblyAI transcription failed: ${transcript.error ?? 'no text returned'}`)
  }
  const durationSec =
    transcript.audio_duration != null && transcript.audio_duration > 0
      ? Math.ceil(transcript.audio_duration)
      : 0
  const text = transcript.text.replace(/\s+/g, ' ').trim().slice(0, MAX_TRANSCRIPT_CHARS)
  return { text, durationSec }
}

function runExecFile(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(`${cmd} failed: ${stderr || error.message}`))
        return
      }
      resolve()
    })
  })
}

async function transcribeYouTubeViaYtDlp(videoUrl: string): Promise<{ text: string; durationSec: number }> {
  const workdir = await mkdtemp(join(tmpdir(), 'primr-ytdlp-'))
  const outTemplate = join(workdir, 'audio.%(ext)s')
  try {
    const cookiesPath = process.env.YTDLP_COOKIES_FILE?.trim()
    const args = [
      '-f', 'bestaudio[ext=m4a]/bestaudio',
      '--no-playlist',
      '--no-warnings',
      '--extract-audio',
      '--audio-format', 'm4a',
      '-o', outTemplate,
      ...(cookiesPath ? ['--cookies', cookiesPath] : []),
      videoUrl,
    ]

    // Prefer m4a when possible, but allow bestaudio fallback.
    try {
      await runExecFile('yt-dlp', args)
    } catch (err) {
      const msg = String(err)
      if (msg.includes('Sign in to confirm you’re not a bot') || msg.includes('cookies')) {
        throw new Error(
          `yt-dlp is blocked by YouTube anti-bot checks on this server. ` +
          `Set YTDLP_COOKIES_FILE to a valid YouTube cookies.txt path on the VPS and retry. ` +
          `Original error: ${msg}`
        )
      }
      throw err
    }

    const audioPath = join(workdir, 'audio.m4a')
    const transcript = await assemblyai.transcripts.transcribe({
      // AssemblyAI SDK accepts local file paths.
      audio: audioPath,
      speech_models: ['universal-2'],
    })
    if (transcript.status === 'error' || !transcript.text) {
      throw new Error(`AssemblyAI transcription failed after yt-dlp download: ${transcript.error ?? 'no text returned'}`)
    }
    return {
      text: transcript.text.replace(/\s+/g, ' ').trim().slice(0, MAX_TRANSCRIPT_CHARS),
      durationSec: transcript.audio_duration != null && transcript.audio_duration > 0
        ? Math.ceil(transcript.audio_duration)
        : 0,
    }
  } finally {
    await rm(workdir, { recursive: true, force: true }).catch(() => {})
  }
}

// ── YouTube data fetch via Innertube (no yt-dlp required) ────────────────────

async function fetchYouTubeData(videoUrl: string): Promise<YoutubeData> {
  const { Innertube } = await import('youtubei.js')
  const videoId = extractVideoId(videoUrl)

  const yt = await Innertube.create({ retrieve_player: true, generate_session_locally: true })
  const info = await yt.getInfo(videoId)

  const videoTitle = info.basic_info.title ?? 'Untitled Video'
  const durationSec = info.basic_info.duration ?? 0

  // ── Best-effort direct audio URL for AssemblyAI fallback ─────────────────
  // AssemblyAI cannot transcribe a YouTube watch-page URL (it receives HTML).
  // We provide a direct media stream URL when available.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const streamingData = (info as any)?.streaming_data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adaptiveFormats = (streamingData?.adaptive_formats ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const audioCandidates = adaptiveFormats.filter((f: any) =>
    (f?.has_audio === true || (typeof f?.mime_type === 'string' && f.mime_type.includes('audio/'))) &&
    f?.url
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bestAudio = audioCandidates.sort((a: any, b: any) => (b?.bitrate ?? 0) - (a?.bitrate ?? 0))[0]
  const audioUrl: string | null = bestAudio?.url ?? null

  // ── Chapters ──────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const overlay = (info.player_overlays as any)?.player_overlay
  const markersMap: Array<{ key: string; value: { chapters?: unknown[] } }> =
    overlay?.decorated_player_bar_renderer?.decorated_player_bar_renderer
      ?.player_bar?.multi_markers_player_bar_renderer?.markers_map ?? []

  const rawChapters = (
    markersMap.find(m => m.key === 'DESCRIPTION_CHAPTERS' || m.key === 'AUTO_CHAPTERS')
      ?.value?.chapters ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as any[]

  const chapters: Chapter[] = rawChapters.map((ch, i) => ({
    title: ch.title?.runs?.[0]?.text ?? ch.title?.text ?? `Chapter ${i + 1}`,
    start_time: Math.floor((ch.time_range_start_millis ?? 0) / 1000),
    end_time: i < rawChapters.length - 1
      ? Math.floor((rawChapters[i + 1].time_range_start_millis ?? 0) / 1000)
      : durationSec,
  }))

  // ── Transcript ────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let segments: any[] = []
  try {
    const transcriptData = await info.getTranscript()
    segments = transcriptData?.transcript?.content?.body?.initial_segments ?? []
  } catch (err) {
    console.warn(`[video-ingest] getTranscript() failed, continuing without transcript:`, err)
  }

  // Fallback to caption track endpoint (json3) when Innertube transcript fails/empty.
  if (segments.length === 0) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const caps = (info as any)?.captions
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tracks = (caps?.caption_tracks ?? caps?.player_captions_tracklist_renderer?.caption_tracks ?? []) as any[]
      const preferred = tracks.find(t => t?.language_code?.startsWith('en')) ?? tracks[0]
      const baseUrl: string | undefined = preferred?.base_url
      if (baseUrl) {
        segments = await fetchCaptionTrackSegments(baseUrl)
        console.log(`[video-ingest] Captions fallback fetched ${segments.length} segments from timedtext`)
      }
    } catch (err) {
      console.warn(`[video-ingest] caption track fallback failed:`, err)
    }
  }

  let normalizedSegments = segments.map(seg => ({
    start_ms: seg?.start_ms ?? '0',
    snippet: { text: (seg?.snippet?.runs?.[0]?.text ?? seg?.snippet?.text ?? '').toString() },
  }))

  let { transcriptText, chapterTranscripts } = buildTranscriptFromSegments(normalizedSegments, chapters)

  // Retry caption-track fallback when transcript remains too short.
  if (transcriptText.length < MIN_TRANSCRIPT_CHARS) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const caps = (info as any)?.captions
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tracks = (caps?.caption_tracks ?? caps?.player_captions_tracklist_renderer?.caption_tracks ?? []) as any[]
      const preferred = tracks.find(t => t?.language_code?.startsWith('en')) ?? tracks[0]
      const baseUrl: string | undefined = preferred?.base_url
      if (baseUrl) {
        normalizedSegments = await fetchCaptionTrackSegments(baseUrl)
        const rebuilt = buildTranscriptFromSegments(normalizedSegments, chapters)
        transcriptText = rebuilt.transcriptText
        chapterTranscripts = rebuilt.chapterTranscripts
        console.log(
          `[video-ingest] Captions fallback fetched ${normalizedSegments.length} segments from timedtext (chars=${transcriptText.length})`
        )
      }
    } catch (err) {
      console.warn(`[video-ingest] caption track fallback failed:`, err)
    }
  }

  return { videoTitle, durationSec, audioUrl, chapters, transcriptText, chapterTranscripts }
}

// ── Main pipeline ─────────────────────────────────────────────────────────────

export async function runVideoIngestion(params: {
  lessonId: string
  videoUrl?: string
  localFilePath?: string
  sourceLabel?: string
  title?: string
  audience?: string
  level?: string
}): Promise<void> {
  const { lessonId, videoUrl, localFilePath, sourceLabel, title, audience = 'General', level = 'beginner' } = params
  const sourceRef = localFilePath ?? videoUrl ?? 'unknown'
  console.log(`[video-ingest] Starting for lesson ${lessonId}, source=${sourceRef}`)

  try {
    // ── Step 1: Mark as generating ───────────────────────────────────────────
    await db.update(lessons)
      .set({ generationStatus: 'generating', updatedAt: new Date() })
      .where(eq(lessons.id, lessonId))

    // ── Step 2: Get transcript + chapters ─────────────────────────────────────
    const isLocalFile = !!localFilePath
    const isYouTube = !!videoUrl && /youtu\.be|youtube\.com/.test(videoUrl)
    let transcriptText = ''
    let chapters: Chapter[] = []
    let chapterTranscripts: Array<{ chapter: Chapter; text: string }> = []
    let videoTitle = 'Untitled Video'
    let durationHint = 0

    if (isLocalFile) {
      console.log(`[video-ingest] Transcribing uploaded file...`)
      const t0 = Date.now()
      const transcript = await assemblyai.transcripts.transcribe({ audio: localFilePath!, speech_models: ['universal-2'] })
      console.log(`[video-ingest] File transcription done in ${Date.now() - t0}ms, status=${transcript.status}`)
      if (transcript.status === 'error' || !transcript.text) {
        throw new Error(`AssemblyAI transcription failed: ${transcript.error ?? 'no text returned'}`)
      }
      transcriptText = transcript.text.replace(/\s+/g, ' ').trim().slice(0, MAX_TRANSCRIPT_CHARS)
      durationHint = transcript.audio_duration != null && transcript.audio_duration > 0
        ? Math.ceil(transcript.audio_duration)
        : estimateDurationFromTranscript(transcriptText)
      const whole: Chapter = {
        title: title || sourceLabel || 'Uploaded media',
        start_time: 0,
        end_time: durationHint,
      }
      chapters = [whole]
      chapterTranscripts = [{ chapter: whole, text: transcriptText }]
    } else if (isYouTube) {
      console.log(`[video-ingest] Fetching YouTube data (captions + chapters)...`)
      const t0 = Date.now()
      const data = await fetchYouTubeData(videoUrl)
      videoTitle = data.videoTitle
      durationHint = data.durationSec
      transcriptText = data.transcriptText
      chapters = data.chapters
      chapterTranscripts = data.chapterTranscripts
      console.log(`[video-ingest] YouTube data done in ${Date.now() - t0}ms, chapters=${chapters.length}, chars=${transcriptText.length}`)

      let usedAssemblyFallback = false
      if (transcriptText.length < MIN_TRANSCRIPT_CHARS) {
        console.log(
          `[video-ingest] YouTube transcript short/empty (${transcriptText.length} chars); trying AssemblyAI…`
        )
        const fallbackSource = data.audioUrl
        if (fallbackSource) {
          const aa = await transcribeVideoUrlWithAssemblyAI(fallbackSource)
          transcriptText = aa.text
          durationHint = Math.max(durationHint, aa.durationSec)
          usedAssemblyFallback = true
        } else {
          console.log('[video-ingest] No deciphered audio URL from youtubei; falling back to yt-dlp audio download…')
          const aa = await transcribeYouTubeViaYtDlp(videoUrl!)
          transcriptText = aa.text
          durationHint = Math.max(durationHint, aa.durationSec)
          usedAssemblyFallback = true
        }
      }

      const chapterTextTotal = () => chapterTranscripts.reduce((s, ct) => s + ct.text.length, 0)

      if (chapters.length > 0 && transcriptText.length >= MIN_TRANSCRIPT_CHARS) {
        if (usedAssemblyFallback || chapterTextTotal() < MIN_TRANSCRIPT_CHARS) {
          chapterTranscripts = distributeTranscriptAcrossChapters(chapters, transcriptText)
          console.log(
            `[video-ingest] Mapped transcript to ${chapters.length} chapter(s) (fallback=${usedAssemblyFallback}, per-chapter text was sparse)`
          )
        }
      }

      if (chapters.length === 0 && transcriptText.length >= MIN_TRANSCRIPT_CHARS) {
        const endTime =
          durationHint > 0 ? durationHint : estimateDurationFromTranscript(transcriptText)
        const whole: Chapter = { title: videoTitle, start_time: 0, end_time: endTime }
        chapters = [whole]
        chapterTranscripts = [{ chapter: whole, text: transcriptText }]
        console.log(`[video-ingest] No YouTube chapters in metadata; using single segment 0–${endTime}s`)
      }
    } else {
      if (!videoUrl) {
        throw new Error('No video URL or uploaded file provided for ingestion.')
      }
      console.log(`[video-ingest] Submitting to AssemblyAI...`)
      const t0 = Date.now()
      const transcript = await assemblyai.transcripts.transcribe({ audio: videoUrl, speech_models: ['universal-2'] })
      console.log(`[video-ingest] Transcription done in ${Date.now() - t0}ms, status=${transcript.status}`)
      if (transcript.status === 'error' || !transcript.text) {
        throw new Error(`AssemblyAI transcription failed: ${transcript.error ?? 'no text returned'}`)
      }
      transcriptText = transcript.text.slice(0, MAX_TRANSCRIPT_CHARS)
    }

    if (transcriptText.length < MIN_TRANSCRIPT_CHARS) {
      throw new Error(
        'No usable transcript for this video (YouTube captions unavailable and transcription did not return enough text).'
      )
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

    const outlineSystemPrompt = isLocalFile ? UPLOAD_OUTLINE_SYSTEM_PROMPT : OUTLINE_SYSTEM_PROMPT
    const sourceLine = isLocalFile ? `Uploaded file: ${sourceLabel ?? 'upload'}` : `Video URL: ${videoUrl}`
    const outlineMsg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: outlineSystemPrompt,
      messages: [{ role: 'user', content: `${sourceLine}\n${outlineUserContent}\n\nRespond with JSON only.` }],
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
      sourceLine,
      `Generate a Primr lesson from this outline:\n\n${JSON.stringify(outline, null, 2)}`,
      `\nChapter transcripts (use the matching chapterIndex for each block's content):\n${chapterTranscriptContext}`,
    ].join('\n\n')

    const lessonSystemPrompt = isLocalFile ? UPLOAD_LESSON_SYSTEM_PROMPT : LESSON_SYSTEM_PROMPT
    const lessonMsg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 16384,
      system: lessonSystemPrompt,
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
  } finally {
    if (localFilePath) {
      await rm(localFilePath, { force: true }).catch(() => {})
    }
  }
}
