import { providerForModel, resolveModelRef } from './providers'

describe('providerForModel', () => {
  it('returns "anthropic" for Claude model IDs', () => {
    expect(providerForModel('claude-haiku-4-5-20251001')).toBe('anthropic')
    expect(providerForModel('claude-sonnet-4-6')).toBe('anthropic')
    expect(providerForModel('claude-opus-4-6')).toBe('anthropic')
  })

  it('returns "google" for Gemini model IDs', () => {
    expect(providerForModel('gemini-2.5-flash')).toBe('google')
    expect(providerForModel('gemini-2.5-pro')).toBe('google')
  })

  it('returns "openai" for GPT model IDs', () => {
    expect(providerForModel('gpt-5-mini')).toBe('openai')
    expect(providerForModel('gpt-5')).toBe('openai')
  })
})

describe('resolveModelRef', () => {
  it('returns a LanguageModel reference for known Claude IDs', () => {
    expect(resolveModelRef('claude-haiku-4-5-20251001')).toBeDefined()
    expect(resolveModelRef('claude-sonnet-4-6')).toBeDefined()
  })

  it('returns a LanguageModel reference for known Gemini IDs', () => {
    expect(resolveModelRef('gemini-2.5-flash')).toBeDefined()
    expect(resolveModelRef('gemini-2.5-pro')).toBeDefined()
  })

  it('returns a LanguageModel reference for known GPT IDs', () => {
    expect(resolveModelRef('gpt-5-mini')).toBeDefined()
    expect(resolveModelRef('gpt-5')).toBeDefined()
  })

  it('throws for unknown model IDs', () => {
    expect(() => resolveModelRef('not-a-model')).toThrow(/Unknown model ID/)
  })
})
