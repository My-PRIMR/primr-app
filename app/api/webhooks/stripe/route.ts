import { NextResponse } from 'next/server'
import { getStripe, getStripeWebhookSecret } from '@/stripe'
import { db } from '@/db'
import { creatorProfiles, purchases, subscriptions } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { calculatePlatformFee } from '@/monetization/fees'
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
    case 'account.updated': {
      const account = event.data.object as Stripe.Account
      const complete = !!account.charges_enabled && !!account.details_submitted
      await db
        .update(creatorProfiles)
        .set({
          stripeOnboardingComplete: complete,
          updatedAt: new Date(),
        })
        .where(eq(creatorProfiles.stripeAccountId, account.id))
      break
    }
    case 'checkout.session.completed': {
      const s = event.data.object as Stripe.Checkout.Session
      if (s.mode !== 'payment') break

      const md = s.metadata ?? {}
      const buyerId = md.primrBuyerId
      const creatorId = md.primrCreatorId
      const lessonId = md.primrLessonId || null
      const courseId = md.primrCourseId || null
      const amountCents = s.amount_total ?? 0
      const paymentIntentId =
        typeof s.payment_intent === 'string'
          ? s.payment_intent
          : s.payment_intent?.id

      if (!buyerId || !creatorId || !paymentIntentId || amountCents <= 0) break

      const creator = await db.query.creatorProfiles.findFirst({
        where: eq(creatorProfiles.userId, creatorId),
      })
      if (!creator) break

      const fee = calculatePlatformFee({
        amountCents,
        lifetimeRevenueCents: creator.lifetimeRevenueCents,
        revenueThresholdCents: creator.revenueThresholdCents,
      })

      try {
        await db.insert(purchases).values({
          buyerId,
          lessonId: lessonId || null,
          courseId: courseId || null,
          stripePaymentIntentId: paymentIntentId,
          amountCents,
          creatorRevenueCents: fee.creatorRevenueCents,
          primrFeeCents: fee.platformFeeCents,
        })

        await db
          .update(creatorProfiles)
          .set({
            lifetimeRevenueCents: sql`${creatorProfiles.lifetimeRevenueCents} + ${fee.creatorRevenueCents}`,
            updatedAt: new Date(),
          })
          .where(eq(creatorProfiles.userId, creatorId))
      } catch (err: unknown) {
        // Postgres 23505 = unique_violation → the payment_intent was already
        // recorded, so this webhook is a replay. Swallow it to stay idempotent.
        if ((err as { code?: string })?.code !== '23505') throw err
      }
      break
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const md = sub.metadata ?? {}
      const subscriberId = md.primrSubscriberId
      const creatorId = md.primrCreatorId
      if (!subscriberId || !creatorId) break

      const status =
        sub.status === 'active' || sub.status === 'trialing'
          ? 'active'
          : sub.status === 'past_due'
            ? 'past_due'
            : 'canceled'

      const currentPeriodEnd = new Date(sub.current_period_end * 1000)

      await db
        .insert(subscriptions)
        .values({
          subscriberId,
          creatorId,
          stripeSubscriptionId: sub.id,
          status,
          currentPeriodEnd,
        })
        .onConflictDoUpdate({
          target: subscriptions.stripeSubscriptionId,
          set: {
            status,
            currentPeriodEnd,
            updatedAt: new Date(),
          },
        })
      break
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await db
        .update(subscriptions)
        .set({ status: 'canceled', updatedAt: new Date() })
        .where(eq(subscriptions.stripeSubscriptionId, sub.id))
      break
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const subId =
        typeof invoice.subscription === 'string'
          ? invoice.subscription
          : invoice.subscription?.id
      if (!subId) break
      await db
        .update(subscriptions)
        .set({ status: 'past_due', updatedAt: new Date() })
        .where(eq(subscriptions.stripeSubscriptionId, subId))
      break
    }
    default:
      break
  }

  return NextResponse.json({ received: true })
}
