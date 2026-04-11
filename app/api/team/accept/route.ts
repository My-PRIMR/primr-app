import { NextResponse } from 'next/server'
import { getSession } from '@/session'
import { db } from '@/db'
import {
  users,
  organizations,
  teamInvitations,
  planSubscriptions,
} from '@/db/schema'
import { and, eq } from 'drizzle-orm'

export async function POST(req: Request) {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as { token?: string }
  if (!body.token) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 })
  }

  const invitation = await db.query.teamInvitations.findFirst({
    where: and(
      eq(teamInvitations.token, body.token),
      eq(teamInvitations.status, 'pending'),
    ),
  })
  if (!invitation) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (invitation.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Invitation expired' }, { status: 400 })
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, invitation.organizationId),
  })
  if (!org) {
    return NextResponse.json(
      { error: 'Organization not found' },
      { status: 404 },
    )
  }

  // Re-check seat count
  const members = await db.query.users.findMany({
    where: eq(users.organizationId, org.id),
  })
  if (members.length >= org.seatLimit) {
    return NextResponse.json({ error: 'Team is full' }, { status: 400 })
  }

  // Ensure org has an active subscription
  const activeSub = await db.query.planSubscriptions.findFirst({
    where: and(
      eq(planSubscriptions.organizationId, org.id),
      eq(planSubscriptions.status, 'active'),
    ),
  })
  if (!activeSub) {
    return NextResponse.json(
      { error: 'Organization has no active subscription' },
      { status: 400 },
    )
  }

  // Update user
  await db
    .update(users)
    .set({ organizationId: org.id, plan: 'pro' })
    .where(eq(users.id, session.user.id))

  // Mark invitation accepted
  await db
    .update(teamInvitations)
    .set({ status: 'accepted', acceptedByUserId: session.user.id })
    .where(eq(teamInvitations.id, invitation.id))

  return NextResponse.json({ ok: true })
}
