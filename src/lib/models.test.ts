import { MODELS, canUseRichIngest, modelById, resolveModel } from './models'

describe('canUseRichIngest', () => {
  it('returns false for free plan with no role', () => {
    expect(canUseRichIngest('free', null)).toBe(false)
  })

  it('returns true for pro plan', () => {
    expect(canUseRichIngest('pro', null)).toBe(true)
  })

  it('returns true for enterprise plan', () => {
    expect(canUseRichIngest('enterprise', null)).toBe(true)
  })

  it('returns true for any internalRole regardless of plan', () => {
    expect(canUseRichIngest('free', 'staff')).toBe(true)
    expect(canUseRichIngest('free', 'admin')).toBe(true)
  })

  it('returns false for null plan and null role', () => {
    expect(canUseRichIngest(null, null)).toBe(false)
  })
})

describe('MODELS registry — OpenAI entries', () => {
  it('exposes gpt5mini with LOW cost and staff minRole', () => {
    expect(MODELS.gpt5mini).toEqual({
      id: 'gpt-5-mini',
      provider: 'openai',
      costCategory: 'LOW',
      label: 'GPT-5 mini',
      minRole: 'staff',
    })
  })

  it('exposes gpt5 with MEDIUM cost and staff minRole', () => {
    expect(MODELS.gpt5).toEqual({
      id: 'gpt-5',
      provider: 'openai',
      costCategory: 'MEDIUM',
      label: 'GPT-5',
      minRole: 'staff',
    })
  })

  it('modelById resolves the new OpenAI model IDs', () => {
    expect(modelById('gpt-5-mini')).toBe(MODELS.gpt5mini)
    expect(modelById('gpt-5')).toBe(MODELS.gpt5)
  })

  it('resolveModel grants gpt5mini to staff users', () => {
    expect(resolveModel('gpt-5-mini', 'staff', null)).toBe(MODELS.gpt5mini)
  })

  it('resolveModel denies gpt5mini to users with no staff/admin access', () => {
    expect(resolveModel('gpt-5-mini', null, 'learner')).toBeNull()
    expect(resolveModel('gpt-5-mini', null, 'creator')).toBeNull()
  })
})
