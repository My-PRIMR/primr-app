import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

const BLOCK_SCHEMA: Record<string, string> = {
  hero: `hero props: { title: string, tagline?: string, meta?: Array<{ label: string, icon?: 'clock'|'level'|'tag' }>, cta?: string }`,
  narrative: `narrative props: { body: string (markdown), title?: string, eyebrow?: string }`,
  'step-navigator': `step-navigator props: { steps: Array<{ title: string, body: string, hint?: string }>, badge?: string, title?: string }`,
  quiz: `quiz props: { questions: Array<{ prompt: string, options: string[], correctIndex: number, explanation?: string }>, badge?: string, title?: string, passScore?: number }`,
  flashcard: `flashcard props: { cards: Array<{ front: string, back: string }>, badge?: string, title?: string }`,
  'fill-in-the-blank': `fill-in-the-blank props: { prompt: string (with {{blank}} placeholders), answers: Array<string|string[]>, badge?: string, title?: string, hint?: string }`,
}

export async function POST(req: NextRequest) {
  const { block, instructions, lessonTitle, adjacentBlocks } = await req.json()

  if (!block || !instructions?.trim()) {
    return NextResponse.json({ error: 'block and instructions are required' }, { status: 400 })
  }

  const schema = BLOCK_SCHEMA[block.type] || ''
  const context = adjacentBlocks?.length
    ? `\nSurrounding blocks for context: ${adjacentBlocks.join(' → ')}`
    : ''

  const systemPrompt = `You are editing a single block in a Primr lesson titled "${lessonTitle}".

The block type is "${block.type}". ${schema}

Return a JSON object with this structure:
{ "id": "${block.id}", "type": "${block.type}", "props": { ... } }

Rules:
- Keep the same id and type
- Apply the user's edit instructions to modify the props
- Body/prompt fields support markdown
- Return ONLY valid JSON. No explanation, no markdown fences.`

  console.log(`[edit-block] block: ${block.id} (${block.type}), instructions: "${instructions.slice(0, 100)}"`)
  const t0 = Date.now()

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: `Current block:\n${JSON.stringify(block, null, 2)}\n${context}\n\nEdit instructions: ${instructions}`,
    }],
  })

  console.log(`[edit-block] responded in ${Date.now() - t0}ms, usage: ${JSON.stringify(message.usage)}`)

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()

  try {
    const updatedBlock = JSON.parse(cleaned)
    return NextResponse.json({ block: updatedBlock })
  } catch {
    console.error(`[edit-block] JSON parse failed. Raw:\n${raw}`)
    return NextResponse.json({ error: 'AI returned invalid JSON', raw }, { status: 500 })
  }
}
