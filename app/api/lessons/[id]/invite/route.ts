import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/db'
import { lessons, lessonInvitations } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

async function verifyOwner(lessonId: string, userId: string) {
  const lesson = await db.query.lessons.findFirst({
    where: and(eq(lessons.id, lessonId), eq(lessons.createdBy, userId)),
  })
  return lesson
}

// POST — bulk invite by email
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: lessonId } = await params
  if (!await verifyOwner(lessonId, session.user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { emails } = await req.json() as { emails: string[] }
  if (!Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: 'emails required' }, { status: 400 })
  }

  const normalized = emails.map(e => e.trim().toLowerCase()).filter(Boolean)

  const results = await db
    .insert(lessonInvitations)
    .values(normalized.map(email => ({
      lessonId,
      email,
      invitedBy: session.user.id,
    })))
    .onConflictDoNothing()
    .returning()

  return NextResponse.json({ invited: results.length })
}

// GET — list invited emails
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: lessonId } = await params
  if (!await verifyOwner(lessonId, session.user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const invitations = await db
    .select({ id: lessonInvitations.id, email: lessonInvitations.email, createdAt: lessonInvitations.createdAt })
    .from(lessonInvitations)
    .where(eq(lessonInvitations.lessonId, lessonId))

  return NextResponse.json({ invitations })
}

// DELETE — remove an invitation
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: lessonId } = await params
  if (!await verifyOwner(lessonId, session.user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { email } = await req.json() as { email: string }

  await db
    .delete(lessonInvitations)
    .where(and(
      eq(lessonInvitations.lessonId, lessonId),
      eq(lessonInvitations.email, email.toLowerCase()),
    ))

  return NextResponse.json({ ok: true })
}
