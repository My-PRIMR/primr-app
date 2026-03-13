import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/db'
import { lessonInvitations, lessons, lessonAttempts } from '@/db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'

// GET — lessons the current user is invited to, with attempt stats
export async function GET() {
  const session = await auth()
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const email = session.user.email.toLowerCase()

  // Get invited lessons
  const invited = await db
    .select({
      id: lessons.id,
      title: lessons.title,
      slug: lessons.slug,
    })
    .from(lessonInvitations)
    .innerJoin(lessons, eq(lessonInvitations.lessonId, lessons.id))
    .where(eq(lessonInvitations.email, email))

  if (invited.length === 0) {
    return NextResponse.json({ lessons: [] })
  }

  // Get per-lesson attempt stats
  const lessonIds = invited.map(l => l.id)
  const stats = await db
    .select({
      lessonId: lessonAttempts.lessonId,
      attemptCount: sql<number>`count(*)::int`,
      bestScore: sql<number | null>`max(${lessonAttempts.score})`,
      lastAttempt: sql<string | null>`max(${lessonAttempts.completedAt})::text`,
    })
    .from(lessonAttempts)
    .where(and(
      eq(lessonAttempts.userId, session.user.id),
      sql`${lessonAttempts.lessonId} = ANY(${lessonIds})`,
    ))
    .groupBy(lessonAttempts.lessonId)

  const statsMap = new Map(stats.map(s => [s.lessonId, s]))

  const result = invited.map(lesson => ({
    ...lesson,
    attemptCount: statsMap.get(lesson.id)?.attemptCount ?? 0,
    bestScore: statsMap.get(lesson.id)?.bestScore ?? null,
    lastAttempt: statsMap.get(lesson.id)?.lastAttempt ?? null,
  }))

  return NextResponse.json({ lessons: result })
}
