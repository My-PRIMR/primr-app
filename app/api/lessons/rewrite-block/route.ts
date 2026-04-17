import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { resolveModelRef, buildSystemPrompt } from '@/lib/ai/providers'
import { extractJSON } from '@/lib/extract-json'
import { getSession } from '@/session'
import { canAiEdit, DEFAULT_MODEL } from '@/lib/models'
import { BLOCK_SCHEMA_MAP, ALL_BLOCK_TYPES } from '@primr/components/lib'
import type { BlockConfig } from '@/types/outline'

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

  // Sanitize block.id for safe prompt interpolation — strip anything outside [a-zA-Z0-9_-]
  const safeBlockId = typeof block.id === 'string' ? block.id.replace(/[^a-zA-Z0-9_-]/g, '') : 'unknown'

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
    `\n\nReturn this exact structure:\n{ "id": "${safeBlockId}", "type": "${targetType}", "props": { ... } }`,
    `\n\nTarget block schema:\n${targetSchema}`,
    `\n\nRules:\n- Preserve the id: "${safeBlockId}" exactly\n- Body/prompt fields support markdown: **bold**, *italic*, \`code\`\n- Return ONLY valid JSON. No explanation, no markdown fences, no preamble. Start with { and end with }.`,
  ].join('')

  const userMessage = [
    instruction ? `Instruction: ${instruction}\n\n` : '',
    `Source block:\n${JSON.stringify(block, null, 2)}`,
  ].join('')

  try {
    const { text: raw } = await generateText({
      model: resolveModelRef(DEFAULT_MODEL),
      maxOutputTokens: 4096,
      system: buildSystemPrompt(systemPrompt, DEFAULT_MODEL, { learnlm: false }),
      prompt: userMessage,
    })
    const parsed = JSON.parse(extractJSON(raw))

    return NextResponse.json({ block: parsed })
  } catch (err) {
    console.error('[rewrite-block]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Generation failed. Please try again.' }, { status: 500 })
  }
}
