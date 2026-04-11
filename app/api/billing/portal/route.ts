import { NextResponse } from 'next/server'
import { getSession } from '@/session'
import { getStripe } from '@/stripe'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function POST() {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  })
  if (!user?.stripeCustomerId) {
    return NextResponse.json(
      { error: 'No active subscription' },
      { status: 400 },
    )
  }

  const stripe = getStripe()
  const portal = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url:
      process.env.STRIPE_PORTAL_RETURN_URL ??
      `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/settings/billing`,
  })

  return NextResponse.json({ url: portal.url })
}
