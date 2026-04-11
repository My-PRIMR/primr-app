import { NextResponse } from 'next/server'
import { getSession } from '@/session'
import { getStripe } from '@/stripe'
import { db } from '@/db'
import { creatorProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function POST() {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id
  const email = session.user.email

  const stripe = getStripe()

  const existing = await db.query.creatorProfiles.findFirst({
    where: eq(creatorProfiles.userId, userId),
  })

  let stripeAccountId = existing?.stripeAccountId ?? null
  if (!stripeAccountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      email: email ?? undefined,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: { primrUserId: userId },
    })
    stripeAccountId = account.id

    if (existing) {
      await db
        .update(creatorProfiles)
        .set({ stripeAccountId, updatedAt: new Date() })
        .where(eq(creatorProfiles.userId, userId))
    } else {
      await db.insert(creatorProfiles).values({
        userId,
        stripeAccountId,
      })
    }
  }

  const link = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url:
      process.env.STRIPE_CONNECT_REFRESH_URL ??
      `${process.env.NEXT_PUBLIC_APP_URL}/creator/monetization?stripe=refresh`,
    return_url:
      process.env.STRIPE_CONNECT_RETURN_URL ??
      `${process.env.NEXT_PUBLIC_APP_URL}/creator/monetization?stripe=return`,
    type: 'account_onboarding',
  })

  return NextResponse.json({ url: link.url })
}
