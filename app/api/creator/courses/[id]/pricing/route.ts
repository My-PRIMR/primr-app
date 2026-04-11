import { NextResponse } from 'next/server'
import { getSession } from '@/session'
import { db } from '@/db'
import { courses } from '@/db/schema'
import { eq } from 'drizzle-orm'

const MIN_PRICE_CENTS = 99

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const course = await db.query.courses.findFirst({
    where: eq(courses.id, id),
  })
  if (!course) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (course.createdBy !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await req.json()) as {
    priceCents: number | null
    isPaid: boolean
  }

  if (body.isPaid) {
    if (typeof body.priceCents !== 'number' || body.priceCents < MIN_PRICE_CENTS) {
      return NextResponse.json(
        { error: `Minimum price is $${(MIN_PRICE_CENTS / 100).toFixed(2)}` },
        { status: 400 },
      )
    }
  }

  await db
    .update(courses)
    .set({
      priceCents: body.isPaid ? body.priceCents : null,
      isPaid: body.isPaid,
      updatedAt: new Date(),
    })
    .where(eq(courses.id, id))

  return NextResponse.json({ ok: true })
}
