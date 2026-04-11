import { calculatePlatformFee } from './fees'

describe('calculatePlatformFee', () => {
  it('applies 30% cut when creator is below revenue threshold', () => {
    const result = calculatePlatformFee({
      amountCents: 1000,
      lifetimeRevenueCents: 0,
      revenueThresholdCents: 100000,
    })
    expect(result).toEqual({
      amountCents: 1000,
      platformFeeCents: 300,
      creatorRevenueCents: 700,
      tier: 'standard',
    })
  })

  it('applies 20% cut when creator is already above threshold', () => {
    const result = calculatePlatformFee({
      amountCents: 1000,
      lifetimeRevenueCents: 150000,
      revenueThresholdCents: 100000,
    })
    expect(result).toEqual({
      amountCents: 1000,
      platformFeeCents: 200,
      creatorRevenueCents: 800,
      tier: 'reduced',
    })
  })

  it('applies 20% cut to the entire transaction when it crosses the threshold', () => {
    const result = calculatePlatformFee({
      amountCents: 50000,
      lifetimeRevenueCents: 90000,
      revenueThresholdCents: 100000,
    })
    expect(result).toEqual({
      amountCents: 50000,
      platformFeeCents: 10000,
      creatorRevenueCents: 40000,
      tier: 'reduced',
    })
  })

  it('rounds platform fee down (floor) so creator is never shortchanged', () => {
    const result = calculatePlatformFee({
      amountCents: 333,
      lifetimeRevenueCents: 0,
      revenueThresholdCents: 100000,
    })
    // 30% of 333 = 99.9 → floor → 99
    expect(result.platformFeeCents).toBe(99)
    expect(result.creatorRevenueCents).toBe(234)
  })

  it('throws on zero or negative amounts', () => {
    expect(() =>
      calculatePlatformFee({
        amountCents: 0,
        lifetimeRevenueCents: 0,
        revenueThresholdCents: 100000,
      }),
    ).toThrow()
  })
})
