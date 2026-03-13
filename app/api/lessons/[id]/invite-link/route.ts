import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { auth } from '@/auth'
import { db } from '@/db'
import { lessons, lessonInviteLinks } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

async function verifyOwner(lessonId: string, userId: string) {
  const lesson = await db.query.lessons.findFirst({
    where: and(eq(lessons.id, lessonId), eq(lessons.createdBy, userId)),
  })
  return lesson
}

// POST — generate or retrieve invite link
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: lessonId } = await params
  if (!await verifyOwner(lessonId, session.user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Return existing link if one exists
  const existing = await db.query.lessonInviteLinks.findFirst({
    where: eq(lessonInviteLinks.lessonId, lessonId),
  })
  if (existing) {
    return NextResponse.json({ token: existing.token })
  }

  const token = randomBytes(24).toString('base64url')
  await db.insert(lessonInviteLinks).values({
    lessonId,
    token,
    createdBy: session.user.id,
  })

  return NextResponse.json({ token })
}

// DELETE — revoke invite link
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: lessonId } = await params
  if (!await verifyOwner(lessonId, session.user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.delete(lessonInviteLinks).where(eq(lessonInviteLinks.lessonId, lessonId))

  return NextResponse.json({ ok: true })
}
