import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import type Stripe from 'stripe'
import { getSession } from '@/session'
import { getStripe } from '@/stripe'
import { getPriceId } from '@/plans'
import { ensureStripeCustomer } from '@/lib/billing'
import { db } from '@/db'
import { organizations, users as usersTable } from '@/db/schema'

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

  let organizationId: string | null = null

  if (tier === 'teams') {
    // Load the user to get organizationId (not guaranteed to be on session)
    const user = await db.query.users.findFirst({
      where: eq(usersTable.id, session.user.id),
    })

    if (user?.organizationId) {
      // Existing org — check if it already has an active subscription
      const existingOrg = await db.query.organizations.findFirst({
        where: eq(organizations.id, user.organizationId),
      })
      if (existingOrg?.planSubscriptionId) {
        return NextResponse.json(
          { error: 'Your organization already has an active Teams subscription' },
          { status: 400 },
        )
      }
      organizationId = user.organizationId
    } else {
      // No org yet — require teamName and create it
      if (!body.teamName || body.teamName.trim().length < 2) {
        return NextResponse.json(
          { error: 'Team name is required (2-80 characters)' },
          { status: 400 },
        )
      }
      const name = body.teamName.trim().slice(0, 80)
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')

      const [row] = await db
        .insert(organizations)
        .values({
          name,
          slug,
          ownerId: session.user.id,
        })
        .returning({ id: organizations.id })
      organizationId = row.id

      await db
        .update(usersTable)
        .set({ organizationId, productRole: 'org_admin' })
        .where(eq(usersTable.id, session.user.id))
    }
  }

  const customerId = await ensureStripeCustomer(
    session.user.id,
    session.user.email,
    session.user.name ?? null,
  )

  const priceId = getPriceId(tier, period)

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const metadata: Record<string, string> = {
    primrKind: 'plan_subscription',
    primrUserId: session.user.id,
    primrTier: tier,
    primrPeriod: period,
  }
  if (organizationId) {
    metadata.primrOrganizationId = organizationId
  }

  const stripe = getStripe()
  const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
    metadata,
  }
  if (tier === 'pro') {
    subscriptionData.trial_period_days = 14
  }
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata,
    subscription_data: subscriptionData,
    success_url: `${baseUrl}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/upgrade/cancel`,
  })

  return NextResponse.json({ url: checkoutSession.url })
}
