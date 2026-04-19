import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/session'
import { db } from '@/db'
import { lessonAttempts, lessons } from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { canAccessLesson } from '@/lib/lesson-access'

// POST — find or create an attempt (resumes latest in-progress attempt for non-exam lessons)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: lessonId } = await params

  const hasAccess = await canAccessLesson(lessonId, session.user.id, session.user.email, session.user.internalRole)
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const lesson = await db.query.lessons.findFirst({
    where: eq(lessons.id, lessonId),
  })
  if (!lesson) {
    return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
  }

  // Find latest in-progress attempt to resume
  const existing = await db.query.lessonAttempts.findFirst({
    where: and(
      eq(lessonAttempts.userId, session.user.id),
      eq(lessonAttempts.lessonId, lessonId),
      eq(lessonAttempts.status, 'in_progress'),
    ),
    orderBy: desc(lessonAttempts.startedAt),
  })

  if (existing) {
    return NextResponse.json({ attempt: existing })
  }

  const [attempt] = await db.insert(lessonAttempts).values({
    userId: session.user.id,
    lessonId,
    totalBlocks: lesson.manifest.blocks.length,
  }).returning()

  return NextResponse.json({ attempt })
}

// GET — list attempts for this lesson by current user
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: lessonId } = await params

  const attempts = await db
    .select()
    .from(lessonAttempts)
    .where(and(
      eq(lessonAttempts.userId, session.user.id),
      eq(lessonAttempts.lessonId, lessonId),
    ))
    .orderBy(desc(lessonAttempts.startedAt))

  return NextResponse.json({ attempts })
}
