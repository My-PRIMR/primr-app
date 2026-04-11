import { NextResponse } from 'next/server'
import { getStripe, getStripeWebhookSecret } from '@/stripe'
import { db } from '@/db'
import { planSubscriptions, users, organizations } from '@/db/schema'
import { eq } from 'drizzle-orm'
import type Stripe from 'stripe'
import { getPlanForPriceId } from '@/plans'
import { downgradeUserToFree, downgradeOrganization } from '@/lib/billing'

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

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const md = sub.metadata ?? {}
      if (md.primrKind !== 'plan_subscription') break

      const status =
        sub.status === 'active' || sub.status === 'trialing'
          ? 'active'
          : sub.status === 'past_due'
            ? 'past_due'
            : sub.status === 'incomplete'
              ? 'incomplete'
              : 'canceled'

      // Detect plan switch via the price ID
      const priceId = sub.items.data[0]?.price?.id ?? null
      const planFromPrice = priceId ? getPlanForPriceId(priceId) : null

      const updates: Record<string, unknown> = {
        status,
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
        cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
        updatedAt: new Date(),
      }
      if (planFromPrice) {
        updates.tier = planFromPrice.tier
        updates.billingPeriod = planFromPrice.period
      }

      await db
        .update(planSubscriptions)
        .set(updates)
        .where(eq(planSubscriptions.stripeSubscriptionId, sub.id))

      // Recover user plan if active after prior downgrade
      if (status === 'active') {
        const row = await db.query.planSubscriptions.findFirst({
          where: eq(planSubscriptions.stripeSubscriptionId, sub.id),
        })
        if (row) {
          await db
            .update(users)
            .set({ plan: 'pro' })
            .where(eq(users.id, row.subscriberUserId))
        }
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const md = sub.metadata ?? {}
      if (md.primrKind !== 'plan_subscription') break

      const row = await db.query.planSubscriptions.findFirst({
        where: eq(planSubscriptions.stripeSubscriptionId, sub.id),
      })
      if (!row) break

      await db
        .update(planSubscriptions)
        .set({ status: 'canceled', updatedAt: new Date() })
        .where(eq(planSubscriptions.stripeSubscriptionId, sub.id))

      if (row.organizationId) {
        await db
          .update(organizations)
          .set({ planSubscriptionId: null })
          .where(eq(organizations.id, row.organizationId))
        await downgradeOrganization(row.organizationId)
      } else {
        await downgradeUserToFree(row.subscriberUserId)
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const subId =
        typeof invoice.subscription === 'string'
          ? invoice.subscription
          : invoice.subscription?.id
      if (!subId) break

      // Filter by DB presence — plan_subscriptions is our authoritative set of
      // subscriptions we care about. If the row doesn't exist, the invoice is
      // for some other Stripe subscription (e.g., future creator monetization).
      const row = await db.query.planSubscriptions.findFirst({
        where: eq(planSubscriptions.stripeSubscriptionId, subId),
      })
      if (!row) break

      await db
        .update(planSubscriptions)
        .set({ status: 'past_due', updatedAt: new Date() })
        .where(eq(planSubscriptions.stripeSubscriptionId, subId))
      break
    }

    default:
      break
  }

  return NextResponse.json({ received: true })
}
