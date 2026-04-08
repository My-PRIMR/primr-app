import { NextResponse } from 'next/server'
import { getSession } from '@/session'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function PATCH() {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await db
    .update(users)
    .set({ onboardingDismissedAt: new Date() })
    .where(eq(users.id, session.user.id))

  return NextResponse.json({ dismissed: true })
}
