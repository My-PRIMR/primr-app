import { NextResponse } from 'next/server'
import { getSession } from '@/session'
import { getStripe } from '@/stripe'
import { db } from '@/db'
import { lessons, courses, creatorProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { calculatePlatformFee } from '@/monetization/fees'

export async function POST(req: Request) {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as {
    lessonId?: string
    courseId?: string
  }

  if (!body.lessonId && !body.courseId) {
    return NextResponse.json(
      { error: 'lessonId or courseId required' },
      { status: 400 },
    )
  }

  let title: string
  let priceCents: number
  let creatorId: string
  let kind: 'lesson' | 'course'

  if (body.lessonId) {
    const lesson = await db.query.lessons.findFirst({
      where: eq(lessons.id, body.lessonId),
    })
    if (!lesson) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (!lesson.isPaid || lesson.priceCents == null) {
      return NextResponse.json({ error: 'Lesson is not paid' }, { status: 400 })
    }
    if (!lesson.createdBy) {
      return NextResponse.json(
        { error: 'Lesson has no creator' },
        { status: 400 },
      )
    }
    title = lesson.title
    priceCents = lesson.priceCents
    creatorId = lesson.createdBy
    kind = 'lesson'
  } else {
    const course = await db.query.courses.findFirst({
      where: eq(courses.id, body.courseId!),
    })
    if (!course) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (!course.isPaid || course.priceCents == null) {
      return NextResponse.json({ error: 'Course is not paid' }, { status: 400 })
    }
    if (!course.createdBy) {
      return NextResponse.json(
        { error: 'Course has no creator' },
        { status: 400 },
      )
    }
    title = course.title
    priceCents = course.priceCents
    creatorId = course.createdBy
    kind = 'course'
  }

  const creator = await db.query.creatorProfiles.findFirst({
    where: eq(creatorProfiles.userId, creatorId),
  })
  if (!creator?.stripeAccountId || !creator.stripeOnboardingComplete) {
    return NextResponse.json(
      { error: 'Creator is not set up to receive payments' },
      { status: 400 },
    )
  }

  const fee = calculatePlatformFee({
    amountCents: priceCents,
    lifetimeRevenueCents: creator.lifetimeRevenueCents,
    revenueThresholdCents: creator.revenueThresholdCents,
  })

  const stripe = getStripe()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const itemId = body.lessonId ?? body.courseId!

  // Metadata is set at BOTH the session level and the payment_intent_data
  // level. Stripe does NOT copy payment_intent_data.metadata back onto the
  // session object, so the `checkout.session.completed` webhook only sees
  // session.metadata. We duplicate the values so the webhook handler can read
  // them directly off `session.metadata` without expanding the payment_intent.
  const primrMetadata = {
    primrBuyerId: session.user.id,
    primrCreatorId: creatorId,
    primrKind: kind,
    primrLessonId: body.lessonId ?? '',
    primrCourseId: body.courseId ?? '',
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: priceCents,
          product_data: { name: title },
        },
        quantity: 1,
      },
    ],
    metadata: primrMetadata,
    payment_intent_data: {
      application_fee_amount: fee.platformFeeCents,
      transfer_data: { destination: creator.stripeAccountId },
      metadata: primrMetadata,
    },
    success_url: `${baseUrl}/learn/${kind === 'course' ? 'course/' : ''}${itemId}?purchase=success`,
    cancel_url: `${baseUrl}/learn/${kind === 'course' ? 'course/' : ''}${itemId}?purchase=cancel`,
  })

  return NextResponse.json({ url: checkoutSession.url })
}
