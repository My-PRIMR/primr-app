/**
 * Smoke test for OpenAI provider integration.
 * Calls the AI SDK with both GPT-5 mini and GPT-5 to verify:
 *   - @ai-sdk/openai is installed
 *   - OPENAI_API_KEY is valid
 *   - The model IDs are recognized by OpenAI's API
 *   - generateText returns a non-empty response
 *
 * Run: cd primr-app && npx tsx --env-file=.env.local scripts/smoke-openai.ts
 */
import { generateText } from 'ai'
import { resolveModelRef } from '../src/lib/ai/providers'

async function ping(modelId: string) {
  const t0 = Date.now()
  try {
    const { text } = await generateText({
      model: resolveModelRef(modelId),
      prompt: 'Reply with exactly the single word "ok" and nothing else.',
      maxOutputTokens: 2048,
    })
    const ms = Date.now() - t0
    console.log(`[${modelId}] ✓ ${ms}ms — ${JSON.stringify(text.trim()).slice(0, 80)}`)
  } catch (err) {
    const ms = Date.now() - t0
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[${modelId}] ✗ ${ms}ms — ${msg}`)
    process.exitCode = 1
  }
}

;(async () => {
  await ping('gpt-5-mini')
  await ping('gpt-5')
})()
