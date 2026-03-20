import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getSession } from '@/session'
import { db } from '@/db'
import { lessons, lessonInvitations, lessonInviteLinks } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { sendEmail } from '@/lib/email'

async function verifyOwner(lessonId: string, userId: string) {
  const lesson = await db.query.lessons.findFirst({
    where: and(eq(lessons.id, lessonId), eq(lessons.createdBy, userId)),
  })
  return lesson
}

// POST — bulk invite by email
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: lessonId } = await params
  const lesson = await verifyOwner(lessonId, session.user.id)
  if (!lesson) {
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

  // Ensure a reusable invite link exists so email recipients can self-accept.
  const existingLink = await db.query.lessonInviteLinks.findFirst({
    where: eq(lessonInviteLinks.lessonId, lessonId),
  })
  const token = existingLink?.token ?? randomBytes(24).toString('base64url')
  if (!existingLink) {
    await db.insert(lessonInviteLinks).values({ lessonId, token, createdBy: session.user.id })
  }

  const appUrl = process.env.PRIMR_APP_URL ?? new URL(req.url).origin
  const inviteUrl = `${appUrl}/api/invite/${token}`

  let emailed = 0
  const emailFailures: Array<{ email: string; error: string }> = []
  for (const row of results) {
    const emailResult = await sendEmail({
      to: row.email,
      subject: `You're invited to a Primr lesson`,
      html: `<p>You were invited to join a lesson on Primr${lesson.title ? `: <strong>${lesson.title}</strong>` : ''}.</p><p><a href="${inviteUrl}">Accept invite</a></p>`,
      text: `You were invited to join a lesson on Primr${lesson.title ? `: ${lesson.title}` : ''}.\n\nAccept invite: ${inviteUrl}`,
    })
    if (emailResult.ok) {
      emailed += 1
      continue
    }
    emailFailures.push({
      email: row.email,
      error: emailResult.error ?? emailResult.reason ?? 'unknown email error',
    })
  }

  return NextResponse.json({ invited: results.length, emailed, emailFailures })
}

// GET — list invited emails
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
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
  const session = await getSession()
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
