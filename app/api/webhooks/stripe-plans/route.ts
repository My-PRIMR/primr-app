import { NextResponse } from 'next/server'
import { getStripe, getStripeWebhookSecret } from '@/stripe'
import { db } from '@/db'
import { planSubscriptions, users, organizations } from '@/db/schema'
import { eq } from 'drizzle-orm'
import type Stripe from 'stripe'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'missing signature' }, { status: 400 })
  }

  const rawBody = await req.text()
  const stripe = getStripe()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      getStripeWebhookSecret(),
    )
  } catch {
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode !== 'subscription') break
      const md = session.metadata ?? {}
      if (md.primrKind !== 'plan_subscription') break

      const primrUserId = md.primrUserId
      const primrTier = md.primrTier as 'pro' | 'teams'
      const primrPeriod = md.primrPeriod as 'monthly' | 'annual'
      const organizationId = md.primrOrganizationId || null
      const customerId =
        typeof session.customer === 'string'
          ? session.customer
          : session.customer?.id
      const subscriptionId =
        typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id

      if (!primrUserId || !primrTier || !primrPeriod || !customerId || !subscriptionId) break

      const subscription = await stripe.subscriptions.retrieve(subscriptionId)

      try {
        await db.insert(planSubscriptions).values({
          subscriberUserId: primrUserId,
          organizationId: organizationId || null,
          tier: primrTier,
          billingPeriod: primrPeriod,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription.id,
          status:
            subscription.status === 'active' || subscription.status === 'trialing'
              ? 'active'
              : subscription.status === 'past_due'
                ? 'past_due'
                : subscription.status === 'incomplete'
                  ? 'incomplete'
                  : 'canceled',
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
        })
      } catch (err: unknown) {
        if ((err as { code?: string })?.code !== '23505') throw err
      }

      await db
        .update(users)
        .set({ plan: 'pro' })
        .where(eq(users.id, primrUserId))

      if (organizationId) {
        const row = await db.query.planSubscriptions.findFirst({
          where: eq(planSubscriptions.stripeSubscriptionId, subscription.id),
        })
        if (row) {
          await db
            .update(organizations)
            .set({ planSubscriptionId: row.id })
            .where(eq(organizations.id, organizationId))
        }
      }
      break
    }

    default:
      break
  }

  return NextResponse.json({ received: true })
}
