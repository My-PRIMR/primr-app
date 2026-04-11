import { NextResponse } from 'next/server'
import { getSession } from '@/session'
import { getStripe } from '@/stripe'
import { getPriceId } from '@/plans'
import { ensureStripeCustomer } from '@/lib/billing'

const VALID_TIERS = ['pro', 'teams'] as const
const VALID_PERIODS = ['monthly', 'annual'] as const

export async function POST(req: Request) {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as {
    tier?: string
    period?: string
    teamName?: string
  }

  if (!body.tier || !VALID_TIERS.includes(body.tier as (typeof VALID_TIERS)[number])) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
  }
  if (!body.period || !VALID_PERIODS.includes(body.period as (typeof VALID_PERIODS)[number])) {
    return NextResponse.json({ error: 'Invalid period' }, { status: 400 })
  }

  const tier = body.tier as 'pro' | 'teams'
  const period = body.period as 'monthly' | 'annual'

  if (tier === 'teams') {
    return NextResponse.json(
      { error: 'Teams checkout is not implemented yet' },
      { status: 400 },
    )
  }

  const customerId = await ensureStripeCustomer(
    session.user.id,
    session.user.email,
    session.user.name ?? null,
  )

  const priceId = getPriceId(tier, period)

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const metadata = {
    primrKind: 'plan_subscription',
    primrUserId: session.user.id,
    primrTier: tier,
    primrPeriod: period,
  }

  const stripe = getStripe()
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata,
    subscription_data: { metadata },
    success_url: `${baseUrl}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/upgrade/cancel`,
  })

  return NextResponse.json({ url: checkoutSession.url })
}
