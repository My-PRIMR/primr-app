import { NextResponse } from 'next/server'
import { getSession, issueSession } from '@/session'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function POST() {
  const session = await getSession()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'learner') return NextResponse.json({ error: 'Already a creator' }, { status: 400 })

  await db.update(users).set({ productRole: 'creator' }).where(eq(users.id, session.user.id))

  await issueSession({
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: 'creator',
  })

  return NextResponse.json({ ok: true })
}
