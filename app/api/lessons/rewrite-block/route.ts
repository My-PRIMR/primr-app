import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSession } from '@/session'
import { canAiEdit, DEFAULT_MODEL } from '@/lib/models'
import { BLOCK_SCHEMA_MAP, ALL_BLOCK_TYPES } from '@/lib/block-schemas'
import { extractJSON } from '@/lib/extract-json'
import type { BlockConfig } from '@/types/outline'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  const session = await getSession()
  const plan = session?.user.plan ?? 'free'
  const internalRole = session?.user.internalRole ?? null

  if (!canAiEdit(plan, internalRole)) {
    return NextResponse.json({ error: 'Pro plan required' }, { status: 403 })
  }

  const body = await req.json()
  const block: BlockConfig = body.block
  const targetType: string = body.targetType
  const instruction: string | undefined = body.instruction

  if (!ALL_BLOCK_TYPES.includes(targetType)) {
    return NextResponse.json({ error: `Unknown block type: ${targetType}` }, { status: 400 })
  }

  const targetSchema = BLOCK_SCHEMA_MAP[targetType]
  const isSameType = block.type === targetType

  const systemPrompt = [
    `You are an expert instructional designer. `,
    isSameType
      ? `Rewrite the given lesson block, improving its content.`
      : `Convert the given lesson block from type "${block.type}" to type "${targetType}", preserving the educational content and intent.`,
    `\n\nReturn this exact structure:\n{ "id": "${block.id}", "type": "${targetType}", "props": { ... } }`,
    `\n\nTarget block schema:\n${targetSchema}`,
    `\n\nRules:\n- Preserve the id: "${block.id}" exactly\n- Body/prompt fields support markdown: **bold**, *italic*, \`code\`\n- Return ONLY valid JSON. No explanation, no markdown fences, no preamble. Start with { and end with }.`,
  ].join('')

  const userMessage = [
    instruction ? `Instruction: ${instruction}\n\n` : '',
    `Source block:\n${JSON.stringify(block, null, 2)}`,
  ].join('')

  try {
    const message = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const parsed = JSON.parse(extractJSON(raw))

    return NextResponse.json({ block: parsed })
  } catch (err) {
    console.error('[rewrite-block]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Generation failed. Please try again.' }, { status: 500 })
  }
}
