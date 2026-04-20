import { providerForModel } from './providers'

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
