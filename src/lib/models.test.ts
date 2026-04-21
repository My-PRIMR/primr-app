import {
  MODELS,
  canUseRichIngest,
  modelById,
  resolveModel,
  MONTHLY_QUOTAS_BY_PLAN,
} from './models'

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

describe('resolveModel', () => {
  it('defaults to Haiku when no model id supplied', () => {
    expect(resolveModel(undefined, null, null, 'free')).toBe(MODELS.haiku)
  })

  it('returns null for unknown model id', () => {
    expect(resolveModel('not-a-real-model', 'staff', null, 'pro')).toBeNull()
  })

  it('always permits Haiku regardless of role/plan', () => {
    expect(resolveModel(MODELS.haiku.id, null, null, 'free')).toBe(MODELS.haiku)
    expect(resolveModel(MODELS.haiku.id, null, null, null)).toBe(MODELS.haiku)
  })

  it('permits Sonnet for staff and admin (existing behavior)', () => {
    expect(resolveModel(MODELS.sonnet.id, 'staff', null, 'free')).toBe(MODELS.sonnet)
    expect(resolveModel(MODELS.sonnet.id, 'admin', null, 'free')).toBe(MODELS.sonnet)
  })

  it('permits Sonnet for Pro and Enterprise plans (new opt-in)', () => {
    expect(resolveModel(MODELS.sonnet.id, null, null, 'pro')).toBe(MODELS.sonnet)
    expect(resolveModel(MODELS.sonnet.id, null, null, 'enterprise')).toBe(MODELS.sonnet)
  })

  it('denies Sonnet for Free and Teacher (K-12 Program) plans', () => {
    expect(resolveModel(MODELS.sonnet.id, null, null, 'free')).toBeNull()
    expect(resolveModel(MODELS.sonnet.id, null, null, 'teacher')).toBeNull()
  })

  it('permits Gemini Pro 2.5 for Pro plans (MEDIUM cost class)', () => {
    expect(resolveModel(MODELS.pro.id, null, null, 'pro')).toBe(MODELS.pro)
  })

  it('still restricts Opus to admin only', () => {
    expect(resolveModel(MODELS.opus.id, null, null, 'pro')).toBeNull()
    expect(resolveModel(MODELS.opus.id, 'staff', null, 'pro')).toBeNull()
    expect(resolveModel(MODELS.opus.id, 'admin', null, 'free')).toBe(MODELS.opus)
  })
})

describe('MONTHLY_QUOTAS_BY_PLAN', () => {
  it('grants Free 10 Haiku generations and no Sonnet', () => {
    expect(MONTHLY_QUOTAS_BY_PLAN.free.LOW).toBe(10)
    expect(MONTHLY_QUOTAS_BY_PLAN.free.MEDIUM).toBeUndefined()
  })

  it('grants Teacher (K-12 Program) 100 Haiku generations and no Sonnet', () => {
    expect(MONTHLY_QUOTAS_BY_PLAN.teacher.LOW).toBe(100)
    expect(MONTHLY_QUOTAS_BY_PLAN.teacher.MEDIUM).toBeUndefined()
  })

  it('grants Pro 200 Haiku and 25 Sonnet per month', () => {
    expect(MONTHLY_QUOTAS_BY_PLAN.pro.LOW).toBe(200)
    expect(MONTHLY_QUOTAS_BY_PLAN.pro.MEDIUM).toBe(25)
  })

  it('grants Enterprise unlimited (null) for Haiku and Sonnet', () => {
    expect(MONTHLY_QUOTAS_BY_PLAN.enterprise.LOW).toBeNull()
    expect(MONTHLY_QUOTAS_BY_PLAN.enterprise.MEDIUM).toBeNull()
  })

  it('does not grant Opus (HIGH) on any plan — admin-only model', () => {
    expect(MONTHLY_QUOTAS_BY_PLAN.free.HIGH).toBeUndefined()
    expect(MONTHLY_QUOTAS_BY_PLAN.teacher.HIGH).toBeUndefined()
    expect(MONTHLY_QUOTAS_BY_PLAN.pro.HIGH).toBeUndefined()
    expect(MONTHLY_QUOTAS_BY_PLAN.enterprise.HIGH).toBeUndefined()
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

  it('resolveModel grants GPT-5 (MEDIUM) to Pro users via plan opt-in', () => {
    expect(resolveModel('gpt-5', null, null, 'pro')).toBe(MODELS.gpt5)
    expect(resolveModel('gpt-5', null, null, 'enterprise')).toBe(MODELS.gpt5)
  })
})
