/**
 * Shared lesson content generation utility.
 *
 * Single source of truth for the outline-based lesson generation step used by
 * both the standalone lesson wizard (app/api/lessons/generate/route.ts) and
 * course generation (src/lib/course-gen.ts).
 */
import { generateText } from 'ai'
import { resolveModelRef, buildSystemPrompt } from '@/lib/ai/providers'
import { extractJSON } from '@/lib/extract-json'
import { db } from '@/db'
import { lessons } from '@/db/schema'
import { DEFAULT_MODEL } from '@/lib/models'
import { BLOCK_SCHEMAS, PASSIVE_LESSON_OVERRIDE } from '@/lib/block-schemas'
import { enrichWithPexelsImages, IMAGE_PROMPT_SNIPPET } from '@/lib/pexels'
import type { LessonManifest } from '@primr/components'
import type { LessonOutline, DocumentAsset } from '@/types/outline'
import { LESSON_GEN_SYSTEM_PROMPT_TEMPLATE } from '@/lib/prompts/lesson-gen-system'

// ── System prompt ─────────────────────────────────────────────────────────────

const OUTLINE_LESSON_SYSTEM_PROMPT = LESSON_GEN_SYSTEM_PROMPT_TEMPLATE.replace(
  '${BLOCK_SCHEMAS}',
  () => BLOCK_SCHEMAS
)

// ── Helpers ───────────────────────────────────────────────────────────────────

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export function buildAssetPromptSection(assets: DocumentAsset[]): string {
  if (!assets.length) return ''
  const lines = assets.map(a => {
    if (a.type === 'video') return `- [video] Page ${a.page}: ${a.url} — YouTube video found in document`
    if (a.type === 'image') return `- [image] Page ${a.page}: ${a.url} — visual content extracted from page`
    return `- [link] Page ${a.page}: ${a.url} — hyperlink found in document`
  })
  return `\n\nDocument assets — incorporate these into the lesson where contextually appropriate:\n` +
    `For video assets, create a 'media' block with the url field set to the YouTube URL.\n` +
    `For image assets, add an image field to a relevant narrative block: "image": { "src": "<url>", "alt": "<description>", "caption": "<optional caption>" }.\n` +
    lines.join('\n')
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function generateLessonFromOutline(params: {
  outline: LessonOutline
  documentText?: string
  topic?: string
  documentAssets?: DocumentAsset[]
  focus?: string
  model?: string
  passiveLesson?: boolean
  skipHero?: boolean
  includeImages?: boolean
  videoUrl?: string
  videoStartTime?: number
  videoEndTime?: number
  userId: string | null
  signal?: AbortSignal
}): Promise<{ lessonId: string; manifest: LessonManifest }> {
  // Build system prompt
  let systemPrompt = OUTLINE_LESSON_SYSTEM_PROMPT
  if (params.passiveLesson) {
    systemPrompt += PASSIVE_LESSON_OVERRIDE
  }
  if (params.skipHero) {
    systemPrompt += '\n\nIMPORTANT: Do NOT generate a hero block. The outline may list one — skip it. Start directly with the second block.'
  }
  if (params.includeImages) {
    systemPrompt += IMAGE_PROMPT_SNIPPET
  }

  // Build video line
  const videoLine = params.videoUrl
    ? `\n\nVideo URL: ${params.videoUrl}${params.videoStartTime != null ? ` (start: ${params.videoStartTime}s` : ''}${params.videoEndTime != null ? `, end: ${params.videoEndTime}s)` : (params.videoStartTime != null ? ')' : '')} — use this URL in any media block props`
    : ''

  // Build user message
  const userMessage = [
    params.topic?.trim() ? `Creator's intent: ${params.topic}\n` : '',
    `Generate a Primr lesson from this outline:\n\n${JSON.stringify(params.outline, null, 2)}`,
    params.focus?.trim() ? `\n\nFocus/Scope: ${params.focus.trim()} — only include content relevant to this focus.` : '',
    videoLine,
    params.documentText?.trim()
      ? `\n\nSource document (use this as the primary source for all content — do not invent material not present in this document):\n"""\n${params.documentText}\n"""`
      : '',
    params.documentAssets?.length ? buildAssetPromptSection(params.documentAssets) : '',
    '\n\nRespond with JSON only.',
  ].join('')

  // Call Claude
  const modelId = params.model ?? DEFAULT_MODEL
  const { text: raw } = await generateText({
    model: resolveModelRef(modelId),
    maxOutputTokens: 16384,
    system: buildSystemPrompt(systemPrompt, modelId),
    prompt: userMessage,
    abortSignal: params.signal,
  })
  let manifest: LessonManifest
  try {
    manifest = JSON.parse(extractJSON(raw))
  } catch (err) {
    console.error('[lesson-gen] JSON parse failed:', err)
    console.error('[lesson-gen] full raw response:\n' + raw)
    throw err
  }

  if (params.includeImages) {
    await enrichWithPexelsImages(manifest, process.env.PEXELS_API_KEY ?? '')
  }

  const slug = `${slugify(manifest.slug || manifest.title)}-${Math.random().toString(36).slice(2, 7)}`
  manifest.slug = slug

  const [lesson] = await db.insert(lessons).values({
    slug,
    title: manifest.title,
    manifest,
    createdBy: params.userId,
  }).returning()

  return { lessonId: lesson.id, manifest }
}
