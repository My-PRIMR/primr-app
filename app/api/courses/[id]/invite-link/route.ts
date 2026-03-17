import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getSession } from '@/session'
import { db } from '@/db'
import { courses, courseInviteLinks } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

async function verifyOwner(courseId: string, userId: string) {
  return db.query.courses.findFirst({
    where: and(eq(courses.id, courseId), eq(courses.createdBy, userId)),
  })
}

// POST — generate or retrieve invite link
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: courseId } = await params
  if (!await verifyOwner(courseId, session.user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const existing = await db.query.courseInviteLinks.findFirst({
    where: eq(courseInviteLinks.courseId, courseId),
  })
  if (existing) return NextResponse.json({ token: existing.token })

  const token = randomBytes(24).toString('base64url')
  await db.insert(courseInviteLinks).values({ courseId, token, createdBy: session.user.id })

  return NextResponse.json({ token })
}

// DELETE — revoke invite link
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: courseId } = await params
  if (!await verifyOwner(courseId, session.user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.delete(courseInviteLinks).where(eq(courseInviteLinks.courseId, courseId))
  return NextResponse.json({ ok: true })
}
