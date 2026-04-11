import { NextResponse } from 'next/server'
import { getSession } from '@/session'
import { db } from '@/db'
import { users, organizations } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { userId: targetId } = await params
  if (targetId === session.user.id) {
    return NextResponse.json(
      { error: 'Cannot remove yourself' },
      { status: 400 },
    )
  }

  const currentUser = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  })
  if (!currentUser?.organizationId) {
    return NextResponse.json(
      { error: 'You are not in an organization' },
      { status: 400 },
    )
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, currentUser.organizationId),
  })
  if (!org || org.ownerId !== session.user.id) {
    return NextResponse.json(
      { error: 'Only the organization owner can remove members' },
      { status: 403 },
    )
  }

  const target = await db.query.users.findFirst({
    where: eq(users.id, targetId),
  })
  if (!target || target.organizationId !== org.id) {
    return NextResponse.json(
      { error: 'User is not in your organization' },
      { status: 404 },
    )
  }

  await db
    .update(users)
    .set({ organizationId: null, plan: 'free' })
    .where(eq(users.id, targetId))

  return NextResponse.json({ ok: true })
}
