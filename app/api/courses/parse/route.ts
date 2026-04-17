/**
 * POST /api/courses/parse
 * Accepts: one or more document files + optional YouTube URL + structureSource.
 *
 * structureSource = 'document' (default when docs present):
 *   Course structure derived from the document. Claude also annotates each lesson
 *   with the most relevant videoChapterIndex so video transcript is included as
 *   supplementary sourceText.
 *
 * structureSource = 'video' (default when only URL present):
 *   Course structure derived from video chapters. Claude annotates each lesson
 *   with an optional docMarker so document text is included as supplementary.
 */
import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { resolveModelRef } from '@/lib/ai/providers'
import { getSession } from '@/session'
import { resolveModel, DEFAULT_MODEL, modelById } from '@/lib/models'
import { extractJSON } from '@/lib/extract-json'
import type { ParsedCourseTree, CourseTree } from '@/types/course'
import { fetchYouTubeData } from '@/lib/video-ingest'
import { extractTocSection, sliceTextByMarker } from '@primr/components'
import { TOC_SYSTEM_PROMPT_TEMPLATE } from '@/lib/prompts/toc-system'

// ── System prompts ────────────────────────────────────────────────────────────

function makeDocDrivesPrompt(hasVideo: boolean): string {
  const videoAnnotation = hasVideo
    ? `\n      "videoChapterIndex": number | null  — 0-based index of the most relevant video chapter for this lesson, or null if none`
    : ''
  const videoRule = hasVideo
    ? `\n- For each lesson, set videoChapterIndex to the 0-based index of the video chapter whose content best supplements this lesson. Set null if no chapter is relevant.`
    : ''

  return TOC_SYSTEM_PROMPT_TEMPLATE
    .replace('${videoAnnotation}', () => videoAnnotation)
    .replace('${videoRule}', () => videoRule)
}

function makeVideoDrivesPrompt(hasDoc: boolean): string {
  const docAnnotation = hasDoc
    ? `\n      "docMarker": string | null  — exact heading/substring from the document most relevant to this lesson, or null`
    : ''
  const docRule = hasDoc
    ? `\n- For each lesson, set docMarker to an exact substring from the document that provides the most relevant supplementary content. Set null if nothing matches.`
    : ''

  return `You are an expert curriculum designer. Analyze the provided video chapters and return a JSON course tree derived from the video structure.

Return this exact structure:
{
  "title": "Course title",
  "description": "1-2 sentence course description",
  "sections": [
    {
      "title": "Section title",
      "inferred": false,
      "chapters": [
        {
          "title": "Chapter title",
          "lessons": [
            {
              "title": "Lesson title",
              "headingMarker": "Exact video chapter title this lesson is derived from"${docAnnotation}
            }
          ]
        }
      ]
    }
  ]
}

Rules:
- Each video chapter should map to at least one lesson. Use the chapter title as the headingMarker.
- If the video has no chapters, create one lesson per major topic from the transcript.
- If the source only has 2-3 levels, synthesize the missing levels (set "inferred": true).
- If the source has explicit lesson-level structure (e.g. chapters or numbered topics that clearly map 1:1 to lessons), create one lesson per such unit — do not cap the count. Otherwise aim for 10-30 lessons total.
- Tailor to the specified audience and level.
- If a Focus/Scope is provided, only include lessons relevant to that focus — skip chapters outside scope.${docRule}
- Return ONLY valid JSON. No markdown fences, no explanation. Start with { and end with }.`
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  if (name.endsWith('.pdf')) {
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: buffer })
    return (await parser.getText()).text
  } else if (name.endsWith('.docx')) {
    const mammoth = await import('mammoth')
    return (await mammoth.extractRawText({ buffer })).value
  } else if (name.endsWith('.txt') || name.endsWith('.md')) {
    return buffer.toString('utf-8')
  }
  throw new Error(`Unsupported file type: ${file.name}. Use PDF, DOCX, TXT, or MD.`)
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const internalRole = session.user.internalRole ?? null
  const productRole = session.user.productRole ?? null
  let resolvedModel = modelById(DEFAULT_MODEL)!

  try {
    const formData = await req.formData()
    const files = formData.getAll('file').filter((f): f is File => f instanceof File && f.size > 0)
    const videoUrl = (formData.get('videoUrl') as string | null)?.trim() || ''
    const audience = (formData.get('audience') as string | null) || 'General'
    const level = (formData.get('level') as string | null) || 'beginner'
    const focus = (formData.get('focus') as string | null) || ''
    const model = (formData.get('model') as string | null) || undefined
    const structureSourceRaw = (formData.get('structureSource') as string | null) || 'auto'
    const rawText = (formData.get('text') as string | null)?.trim() || ''

    if (model) {
      const m = resolveModel(model, internalRole, productRole)
      if (!m) return NextResponse.json({ error: 'Unauthorized model selection' }, { status: 403 })
      resolvedModel = m
    }

    if (!files.length && !videoUrl && !rawText) {
      return NextResponse.json({ error: 'Provide at least one document, paste text, or a YouTube URL.' }, { status: 400 })
    }

    if (rawText && files.length > 0) {
      return NextResponse.json({ error: 'Provide either pasted text or file uploads, not both.' }, { status: 400 })
    }

    // Determine structure source
    const hasDoc = files.length > 0 || !!rawText
    const hasVideo = !!videoUrl
    const structureSource: 'document' | 'video' =
      structureSourceRaw === 'video' ? 'video'
      : structureSourceRaw === 'document' ? 'document'
      : hasDoc ? 'document'   // auto: prefer document when present
      : 'video'

    // ── Extract document text ────────────────────────────────────────────────
    let docText = rawText
    if (!rawText) {
      for (const file of files) {
        try {
          const text = (await extractTextFromFile(file)).trim()
          docText += (docText ? '\n\n---\n\n' : '') + `[Document: ${file.name}]\n${text}`
        } catch (err: unknown) {
          return NextResponse.json({ error: err instanceof Error ? err.message : `Failed to read ${file.name}.` }, { status: 400 })
        }
      }
    }

    // ── Extract video transcript + chapters ──────────────────────────────────
    let videoData: Awaited<ReturnType<typeof fetchYouTubeData>> | null = null
    if (videoUrl) {
      try {
        videoData = await fetchYouTubeData(videoUrl)
      } catch (err) {
        return NextResponse.json({
          error: `Could not fetch video transcript: ${err instanceof Error ? err.message : 'unknown error'}`
        }, { status: 422 })
      }
    }

    // ── Build Claude prompt ───────────────────────────────────────────────────
    const systemPrompt = structureSource === 'document'
      ? makeDocDrivesPrompt(hasVideo)
      : makeVideoDrivesPrompt(hasDoc)

    const userParts: string[] = []

    // Attempt TOC extraction for document-driven parses. When a TOC is found,
    // sending just the TOC section yields much more accurate structure than
    // sending 200K chars of mixed TOC + content. Falls back to full doc otherwise.
    let tocUsed = false
    if (structureSource === 'document') {
      const tocSection = extractTocSection(docText)
      if (tocSection) {
        tocUsed = true
        userParts.push(`Table of Contents section (use this as the definitive structure):\n"""\n${tocSection}\n"""`)
      } else {
        userParts.push(`Document:\n"""\n${docText.slice(0, 200000)}\n"""`)
      }
      if (videoData) {
        const chapterList = videoData.chapters.map((ch, i) => `  ${i}: "${ch.title}"`).join('\n')
        userParts.push(`Video chapters (for videoChapterIndex annotation):\n${chapterList}`)
      }
    } else {
      if (videoData) {
        const chapterList = videoData.chapters.map((ch, i) => `  ${i}: "${ch.title}" (${ch.start_time}s–${ch.end_time}s)`).join('\n')
        userParts.push(`Video: ${videoData.videoTitle}\nChapters:\n${chapterList}\n\nTranscript excerpt:\n${videoData.transcriptText.slice(0, 8000)}`)
      }
      if (docText) {
        userParts.push(`Document (for docMarker annotation):\n"""\n${docText.slice(0, 4000)}\n"""`)
      }
    }

    userParts.push(
      `Audience: ${audience}`,
      `Level: ${level}`,
      focus ? `Focus/Scope: ${focus}` : '',
      'Respond with JSON only.',
    )

    console.log(`[courses/parse] model=${resolvedModel.id} structureSource=${structureSource} tocUsed=${tocUsed} video=${hasVideo} docs=${files.length} rawText=${!!rawText}`)
    const t0 = Date.now()
    let parsed: {
      title: string; description: string;
      sections: Array<{
        title: string; inferred: boolean;
        chapters: Array<{
          title: string;
          lessons: Array<{ title: string; headingMarker: string; videoChapterIndex?: number | null; docMarker?: string | null }>
        }>
      }>
    }
    const { text: raw, finishReason, usage } = await generateText({
      model: resolveModelRef(resolvedModel.id),
      maxOutputTokens: 32000,
      system: systemPrompt,
      prompt: userParts.filter(Boolean).join('\n\n'),
    })
    console.log(`[courses/parse] AI responded in ${Date.now() - t0}ms model=${resolvedModel.id} finishReason=${finishReason} outputTokens=${usage.outputTokens}`)

    try {
      parsed = JSON.parse(extractJSON(raw))
    } catch {
      console.error('[courses/parse] JSON parse failed. Raw:', raw.slice(0, 2000))
      return NextResponse.json({ error: 'AI returned invalid JSON', raw }, { status: 500 })
    }

    const lessonCount = parsed.sections.reduce((sum, s) => sum + s.chapters.reduce((cs, c) => cs + c.lessons.length, 0), 0)
    console.log(`[courses/parse] Parsed ${lessonCount} lessons across ${parsed.sections.length} sections`)

    // ── Build all heading markers list (for sliceTextByMarker next-marker lookup) ──
    const allDocMarkers = parsed.sections.flatMap(s =>
      s.chapters.flatMap(c =>
        c.lessons.map(l => structureSource === 'document' ? l.headingMarker : (l.docMarker ?? null))
      )
    ).filter((m): m is string => !!m)

    // ── Build video chapter transcript map ───────────────────────────────────
    const chapterTranscripts = videoData?.chapterTranscripts ?? []

    // ── Build enriched CourseTree ─────────────────────────────────────────────
    let lessonGlobalIdx = 0
    const courseTree: CourseTree = {
      title: parsed.title,
      description: parsed.description,
      sections: parsed.sections.map((section, si) => ({
        localId: `s${si}`,
        title: section.title,
        inferred: section.inferred,
        chapters: section.chapters.map((chapter, ci) => ({
          localId: `s${si}c${ci}`,
          title: chapter.title,
          lessons: chapter.lessons.map((lesson, li) => {
            const idx = lessonGlobalIdx++

            let docChunk = ''
            let videoChunk = ''
            let lessonVideoUrl: string | undefined
            let lessonVideoStart: number | undefined
            let lessonVideoEnd: number | undefined

            if (structureSource === 'document') {
              // Primary: doc slice by headingMarker
              const nextDocMarker = allDocMarkers[idx + 1]
              docChunk = sliceTextByMarker(docText, lesson.headingMarker, nextDocMarker)

              // Supplementary: video chapter by annotated index
              const vci = lesson.videoChapterIndex
              if (vci != null && chapterTranscripts[vci]) {
                videoChunk = chapterTranscripts[vci].text.slice(0, 5000)
                lessonVideoUrl = videoUrl || undefined
                lessonVideoStart = videoData?.chapters[vci]?.start_time
                lessonVideoEnd = videoData?.chapters[vci]?.end_time
              }
            } else {
              // Primary: video chapter transcript by headingMarker (= chapter title)
              const ct = chapterTranscripts.find(c => c.chapter.title === lesson.headingMarker)
              videoChunk = ct ? ct.text.slice(0, 6000) : ''
              if (ct) {
                lessonVideoUrl = videoUrl || undefined
                lessonVideoStart = ct.chapter.start_time
                lessonVideoEnd = ct.chapter.end_time
              }

              // Supplementary: doc slice by annotated docMarker
              if (lesson.docMarker && docText) {
                const nextDocMarker = allDocMarkers[allDocMarkers.indexOf(lesson.docMarker) + 1]
                docChunk = sliceTextByMarker(docText, lesson.docMarker, nextDocMarker)
              }
            }

            const sourceText = [docChunk, videoChunk].filter(Boolean).join('\n\n---\n\n').slice(0, 10000)

            return {
              localId: `s${si}c${ci}l${li}`,
              title: lesson.title,
              sourceText,
              audience,
              level,
              focus: focus || undefined,
              videoUrl: lessonVideoUrl,
              videoStartTime: lessonVideoStart,
              videoEndTime: lessonVideoEnd,
            }
          }),
        })),
      })),
    }

    return NextResponse.json({ courseTree })
  } catch (err) {
    console.error('[courses/parse] error:', err)
    return NextResponse.json({ error: 'Failed to parse sources.' }, { status: 500 })
  }
}
