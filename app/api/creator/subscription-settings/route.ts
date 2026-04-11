import { NextResponse } from 'next/server'
import { getSession } from '@/session'
import { db } from '@/db'
import { creatorProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'

const MIN_SUB_CENTS = 100 // $1
const MAX_SUB_CENTS = 10000 // $100

export async function PATCH(req: Request) {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as { enabled: boolean; priceCents: number | null }

  const profile = await db.query.creatorProfiles.findFirst({
    where: eq(creatorProfiles.userId, session.user.id),
  })
  if (!profile?.stripeOnboardingComplete) {
    return NextResponse.json(
      { error: 'Complete Stripe onboarding first' },
      { status: 400 },
    )
  }

  if (body.enabled) {
    if (
      typeof body.priceCents !== 'number' ||
      body.priceCents < MIN_SUB_CENTS ||
      body.priceCents > MAX_SUB_CENTS
    ) {
      return NextResponse.json(
        { error: 'Subscription price must be between $1 and $100/mo' },
        { status: 400 },
      )
    }
  }

  await db
    .update(creatorProfiles)
    .set({
      subscriptionEnabled: body.enabled,
      subscriptionPriceCents: body.enabled ? body.priceCents : null,
      updatedAt: new Date(),
    })
    .where(eq(creatorProfiles.userId, session.user.id))

  return NextResponse.json({ ok: true })
}
