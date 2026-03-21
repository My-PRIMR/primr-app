/**
 * POST /api/courses/parse
 * Accepts: one or more document files + optional YouTube URL.
 * Extracts source text from all inputs, sends to Claude for course structure,
 * slices text into per-lesson chunks, returns enriched CourseTree.
 */
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSession } from '@/session'
import { resolveModel, DEFAULT_MODEL, modelById } from '@/lib/models'
import type { ParsedCourseTree, CourseTree } from '@/types/course'
import { extractJSON } from '@/lib/extract-json'
import { fetchYouTubeData, type VideoChapter } from '@/lib/video-ingest'

const client = new Anthropic()

const PARSE_SYSTEM_PROMPT = `You are an expert curriculum designer. Analyze the provided source material and return a JSON course tree with 4 hierarchy levels: Course → Section → Chapter → Lesson.

Return this exact structure:
{
  "title": "Course title (inferred from content)",
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
              "headingMarker": "Exact heading or chapter title from the source that starts this lesson's content"
            }
          ]
        }
      ]
    }
  ]
}

Rules:
- If the source only has 2-3 levels, synthesize the missing levels. For example, if there are only chapters, create one section called "General" or another appropriate name and set "inferred": true on it.
- headingMarker must be an exact substring from the source text/chapter list that marks the beginning of that lesson's content.
- Each lesson should cover a coherent sub-topic (not too granular, not too broad). Aim for 10-30 lessons total.
- If video chapters are provided, use them as the primary structure — map each chapter to one or more lessons.
- Tailor content structure to the specified audience and level.
- If a Focus/Scope is provided, only include lessons relevant to that focus — omit anything outside it.
- Return ONLY valid JSON. No markdown fences, no explanation, no preamble. Start your response with { and end with }.`

async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  if (name.endsWith('.pdf')) {
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: buffer })
    const data = await parser.getText()
    return data.text
  } else if (name.endsWith('.docx')) {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  } else if (name.endsWith('.txt') || name.endsWith('.md')) {
    return buffer.toString('utf-8')
  }
  throw new Error(`Unsupported file type: ${file.name}. Use PDF, DOCX, TXT, or MD.`)
}

function sliceTextByMarkers(fullText: string, markers: string[]): string[] {
  return markers.map((marker, i) => {
    const nextMarker = markers[i + 1]
    const startIdx = fullText.indexOf(marker)
    if (startIdx === -1) return ''
    const endIdx = nextMarker ? fullText.indexOf(nextMarker, startIdx + 1) : -1
    const chunk = endIdx === -1 ? fullText.slice(startIdx) : fullText.slice(startIdx, endIdx)
    return chunk.slice(0, 8000).trim()
  })
}

function sliceByChapters(chapters: VideoChapter[], chapterTranscripts: Array<{ chapter: VideoChapter; text: string }>): Map<string, string> {
  const map = new Map<string, string>()
  for (const ct of chapterTranscripts) {
    map.set(ct.chapter.title, ct.text.slice(0, 8000).trim())
  }
  return map
}

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

    if (model) {
      const m = resolveModel(model, internalRole, productRole)
      if (!m) return NextResponse.json({ error: 'Unauthorized model selection' }, { status: 403 })
      resolvedModel = m
    }

    if (!files.length && !videoUrl) {
      return NextResponse.json({ error: 'Provide at least one document or a YouTube URL.' }, { status: 400 })
    }

    // ── Extract document text ─────────────────────────────────────────────────
    let docText = ''
    for (const file of files) {
      try {
        const text = (await extractTextFromFile(file)).trim()
        docText += (docText ? '\n\n---\n\n' : '') + `[Document: ${file.name}]\n${text}`
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : `Failed to read ${file.name}.`
        return NextResponse.json({ error: message }, { status: 400 })
      }
    }

    // ── Extract video transcript + chapters ───────────────────────────────────
    let videoData: Awaited<ReturnType<typeof fetchYouTubeData>> | null = null
    if (videoUrl) {
      try {
        videoData = await fetchYouTubeData(videoUrl)
      } catch (err) {
        console.error('[courses/parse] video fetch failed:', err)
        return NextResponse.json({ error: `Could not fetch video transcript: ${err instanceof Error ? err.message : 'unknown error'}` }, { status: 422 })
      }
    }

    // ── Build source excerpt for Claude ──────────────────────────────────────
    const MAX_EXCERPT = 12000
    const parts: string[] = []

    if (videoData) {
      const chapterList = videoData.chapters.map((ch, i) => `  ${i + 1}. "${ch.title}" (${ch.start_time}s–${ch.end_time}s)`).join('\n')
      parts.push(`[Video: ${videoData.videoTitle}]\nChapters:\n${chapterList}\n\nTranscript excerpt:\n${videoData.transcriptText.slice(0, 8000)}`)
    }

    if (docText) {
      const remaining = MAX_EXCERPT - parts.join('\n\n').length
      if (remaining > 500) parts.push(docText.slice(0, remaining))
    }

    const sourceExcerpt = parts.join('\n\n')
    if (!sourceExcerpt.trim()) {
      return NextResponse.json({ error: 'Could not extract any content from the provided sources.' }, { status: 422 })
    }

    // ── Ask Claude for course structure ───────────────────────────────────────
    console.log(`[courses/parse] using model: ${resolvedModel.id}, video=${!!videoData}, docs=${files.length}`)
    const t0 = Date.now()
    const message = await client.messages.create({
      model: resolvedModel.id,
      max_tokens: 16384,
      system: PARSE_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          `Source material:\n"""\n${sourceExcerpt}\n"""`,
          `Audience: ${audience}`,
          `Level: ${level}`,
          focus ? `Focus/Scope: ${focus} — only include lessons relevant to this focus.` : '',
          videoData ? `Use the video chapters listed above as the primary lesson structure. Each chapter should map to at least one lesson. Use the chapter title as the headingMarker for lessons derived from that chapter.` : '',
          `Respond with JSON only.`,
        ].filter(Boolean).join('\n'),
      }],
    })
    console.log(`[courses/parse] Claude responded in ${Date.now() - t0}ms`)

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    let parsed: ParsedCourseTree
    try {
      parsed = JSON.parse(extractJSON(raw))
    } catch {
      console.error('[courses/parse] JSON parse failed. Raw:', raw)
      return NextResponse.json({ error: 'AI returned invalid JSON', raw }, { status: 500 })
    }

    // ── Build per-lesson source text ──────────────────────────────────────────
    const allMarkers = parsed.sections.flatMap(s => s.chapters.flatMap(c => c.lessons.map(l => l.headingMarker)))

    // For video: build chapter→transcript map for fast lookup
    const chapterTranscriptMap = videoData
      ? sliceByChapters(videoData.chapters, videoData.chapterTranscripts)
      : new Map<string, string>()

    // For docs: slice by heading markers
    const docChunks = docText ? sliceTextByMarkers(docText, allMarkers) : allMarkers.map(() => '')

    // ── Build enriched CourseTree ─────────────────────────────────────────────
    let markerIdx = 0
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
            const marker = lesson.headingMarker
            // Prefer video chapter transcript if the marker matches a chapter title
            const videoChunk = chapterTranscriptMap.get(marker) || ''
            const docChunk = docChunks[markerIdx] || ''
            markerIdx++

            // Combine: video chapter transcript + doc slice (if both present)
            const sourceText = [videoChunk, docChunk].filter(Boolean).join('\n\n---\n\n').slice(0, 10000)

            return {
              localId: `s${si}c${ci}l${li}`,
              title: lesson.title,
              sourceText,
              audience,
              level,
              focus: focus || undefined,
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
