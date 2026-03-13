import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/db'
import { lessonInviteLinks, lessonInvitations } from '@/db/schema'
import { eq } from 'drizzle-orm'

// GET — resolve invite token, create invitation, redirect to lesson
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const session = await auth()
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.redirect(new URL('/login', _req.url))
  }

  const { token } = await params

  const link = await db.query.lessonInviteLinks.findFirst({
    where: eq(lessonInviteLinks.token, token),
  })
  if (!link) {
    return NextResponse.json({ error: 'Invalid or expired invite link' }, { status: 404 })
  }

  // Auto-create invitation for logged-in user (skip if exists)
  await db
    .insert(lessonInvitations)
    .values({
      lessonId: link.lessonId,
      email: session.user.email.toLowerCase(),
      invitedBy: link.createdBy,
    })
    .onConflictDoNothing()

  return NextResponse.redirect(new URL(`/learn/${link.lessonId}`, _req.url))
}
