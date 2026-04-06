import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { db } from '@/db'
import { courses, courseEnrollments, courseInviteLinks } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { getSession } from '@/session'
import { sendEmail } from '@/lib/email'
import { courseInviteEmail } from '@/lib/email-templates'
import { checkStudentCap, TEACHER_STUDENT_CAP } from '@/lib/student-cap'

// GET /api/courses/[id]/enroll — list enrollments
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
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
  const session = await getSession()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const course = await db.query.courses.findFirst({ where: eq(courses.id, id) })
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (course.createdBy !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email } = await req.json()
  if (!email?.trim()) return NextResponse.json({ error: 'email is required' }, { status: 400 })

  const normalizedEmail = email.trim().toLowerCase()

  if (session.user.plan === 'teacher') {
    const result = await checkStudentCap(course.createdBy, normalizedEmail)
    if (result.capped) {
      return NextResponse.json({
        error: `${TEACHER_STUDENT_CAP}-student limit reached. Upgrade to a paid plan for unlimited seats.`,
        currentCount: result.count,
        cap: result.cap,
      }, { status: 402 })
    }
  }

  try {
    const [enrollment] = await db.insert(courseEnrollments).values({
      courseId: id,
      email: normalizedEmail,
      enrolledBy: session.user.id,
    }).onConflictDoNothing().returning()

    if (enrollment) {
      const existingLink = await db.query.courseInviteLinks.findFirst({
        where: eq(courseInviteLinks.courseId, id),
      })
      const token = existingLink?.token ?? randomBytes(24).toString('base64url')
      if (!existingLink) {
        await db.insert(courseInviteLinks).values({ courseId: id, token, createdBy: session.user.id })
      }

      const appUrl = process.env.PRIMR_APP_URL ?? new URL(req.url).origin
      const inviteUrl = `${appUrl}/api/course-invite/${token}`
      const emailResult = await sendEmail({
        to: normalizedEmail,
        ...await courseInviteEmail({ courseTitle: course.title, inviteUrl }),
      })

      return NextResponse.json(
        {
          enrollment,
          emailed: emailResult.ok,
          emailError: emailResult.ok ? null : (emailResult.error ?? emailResult.reason ?? 'unknown email error'),
        },
        { status: 201 }
      )
    }

    return NextResponse.json({ enrollment: null, emailed: false }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to enroll.' }, { status: 500 })
  }
}

// DELETE /api/courses/[id]/enroll — remove enrollment by email
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
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
