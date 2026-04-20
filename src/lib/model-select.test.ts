import { modelSelectorGroups } from './model-select'

describe('modelSelectorGroups', () => {
  it('returns an Anthropic group, a Google group, and an OpenAI group for staff users', () => {
    const groups = modelSelectorGroups('staff', null)
    expect(groups.map(g => g.provider)).toEqual(['anthropic', 'google', 'openai'])
    expect(groups.map(g => g.providerLabel)).toEqual(['Anthropic', 'Google', 'OpenAI'])
  })

  it('includes all staff-tier entries but excludes Opus for staff', () => {
    const groups = modelSelectorGroups('staff', null)
    const anthropic = groups.find(g => g.provider === 'anthropic')!
    expect(anthropic.options.map(o => o.id)).toEqual([
      'claude-haiku-4-5-20251001',
      'claude-sonnet-4-6',
    ])
  })

  it('includes Opus for admin users', () => {
    const groups = modelSelectorGroups('admin', null)
    const anthropic = groups.find(g => g.provider === 'anthropic')!
    expect(anthropic.options.map(o => o.id)).toContain('claude-opus-4-6')
  })

  it('includes GPT-5 and GPT-5 mini in the OpenAI group for staff users', () => {
    const groups = modelSelectorGroups('staff', null)
    const openai = groups.find(g => g.provider === 'openai')!
    expect(openai.options.map(o => o.id)).toEqual(['gpt-5-mini', 'gpt-5'])
  })

  it('formats option labels with a cost hint', () => {
    const groups = modelSelectorGroups('admin', null)
    const labelFor = (id: string) =>
      groups.flatMap(g => g.options).find(o => o.id === id)?.label
    expect(labelFor('claude-haiku-4-5-20251001')).toBe('Haiku (fast)')
    expect(labelFor('claude-sonnet-4-6')).toBe('Sonnet (better)')
    expect(labelFor('claude-opus-4-6')).toBe('Opus (best)')
    expect(labelFor('gpt-5-mini')).toBe('GPT-5 mini (fast)')
    expect(labelFor('gpt-5')).toBe('GPT-5 (better)')
  })

  it('returns an empty array for users without selector access', () => {
    expect(modelSelectorGroups(null, 'learner')).toEqual([])
    expect(modelSelectorGroups(null, 'creator')).toEqual([])
  })
})
