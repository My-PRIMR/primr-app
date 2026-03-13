import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

const SYSTEM_PROMPT = `You are an expert instructional designer. Given a lesson title, topic description, target audience, and level, generate a lesson outline as JSON.

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
- Include 4–7 blocks total
- Mix block types for engagement: use at least 2 different interactive types (quiz, flashcard, fill-in-the-blank, step-navigator)
- Summaries should be specific to the content, not generic (e.g. "Explains how TCP's three-way handshake establishes a connection" not "Explains the concept")
- Return ONLY valid JSON. No markdown fences, no explanation.`

export async function POST(req: NextRequest) {
  const { title, topic, audience, level } = await req.json()

  if (!title?.trim() || !topic?.trim()) {
    return NextResponse.json({ error: 'title and topic are required' }, { status: 400 })
  }

  console.log(`[outline] title: "${title}", audience: "${audience}", level: "${level}"`)
  const t0 = Date.now()

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Title: ${title}\nTopic: ${topic}\nAudience: ${audience || 'General'}\nLevel: ${level || 'beginner'}`,
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
