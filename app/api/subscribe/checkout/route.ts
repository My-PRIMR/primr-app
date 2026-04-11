import { NextResponse } from 'next/server'
import { getSession } from '@/session'
import { getStripe } from '@/stripe'
import { db } from '@/db'
import { creatorProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(req: Request) {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as { creatorId?: string }
  if (!body.creatorId) {
    return NextResponse.json({ error: 'creatorId required' }, { status: 400 })
  }

  const creator = await db.query.creatorProfiles.findFirst({
    where: eq(creatorProfiles.userId, body.creatorId),
  })
  if (
    !creator?.subscriptionEnabled ||
    !creator.subscriptionPriceCents ||
    !creator.stripeAccountId ||
    !creator.stripeOnboardingComplete
  ) {
    return NextResponse.json(
      { error: 'Creator does not offer subscriptions' },
      { status: 400 },
    )
  }

  const feePercent =
    creator.lifetimeRevenueCents >= creator.revenueThresholdCents ? 20 : 30

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const metadata = {
    primrSubscriberId: session.user.id,
    primrCreatorId: body.creatorId,
  }

  const stripe = getStripe()
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: creator.subscriptionPriceCents,
          recurring: { interval: 'month' },
          product_data: { name: 'Creator subscription' },
        },
        quantity: 1,
      },
    ],
    subscription_data: {
      application_fee_percent: feePercent,
      transfer_data: { destination: creator.stripeAccountId },
      metadata,
    },
    metadata, // also on the session so checkout.session.completed can read it
    success_url: `${baseUrl}/creator/${body.creatorId}?subscribe=success`,
    cancel_url: `${baseUrl}/creator/${body.creatorId}?subscribe=cancel`,
  })

  return NextResponse.json({ url: checkoutSession.url })
}
