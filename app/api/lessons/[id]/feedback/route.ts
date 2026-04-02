import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { lessons, lessonAttempts, lessonFeedback } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { getSession } from '@/session'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: lessonId } = await params

  // Verify lesson exists and is accessible
  const lesson = await db.query.lessons.findFirst({
    where: eq(lessons.id, lessonId),
  })
  if (!lesson) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await req.json() as {
    attemptId: string
    rating?: number
    comment?: string
    blockFlags?: Array<{ blockId: string; comment: string }>
  }

  const { attemptId, rating, comment, blockFlags = [] } = body

  // Validate attemptId belongs to this user and this lesson
  const attempt = await db.query.lessonAttempts.findFirst({
    where: and(
      eq(lessonAttempts.id, attemptId),
      eq(lessonAttempts.userId, session.user.id),
      eq(lessonAttempts.lessonId, lessonId),
    ),
  })
  if (!attempt) {
    return NextResponse.json({ error: 'Invalid attempt' }, { status: 403 })
  }

  // Validate rating if provided
  if (rating !== undefined && (rating < 1 || rating > 5 || !Number.isInteger(rating))) {
    return NextResponse.json({ error: 'Rating must be 1–5' }, { status: 400 })
  }

  // Upsert: one feedback row per attempt. A second call (e.g. adding rating after
  // flags were saved at lesson-complete) updates rating, comment, and blockFlags.
  try {
    const [row] = await db
      .insert(lessonFeedback)
      .values({
        lessonId,
        attemptId,
        rating: rating ?? null,
        comment: comment ?? null,
        blockFlags,
      })
      .onConflictDoUpdate({
        target: lessonFeedback.attemptId,
        set: {
          rating: sql`excluded.rating`,
          comment: sql`excluded.comment`,
          blockFlags: sql`excluded.block_flags`,
        },
      })
      .returning({ id: lessonFeedback.id })

    return NextResponse.json({ id: row.id })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
