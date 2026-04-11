export const STANDARD_FEE_BPS = 3000 // 30%
export const REDUCED_FEE_BPS = 2000 // 20%

export type FeeTier = 'standard' | 'reduced'

export interface FeeInput {
  amountCents: number
  lifetimeRevenueCents: number
  revenueThresholdCents: number
}

export interface FeeResult {
  amountCents: number
  platformFeeCents: number
  creatorRevenueCents: number
  tier: FeeTier
}

export function calculatePlatformFee(input: FeeInput): FeeResult {
  if (input.amountCents <= 0) {
    throw new Error('amountCents must be positive')
  }
  const crossesThreshold =
    input.lifetimeRevenueCents + input.amountCents >= input.revenueThresholdCents
  const tier: FeeTier = crossesThreshold ? 'reduced' : 'standard'
  const bps = tier === 'reduced' ? REDUCED_FEE_BPS : STANDARD_FEE_BPS
  const platformFeeCents = Math.floor((input.amountCents * bps) / 10000)
  return {
    amountCents: input.amountCents,
    platformFeeCents,
    creatorRevenueCents: input.amountCents - platformFeeCents,
    tier,
  }
}
