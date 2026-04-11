export type PlanValue = 'free' | 'teacher' | 'pro' | 'enterprise'
export type PlanTier = 'pro' | 'teams'
export type BillingPeriod = 'monthly' | 'annual'

export const PLAN_RANK: Record<PlanValue, number> = {
  free: 0,
  teacher: 2,
  pro: 2,
  enterprise: 3,
}

export function hasPlan(userPlan: PlanValue, required: 'pro' | 'enterprise'): boolean {
  return PLAN_RANK[userPlan] >= PLAN_RANK[required]
}

function readEnvOrThrow(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} is not set`)
  return v
}

export function getPriceId(tier: PlanTier, period: BillingPeriod): string {
  if (tier === 'pro' && period === 'monthly') {
    return readEnvOrThrow('STRIPE_PRICE_PRO_MONTHLY')
  }
  if (tier === 'pro' && period === 'annual') {
    return readEnvOrThrow('STRIPE_PRICE_PRO_ANNUAL')
  }
  if (tier === 'teams' && period === 'monthly') {
    return readEnvOrThrow('STRIPE_PRICE_TEAMS_MONTHLY')
  }
  return readEnvOrThrow('STRIPE_PRICE_TEAMS_ANNUAL')
}

export function getPlanForPriceId(
  priceId: string,
): { tier: PlanTier; period: BillingPeriod } | null {
  if (priceId === process.env.STRIPE_PRICE_PRO_MONTHLY) {
    return { tier: 'pro', period: 'monthly' }
  }
  if (priceId === process.env.STRIPE_PRICE_PRO_ANNUAL) {
    return { tier: 'pro', period: 'annual' }
  }
  if (priceId === process.env.STRIPE_PRICE_TEAMS_MONTHLY) {
    return { tier: 'teams', period: 'monthly' }
  }
  if (priceId === process.env.STRIPE_PRICE_TEAMS_ANNUAL) {
    return { tier: 'teams', period: 'annual' }
  }
  return null
}
