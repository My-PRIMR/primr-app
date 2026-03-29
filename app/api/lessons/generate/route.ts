import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { extractJSON } from '@/lib/extract-json'
import { db } from '@/db'
import { lessons } from '@/db/schema'
import { getSession } from '@/session'
import { resolveModel, DEFAULT_MODEL, modelById, canSelectModels, canUseRichIngest, canUsePexels } from '@/lib/models'
import { checkCap, logUsage } from '@/lib/usage-cap'
import { BLOCK_SCHEMAS } from '@/lib/block-schemas'
import { enrichWithPexelsImages, IMAGE_PROMPT_SNIPPET } from '@/lib/pexels'
import type { LessonManifest } from '@primr/components'
import type { LessonOutline } from '@/types/outline'
import type { DocumentAsset } from '@/types/outline'

const client = new Anthropic()

/**
 * Returns a target block count range based on source document length.
 * Topic-only lessons (no document) get a smaller fixed range.
 *
 * TODO (Option B): consider removing the upper limit entirely and instructing
 * the AI to cover ALL content without compression — risky due to JSON truncation
 * at the 16k token output limit for very long documents.
 */
function blockCountRange(documentText?: string): string {
  if (!documentText?.trim()) return '6–10'
  const wordCount = documentText.trim().split(/\s+/).length
  if (wordCount < 500)  return '6–8'
  if (wordCount < 1500) return '8–12'
  if (wordCount < 3000) return '12–18'
  return '18–24'
}

function buildLegacySystemPrompt(blockRange: string): string {
  return `You are an expert instructional designer. Given a topic, generate a complete Primr lesson as a JSON object.

Return this structure:
{
  "id": "kebab-case-id",
  "title": "Lesson Title",
  "slug": "kebab-case-slug",
  "blocks": [{ "id": "block-id", "type": "block-type", "props": { ... } }]
}

${BLOCK_SCHEMAS}

Rules:
- Always start with a 'hero' block
- Include ${blockRange} blocks total mixing narrative, step-navigator, quiz, flashcard, or fill-in-the-blank
- If a source document is provided, distribute blocks proportionally across ALL sections of the document — do not stop early or skip later content
- Always end with one "exam" block — a comprehensive final assessment covering the full lesson
- Body/prompt fields support markdown: **bold**, *italic*, __underline__, \`code\`, and links
- Narrative body max ~200 words, quiz explanations max ~40 words, step body max ~120 words
- Flashcard decks: max 8 cards. Quiz: max 6 questions. Step-navigator: max 6 steps. Exam: 5–12 questions spanning the whole lesson.
- Return ONLY valid JSON. No explanation, no markdown fences, no extra text, no preamble. Start your response with { and end with }.`
}

function buildOutlineSystemPrompt(blockRange: string): string {
  return `You are an expert instructional designer. Generate a complete Primr lesson as JSON from the provided outline. Each block in the outline specifies a type, summary of what it should cover, and optionally an item count.

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
- The outline targets ${blockRange} blocks — cover content proportionally, do not skip later sections
- Always end with one "exam" block — a comprehensive final assessment covering the full lesson
- Tailor content to the specified audience and level
- Body/prompt fields support markdown: **bold**, *italic*, __underline__, \`code\`, and links
- Narrative body max ~200 words, quiz explanations max ~40 words, step body max ~120 words
- Flashcard decks: max 8 cards. Quiz: max 6 questions. Step-navigator: max 6 steps. Exam: 5–12 questions spanning the whole lesson.
- Return ONLY valid JSON. No explanation, no markdown fences, no extra text, no preamble. Start your response with { and end with }.`
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function buildAssetPromptSection(assets: DocumentAsset[]): string {
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

export async function POST(req: NextRequest) {
  const session = await getSession()
  const userId = session?.user?.id ?? null

  const body = await req.json()
  const outline: LessonOutline | undefined = body.outline
  const title: string | undefined = body.title
  const topic: string | undefined = body.topic
  const documentText: string | undefined = body.documentText
  const model: string | undefined = body.model
  const passiveLesson: boolean | undefined = body.passiveLesson
  const includeImages: boolean | undefined = body.includeImages
  const documentAssets: DocumentAsset[] | undefined = body.documentAssets

  if (!outline && !topic?.trim() && !documentText?.trim()) {
    return NextResponse.json({ error: 'A topic or source document is required.' }, { status: 400 })
  }

  const internalRole = session?.user?.internalRole ?? null
  const productRole = session?.user?.productRole ?? null
  const plan = session?.user?.plan ?? null

  if (documentAssets?.length && !canUseRichIngest(plan, internalRole)) {
    return NextResponse.json({ error: 'Document asset ingestion requires Creator Pro or higher.' }, { status: 403 })
  }

  let resolvedModel = modelById(DEFAULT_MODEL)!
  if (model) {
    const m = resolveModel(model, internalRole, productRole)
    if (!m) return NextResponse.json({ error: 'Unauthorized model selection' }, { status: 403 })
    resolvedModel = m
  }

  if (userId) {
    const { allowed } = await checkCap(userId, resolvedModel.id)
    if (!allowed) {
      const resetAt = new Date()
      resetAt.setUTCHours(24, 0, 0, 0)
      return NextResponse.json({ error: 'Daily generation limit reached', resetAt: resetAt.toISOString() }, { status: 429 })
    }
  }

  const isOutlineBased = !!outline
  const blockRange = blockCountRange(documentText)
  let systemPrompt = isOutlineBased ? buildOutlineSystemPrompt(blockRange) : buildLegacySystemPrompt(blockRange)

  if (passiveLesson && canSelectModels(internalRole, productRole)) {
    systemPrompt += '\n\nIMPORTANT: Generate only informational content blocks (text, heading, narrative, step-navigator, hero, callout). Do not include any interactive or assessment blocks (quiz, flashcard, fill-in-the-blank, or similar). The lesson should be purely informational — no questions, no exercises.'
  }

  if (includeImages && canSelectModels(internalRole, productRole)) {
    systemPrompt += IMAGE_PROMPT_SNIPPET
  }

  const userMessage = isOutlineBased
    ? [
        topic?.trim() ? `Creator's intent: ${topic}\n` : '',
        `Generate a Primr lesson from this outline:\n\n${JSON.stringify(outline, null, 2)}`,
        documentText?.trim() ? `\n\nSource document (use this as the primary source for all content, facts, and questions — do not invent material not present in this document):\n"""\n${documentText}\n"""` : '',
        documentAssets?.length ? buildAssetPromptSection(documentAssets) : '',
      ].join('')
    : [
        title?.trim() ? `Lesson title: "${title}"\n` : '',
        topic?.trim() ? `Create a Primr lesson about: ${topic}` : 'Create a Primr lesson from the provided source document.',
        documentText?.trim() ? `\n\nSource document (use this as the primary source for all content, facts, and questions — do not invent material not present in this document):\n"""\n${documentText}\n"""` : '',
        documentAssets?.length ? buildAssetPromptSection(documentAssets) : '',
      ].join('')

  console.log(`[generate] mode: ${isOutlineBased ? 'outline' : 'legacy'}`)
  const t0 = Date.now()

  const message = await client.messages.create({
    model: resolvedModel.id,
    max_tokens: 16384,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage + '\n\nRespond with JSON only.' }],
  })

  console.log(`[generate] responded in ${Date.now() - t0}ms, usage: ${JSON.stringify(message.usage)}`)

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''

  let manifest: LessonManifest
  try {
    manifest = JSON.parse(extractJSON(raw))
    console.log(`[generate] parsed manifest: id=${manifest.id}, blocks=${manifest.blocks.length}`)
  } catch (err) {
    console.error(`[generate] JSON parse failed:`, err)
    console.error(`[generate] full raw response:\n${raw}`)
    return NextResponse.json({ error: 'AI returned invalid JSON', raw }, { status: 500 })
  }

  if (includeImages && canUsePexels(plan, internalRole)) {
    await enrichWithPexelsImages(manifest, process.env.PEXELS_API_KEY ?? '')
  }

  const slug = `${slugify(manifest.slug || manifest.title)}-${Math.random().toString(36).slice(2, 7)}`
  manifest.slug = slug

  const t1 = Date.now()
  const [lesson] = await db.insert(lessons).values({
    slug,
    title: manifest.title,
    manifest,
    createdBy: userId,
  }).returning()
  console.log(`[generate] saved to DB in ${Date.now() - t1}ms, id=${lesson.id}`)

  if (userId) {
    await logUsage(userId, 'standalone_lesson', resolvedModel.id)
  }

  return NextResponse.json({ id: lesson.id, manifest })
}
