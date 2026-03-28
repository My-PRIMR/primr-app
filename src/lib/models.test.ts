import { canUseRichIngest } from './models'

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
