import { NextResponse } from 'next/server'
import { getStripe, getStripeWebhookSecret } from '@/stripe'
import { db } from '@/db'
import { creatorProfiles } from '@/db/schema'
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
    // Purchase and subscription events are handled in later tasks.
    default:
      break
  }

  return NextResponse.json({ received: true })
}
