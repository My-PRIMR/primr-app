import { NextRequest, NextResponse } from 'next/server'
import { getSession, issueSession } from '@/session'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  let body: { name?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  if (typeof body.name !== 'string') {
    return NextResponse.json({ error: 'Name is required.' }, { status: 400 })
  }

  const trimmed = body.name.trim()
  if (trimmed.length === 0) {
    return NextResponse.json({ error: 'Name cannot be empty.' }, { status: 400 })
  }
  if (trimmed.length > 100) {
    return NextResponse.json({ error: 'Name must be 100 characters or fewer.' }, { status: 400 })
  }

  await db.update(users).set({ name: trimmed }).where(eq(users.id, session.user.id))

  await issueSession({
    id:           session.user.id,
    email:        session.user.email,
    name:         trimmed,
    productRole:  session.user.productRole,
    plan:         session.user.plan,
    internalRole: session.user.internalRole,
  })

  return NextResponse.json({ ok: true, name: trimmed })
}
