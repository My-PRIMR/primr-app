import { NextRequest, NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { resolveModelRef, buildSystemPrompt } from '@/lib/ai/providers'
import { blockConfigSchema } from '@/lib/ai/schemas'
import { DEFAULT_MODEL } from '@/lib/models'
import { BLOCK_SCHEMA_MAP } from '@/lib/block-schemas'

export async function POST(req: NextRequest) {
  const { block, instructions, lessonTitle, adjacentBlocks } = await req.json()

  if (!block || !instructions?.trim()) {
    return NextResponse.json({ error: 'block and instructions are required' }, { status: 400 })
  }

  const schema = BLOCK_SCHEMA_MAP[block.type] || ''
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
  const modelId = DEFAULT_MODEL

  try {
    const { object: updatedBlock } = await generateObject({
      model: resolveModelRef(modelId),
      schema: blockConfigSchema,
      maxTokens: 2048,
      system: buildSystemPrompt(systemPrompt, modelId),
      prompt: `Current block:\n${JSON.stringify(block, null, 2)}\n${context}\n\nEdit instructions: ${instructions}`,
    })
    console.log(`[edit-block] responded in ${Date.now() - t0}ms`)
    return NextResponse.json({ block: updatedBlock })
  } catch (err) {
    console.error(`[edit-block] AI generation failed:`, err)
    return NextResponse.json({ error: 'AI edit failed. Please try again.' }, { status: 500 })
  }
}
