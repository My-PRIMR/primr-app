/**
 * POST /api/courses/parse
 * Accept file upload → extract full text → send first 12k chars to Claude
 * to get course structure → slice full text by heading markers → return tree.
 */
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSession } from '@/session'
import type { ParsedCourseTree, CourseTree } from '@/types/course'
import { extractJSON } from '@/lib/extract-json'

const client = new Anthropic()

const PARSE_SYSTEM_PROMPT = `You are an expert curriculum designer. Analyze the provided document excerpt and return a JSON course tree with 4 hierarchy levels: Course → Section → Chapter → Lesson.

Return this exact structure:
{
  "title": "Course title (inferred from document)",
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
              "headingMarker": "Exact heading text from the document that starts this lesson's content"
            }
          ]
        }
      ]
    }
  ]
}

Rules:
- If the document only has 2-3 levels, synthesize the missing levels. For example, if there are only chapters (no sections), create one section called "General" or another appropriate name and set "inferred": true on it.
- headingMarker must be an exact substring from the document text that marks the beginning of that lesson's content (typically a heading like "1.2 Introduction" or "Chapter 3: ...").
- Each lesson should cover a coherent sub-topic (not too granular, not too broad). Aim for 10-30 lessons total for a full document.
- Return ONLY valid JSON. No markdown fences, no explanation, no preamble. Start your response with { and end with }.`

async function extractText(file: File): Promise<string> {
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
  throw new Error('Unsupported file type. Use PDF, DOCX, TXT, or MD.')
}

function sliceTextByMarkers(fullText: string, markers: string[]): string[] {
  const chunks: string[] = []

  for (let i = 0; i < markers.length; i++) {
    const startMarker = markers[i]
    const nextMarker = markers[i + 1]

    const startIdx = fullText.indexOf(startMarker)
    if (startIdx === -1) {
      // Marker not found — return empty chunk; generation will use title only
      chunks.push('')
      continue
    }

    const endIdx = nextMarker ? fullText.indexOf(nextMarker, startIdx + 1) : -1
    const chunk = endIdx === -1
      ? fullText.slice(startIdx)
      : fullText.slice(startIdx, endIdx)

    // Cap each chunk at 8000 chars to keep context manageable
    chunks.push(chunk.slice(0, 8000).trim())
  }

  return chunks
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const audience = (formData.get('audience') as string | null) || 'General'
    const level = (formData.get('level') as string | null) || 'beginner'
    const focus = (formData.get('focus') as string | null) || ''

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    let fullText: string
    try {
      fullText = (await extractText(file)).trim()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to process file.'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    if (!fullText) return NextResponse.json({ error: 'Could not extract any text from the file.' }, { status: 422 })

    // Send first 12k chars to Claude for structure analysis
    const excerpt = fullText.slice(0, 12000)

    const t0 = Date.now()
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 16384,
      system: PARSE_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Document excerpt:\n"""\n${excerpt}\n"""\n\nAudience: ${audience}\nLevel: ${level}${focus ? `\nFocus/Scope: ${focus} — only include sections, chapters, and lessons relevant to this focus. Omit anything outside this scope.` : ''}\n\nRespond with JSON only.`,
        },
      ],
    })
    console.log(`[courses/parse] Claude responded in ${Date.now() - t0}ms`)

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const cleaned = extractJSON(raw)

    let parsed: ParsedCourseTree
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      console.error('[courses/parse] JSON parse failed. Raw:', raw)
      return NextResponse.json({ error: 'AI returned invalid JSON', raw }, { status: 500 })
    }

    // Collect all heading markers in flat order
    const allMarkers: string[] = []
    for (const section of parsed.sections) {
      for (const chapter of section.chapters) {
        for (const lesson of chapter.lessons) {
          allMarkers.push(lesson.headingMarker)
        }
      }
    }

    // Slice full text into per-lesson chunks
    const chunks = sliceTextByMarkers(fullText, allMarkers)

    // Build enriched CourseTree with localIds and sourceText
    let chunkIdx = 0
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
            const sourceText = chunks[chunkIdx++] || ''
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
    return NextResponse.json({ error: 'Failed to parse document.' }, { status: 500 })
  }
}
