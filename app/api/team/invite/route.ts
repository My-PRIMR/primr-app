import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getSession } from '@/session'
import { db } from '@/db'
import {
  users,
  organizations,
  teamInvitations,
} from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { sendEmail } from '@/lib/email'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const INVITE_TTL_DAYS = 14

export async function POST(req: Request) {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as { email?: string }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  })
  if (!user?.organizationId) {
    return NextResponse.json(
      { error: 'You are not in an organization' },
      { status: 400 },
    )
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, user.organizationId),
  })
  if (!org || org.ownerId !== session.user.id) {
    return NextResponse.json(
      { error: 'Only the organization owner can invite members' },
      { status: 403 },
    )
  }

  const members = await db.query.users.findMany({
    where: eq(users.organizationId, org.id),
  })
  const pending = await db.query.teamInvitations.findMany({
    where: and(
      eq(teamInvitations.organizationId, org.id),
      eq(teamInvitations.status, 'pending'),
    ),
  })
  if (members.length + pending.length >= org.seatLimit) {
    return NextResponse.json(
      { error: 'Seat limit reached' },
      { status: 400 },
    )
  }

  if (!body.email || !EMAIL_RE.test(body.email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000)

  await db.insert(teamInvitations).values({
    organizationId: org.id,
    email: body.email,
    invitedByUserId: session.user.id,
    token,
    expiresAt,
  })

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const acceptUrl = `${baseUrl}/team/accept/${token}`
  const html = `
    <p>You&rsquo;ve been invited to join <strong>${escapeHtml(org.name)}</strong> on Primr.</p>
    <p><a href="${acceptUrl}">Accept invitation</a></p>
    <p>This link expires in ${INVITE_TTL_DAYS} days.</p>
  `
  await sendEmail({
    to: body.email,
    subject: `Join ${org.name} on Primr`,
    html,
  })

  return NextResponse.json({ ok: true })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
