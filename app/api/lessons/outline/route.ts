import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSession } from '@/session'
import { resolveModel, DEFAULT_MODEL, modelById } from '@/lib/models'

const client = new Anthropic()

const SYSTEM_PROMPT = `You are an expert instructional designer. Given a lesson title, topic description, target audience, level, and optional scope/focus, generate a lesson outline as JSON.

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
- Tailor vocabulary, depth, and examples to the specified audience and level. Beginner: avoid jargon, use analogies. Intermediate: assume foundational knowledge. Advanced: use precise terminology and focus on nuance.
- If a Scope/focus is provided, constrain content strictly to that focus — omit anything outside it even if it seems relevant.
- Each interactive block (quiz, flashcard, fill-in-the-blank) must be preceded by a narrative or step-navigator block that teaches the material it will test — never place an interactive block without a teaching block immediately before it
- Use step-navigator for multi-part concepts or processes; use narrative for explanations and context
- Mix interactive types for engagement: use at least 2 different interactive types (quiz, flashcard, fill-in-the-blank)
- Summaries should be specific to the content, not generic (e.g. "Explains how TCP's three-way handshake establishes a connection" not "Explains the concept")
- If a source document is provided, ALL block summaries must describe content drawn directly from that document. Do not introduce topics not covered in the document.
- Return ONLY valid JSON. No markdown fences, no explanation.`

export async function POST(req: NextRequest) {
  const { title, topic, audience, level, scope, documentText, model } = await req.json()

  if (!title?.trim() || (!topic?.trim() && !documentText?.trim())) {
    return NextResponse.json({ error: 'title and either topic or a document are required' }, { status: 400 })
  }

  const session = await getSession()
  const internalRole = session?.user?.internalRole ?? null
  const productRole = session?.user?.productRole ?? null
  let resolvedModel = modelById(DEFAULT_MODEL)!
  if (model) {
    const m = resolveModel(model, internalRole, productRole)
    if (!m) return NextResponse.json({ error: 'Unauthorized model selection' }, { status: 403 })
    resolvedModel = m
  }

  console.log(`[outline] title: "${title}", audience: "${audience}", level: "${level}", hasDoc: ${!!documentText}`)
  console.log(`[outline] using model: ${resolvedModel.id}`)
  const t0 = Date.now()

  const scopeLine = scope?.trim() ? `\nScope/focus: ${scope.trim()}` : ''
  const userContent = documentText?.trim()
    ? `Title: ${title}\nAudience: ${audience || 'General'}\nLevel: ${level || 'beginner'}${scopeLine}${topic?.trim() ? `\nAdditional context: ${topic}` : ''}\n\nSource document:\n"""\n${documentText}\n"""`
    : `Title: ${title}\nTopic: ${topic}\nAudience: ${audience || 'General'}\nLevel: ${level || 'beginner'}${scopeLine}`

  // No cap check: outline generation is a lightweight planning step, not billed against daily limits
  const message = await client.messages.create({
    model: resolvedModel.id,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: userContent,
    }],
  })

  console.log(`[outline] Sonnet responded in ${Date.now() - t0}ms, usage: ${JSON.stringify(message.usage)}`)

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()

  try {
    const outline = JSON.parse(cleaned)
    return NextResponse.json(outline)
  } catch {
    console.error(`[outline] JSON parse failed. Raw:\n${raw}`)
    return NextResponse.json({ error: 'AI returned invalid JSON', raw }, { status: 500 })
  }
}
