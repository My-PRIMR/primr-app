import {
  canUseRichIngest,
  resolveModel,
  MODELS,
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
