import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { resolveModelRef, buildSystemPrompt } from '@/lib/ai/providers'
import { extractJSON } from '@/lib/extract-json'
import { db } from '@/db'
import { lessons } from '@/db/schema'
import { getSession } from '@/session'
import { resolveModel, modelById, canSelectModels, canUseRichIngest, canUsePexels, canUseStemGeneration } from '@/lib/models'
import type { ContentType } from '@/lib/content-type'
import { CONTENT_TYPES, isAcademicContentType, STEM_LESSON_GEN_OVERRIDE } from '@/lib/content-type'
import { getDefaultModel } from '@/lib/default-model'
import { checkMonthlyCap, logUsage } from '@/lib/usage-cap'
import type { PlanValue } from '@/plans'
import { BLOCK_SCHEMAS } from '@primr/components/lib'
import { enrichWithPexelsImages, IMAGE_PROMPT_SNIPPET } from '@/lib/pexels'
import type { LessonManifest } from '@primr/components'
import type { LessonOutline } from '@/types/outline'
import type { DocumentAsset } from '@/types/outline'
import { generateLessonFromOutline, slugify, buildAssetPromptSection } from '@/lib/lesson-gen'

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
- SOURCE QUOTES: For every quiz/exam question, flashcard card, and fill-in-the-blank prompt, populate the \`sourceQuote\` field with a direct verbatim excerpt (≤ 2 sentences, copied exactly) from the immediately preceding narrative block that proves where the item was derived from. If no preceding narrative block exists, omit the field.
- Return ONLY valid JSON. No explanation, no markdown fences, no extra text, no preamble. Start your response with { and end with }.`
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
  const contentTypeRaw: string | undefined = body.contentType
  const contentType: ContentType = (contentTypeRaw && CONTENT_TYPES.includes(contentTypeRaw as ContentType))
    ? (contentTypeRaw as ContentType)
    : 'general'

  if (!outline && !topic?.trim() && !documentText?.trim()) {
    return NextResponse.json({ error: 'A topic or source document is required.' }, { status: 400 })
  }

  const internalRole = session?.user?.internalRole ?? null
  const productRole = session?.user?.productRole ?? null
  const plan = session?.user?.plan ?? null

  if (documentAssets?.length && !canUseRichIngest(plan, internalRole)) {
    return NextResponse.json({ error: 'Document asset ingestion requires Creator Pro or higher.' }, { status: 403 })
  }

  if (isAcademicContentType(contentType) && !canUseStemGeneration(plan, internalRole)) {
    return NextResponse.json({ error: 'Academic content types require Creator Teacher plan or higher.' }, { status: 403 })
  }

  let resolvedModel = modelById(await getDefaultModel())!
  if (model) {
    const m = resolveModel(model, internalRole, productRole, plan)
    if (!m) return NextResponse.json({ error: 'Unauthorized model selection' }, { status: 403 })
    resolvedModel = m
  }

  if (userId) {
    const { allowed, cap, used, resetsAt } = await checkMonthlyCap(
      userId,
      resolvedModel.id,
      (plan as PlanValue) ?? 'free',
      internalRole,
    )
    if (!allowed) {
      return NextResponse.json({
        error: 'Monthly generation limit reached',
        cap,
        used,
        resetsAt: resetsAt.toISOString(),
        upgradeUrl: '/upgrade',
      }, { status: 429 })
    }
  }

  const isOutlineBased = !!outline
  const blockRange = blockCountRange(documentText)

  console.log(`[generate] mode: ${isOutlineBased ? 'outline' : 'legacy'}`)
  const t0 = Date.now()

  let id: string
  let manifest: LessonManifest

  if (isOutlineBased) {
    // Outline-based path — delegate to shared utility
    const result = await generateLessonFromOutline({
      outline: outline!,
      documentText,
      topic,
      documentAssets,
      model: resolvedModel.id,
      passiveLesson: passiveLesson && canSelectModels(internalRole, productRole),
      includeImages: includeImages && canUsePexels(plan, internalRole),
      contentType,
      userId,
      signal: req.signal,
    })
    id = result.lessonId
    manifest = result.manifest
  } else {
    // Legacy (topic-only) path — inline generation
    let systemPrompt = buildLegacySystemPrompt(blockRange)

    if (passiveLesson && canSelectModels(internalRole, productRole)) {
      systemPrompt += '\n\nIMPORTANT: Generate only informational content blocks (text, heading, narrative, step-navigator, hero, callout). Do not include any interactive or assessment blocks (quiz, flashcard, fill-in-the-blank, or similar). The lesson should be purely informational — no questions, no exercises.'
    }

    if (isAcademicContentType(contentType)) {
      systemPrompt += STEM_LESSON_GEN_OVERRIDE
    }

    if (includeImages && canSelectModels(internalRole, productRole)) {
      systemPrompt += IMAGE_PROMPT_SNIPPET
    }

    const userMessage = [
      title?.trim() ? `Lesson title: "${title}"\n` : '',
      topic?.trim() ? `Create a Primr lesson about: ${topic}` : 'Create a Primr lesson from the provided source document.',
      documentText?.trim() ? `\n\nSource document (use this as the primary source for all content, facts, and questions — do not invent material not present in this document):\n"""\n${documentText}\n"""` : '',
      documentAssets?.length ? buildAssetPromptSection(documentAssets) : '',
    ].join('')

    const { text: raw } = await generateText({
      model: resolveModelRef(resolvedModel.id),
      maxOutputTokens: 16384,
      system: buildSystemPrompt(systemPrompt, resolvedModel.id),
      prompt: userMessage + '\n\nRespond with JSON only.',
    })

    console.log(`[generate] responded in ${Date.now() - t0}ms`)

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
    id = lesson.id
  }

  if (userId) {
    await logUsage(userId, 'standalone_lesson', resolvedModel.id)
  }

  return NextResponse.json({ id, manifest })
}
