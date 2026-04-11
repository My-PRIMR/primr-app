import {
  hasPlan,
  getPriceId,
  getPlanForPriceId,
  PLAN_RANK,
} from './plans'

describe('PLAN_RANK', () => {
  it('orders plans from free to enterprise', () => {
    expect(PLAN_RANK.free).toBeLessThan(PLAN_RANK.teacher)
    expect(PLAN_RANK.teacher).toBe(PLAN_RANK.pro)
    expect(PLAN_RANK.pro).toBeLessThan(PLAN_RANK.enterprise)
  })
})

describe('hasPlan', () => {
  it('free user has no paid plan', () => {
    expect(hasPlan('free', 'pro')).toBe(false)
  })
  it('pro user has pro access', () => {
    expect(hasPlan('pro', 'pro')).toBe(true)
  })
  it('enterprise user has pro access', () => {
    expect(hasPlan('enterprise', 'pro')).toBe(true)
  })
  it('teacher user has pro access (legacy tier treated as pro)', () => {
    expect(hasPlan('teacher', 'pro')).toBe(true)
  })
  it('pro user does not have enterprise access', () => {
    expect(hasPlan('pro', 'enterprise')).toBe(false)
  })
})

describe('getPriceId', () => {
  beforeEach(() => {
    process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pm'
    process.env.STRIPE_PRICE_PRO_ANNUAL = 'price_pa'
    process.env.STRIPE_PRICE_TEAMS_MONTHLY = 'price_tm'
    process.env.STRIPE_PRICE_TEAMS_ANNUAL = 'price_ta'
  })

  it('returns pro monthly price', () => {
    expect(getPriceId('pro', 'monthly')).toBe('price_pm')
  })
  it('returns pro annual price', () => {
    expect(getPriceId('pro', 'annual')).toBe('price_pa')
  })
  it('returns teams monthly price', () => {
    expect(getPriceId('teams', 'monthly')).toBe('price_tm')
  })
  it('returns teams annual price', () => {
    expect(getPriceId('teams', 'annual')).toBe('price_ta')
  })
  it('throws when env var is missing', () => {
    delete process.env.STRIPE_PRICE_PRO_MONTHLY
    expect(() => getPriceId('pro', 'monthly')).toThrow()
  })
})

describe('getPlanForPriceId', () => {
  beforeEach(() => {
    process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pm'
    process.env.STRIPE_PRICE_PRO_ANNUAL = 'price_pa'
    process.env.STRIPE_PRICE_TEAMS_MONTHLY = 'price_tm'
    process.env.STRIPE_PRICE_TEAMS_ANNUAL = 'price_ta'
  })

  it('reverse-looks up pro monthly', () => {
    expect(getPlanForPriceId('price_pm')).toEqual({
      tier: 'pro',
      period: 'monthly',
    })
  })
  it('reverse-looks up teams annual', () => {
    expect(getPlanForPriceId('price_ta')).toEqual({
      tier: 'teams',
      period: 'annual',
    })
  })
  it('returns null for unknown price', () => {
    expect(getPlanForPriceId('price_unknown')).toBeNull()
  })
})
