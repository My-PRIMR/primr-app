import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/session'
import { db } from '@/db'
import { courseInviteLinks, courseEnrollments } from '@/db/schema'
import { eq } from 'drizzle-orm'

// GET — resolve course invite token, enroll user, redirect to course
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const session = await getSession()
  const appUrl = process.env.PRIMR_APP_URL ?? 'http://localhost:3000'

  if (!session?.user?.id || !session.user.email) {
    return NextResponse.redirect(new URL('/login', appUrl))
  }

  const { token } = await params

  const link = await db.query.courseInviteLinks.findFirst({
    where: eq(courseInviteLinks.token, token),
  })
  if (!link) {
    return NextResponse.json({ error: 'Invalid or expired invite link' }, { status: 404 })
  }

  await db
    .insert(courseEnrollments)
    .values({
      courseId: link.courseId,
      email: session.user.email.toLowerCase(),
      enrolledBy: link.createdBy,
    })
    .onConflictDoNothing()

  return NextResponse.redirect(new URL(`/learn/course/${link.courseId}`, appUrl))
}
