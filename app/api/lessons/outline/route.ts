import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSession } from '@/session'
import { resolveModel, modelById } from '@/lib/models'
import { getDefaultModel } from '@/lib/default-model'
import { OUTLINE_SYSTEM_PROMPT_TEMPLATE } from '@/lib/prompts/outline-system'

const client = new Anthropic()

/**
 * Returns a target block count range based on source document length.
 * TODO (Option B): consider removing the upper limit and instructing the AI to
 * cover ALL content without compression — risky due to JSON truncation at 16k tokens.
 */
function blockCountRange(documentText?: string): string {
  if (!documentText?.trim()) return '8–12'
  const wordCount = documentText.trim().split(/\s+/).length
  if (wordCount < 500)  return '6–8'
  if (wordCount < 1500) return '8–12'
  if (wordCount < 3000) return '12–18'
  return '18–24'
}

const EXAM_RULE = '\n- The final block must always be type "exam" with itemCount of 5–12 questions covering the full lesson'

function buildOutlineSystemPrompt(blockRange: string): string {
  return OUTLINE_SYSTEM_PROMPT_TEMPLATE
    .replace('${blockRange}', () => blockRange)
    .replace('${examRule}', () => EXAM_RULE)
}

export async function POST(req: NextRequest) {
  const { title, topic, audience, level, scope, documentText, model } = await req.json()

  if (!title?.trim() || (!topic?.trim() && !documentText?.trim())) {
    return NextResponse.json({ error: 'title and either topic or a document are required' }, { status: 400 })
  }

  const session = await getSession()
  const internalRole = session?.user?.internalRole ?? null
  const productRole = session?.user?.productRole ?? null
  let resolvedModel = modelById(await getDefaultModel())!
  if (model) {
    const m = resolveModel(model, internalRole, productRole)
    if (!m) return NextResponse.json({ error: 'Unauthorized model selection' }, { status: 403 })
    resolvedModel = m
  }

  const blockRange = blockCountRange(documentText)
  const systemPrompt = buildOutlineSystemPrompt(blockRange)

  console.log(`[outline] title: "${title}", audience: "${audience}", level: "${level}", hasDoc: ${!!documentText}, blockRange: ${blockRange}`)
  console.log(`[outline] using model: ${resolvedModel.id}`)
  const t0 = Date.now()

  const scopeLine = scope?.trim() ? `\nScope/focus: ${scope.trim()}` : ''
  const userContent = documentText?.trim()
    ? `Title: ${title}\nAudience: ${audience || 'General'}\nLevel: ${level || 'beginner'}${scopeLine}${topic?.trim() ? `\nAdditional context: ${topic}` : ''}\n\nSource document:\n"""\n${documentText}\n"""`
    : `Title: ${title}\nTopic: ${topic}\nAudience: ${audience || 'General'}\nLevel: ${level || 'beginner'}${scopeLine}`

  // No cap check: outline generation is a lightweight planning step, not billed against daily limits
  const message = await client.messages.create({
    model: resolvedModel.id,
    max_tokens: 4096,
    system: systemPrompt,
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
