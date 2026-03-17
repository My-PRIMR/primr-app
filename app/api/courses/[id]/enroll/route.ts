import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { courses, courseEnrollments } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { auth } from '@/auth'

// GET /api/courses/[id]/enroll — list enrollments
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const course = await db.query.courses.findFirst({ where: eq(courses.id, id) })
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (course.createdBy !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const enrollments = await db.select().from(courseEnrollments).where(eq(courseEnrollments.courseId, id))
  return NextResponse.json({ enrollments })
}

// POST /api/courses/[id]/enroll — enroll by email
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const course = await db.query.courses.findFirst({ where: eq(courses.id, id) })
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (course.createdBy !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email } = await req.json()
  if (!email?.trim()) return NextResponse.json({ error: 'email is required' }, { status: 400 })

  const normalizedEmail = email.trim().toLowerCase()

  try {
    const [enrollment] = await db.insert(courseEnrollments).values({
      courseId: id,
      email: normalizedEmail,
      enrolledBy: session.user.id,
    }).onConflictDoNothing().returning()

    return NextResponse.json({ enrollment: enrollment ?? null }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to enroll.' }, { status: 500 })
  }
}

// DELETE /api/courses/[id]/enroll — remove enrollment by email
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const course = await db.query.courses.findFirst({ where: eq(courses.id, id) })
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (course.createdBy !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email } = await req.json()
  if (!email?.trim()) return NextResponse.json({ error: 'email is required' }, { status: 400 })

  await db.delete(courseEnrollments).where(
    and(
      eq(courseEnrollments.courseId, id),
      eq(courseEnrollments.email, email.trim().toLowerCase()),
    )
  )

  return NextResponse.json({ ok: true })
}
