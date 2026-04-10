import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'
import type { LanguageModel } from 'ai'

export type ProviderKey = 'anthropic' | 'google'

// AI SDK model reference lookup by raw model ID.
// Each entry maps a model ID string (as stored in MODELS) to
// the corresponding AI SDK LanguageModel instance.
const MODEL_REF_MAP: Record<string, LanguageModel> = {
  'claude-haiku-4-5-20251001': anthropic('claude-haiku-4-5-20251001'),
  'claude-sonnet-4-6':         anthropic('claude-sonnet-4-6'),
  'claude-opus-4-6':           anthropic('claude-opus-4-6'),
  'gemini-2.5-flash':          google('gemini-2.5-flash'),
  'gemini-2.5-pro':            google('gemini-2.5-pro'),
}

/**
 * Resolve an AI SDK LanguageModel reference from a model ID string.
 * Throws if the model ID is not in the registry.
 */
export function resolveModelRef(modelId: string): LanguageModel {
  const ref = MODEL_REF_MAP[modelId]
  if (!ref) throw new Error(`Unknown model ID for AI SDK: ${modelId}`)
  return ref
}

/**
 * Determine the provider key for a given model ID.
 */
export function providerForModel(modelId: string): ProviderKey {
  if (modelId.startsWith('gemini')) return 'google'
  return 'anthropic'
}

// ── LearnLM pedagogical preamble ─────────────────────────────────────────────

const LEARNLM_PREAMBLE = `Apply these pedagogical principles:
- Explain topics using language appropriate to the learner's understanding level
- Use guiding questions to promote critical thinking rather than providing direct answers
- Break complex content into manageable, scaffolded parts
- Actively identify and correct potential misconceptions
- Ensure each explanation builds on previously established concepts`

/**
 * Wrap a system prompt with provider-specific enhancements.
 * For Google models, prepends LearnLM pedagogical instructions.
 */
export function buildSystemPrompt(base: string, modelId: string): string {
  if (providerForModel(modelId) === 'google') return LEARNLM_PREAMBLE + '\n\n' + base
  return base
}
