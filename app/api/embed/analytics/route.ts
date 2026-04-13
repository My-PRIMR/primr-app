import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/session'
import { db } from '@/db'
import { lessons, courses } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const range = req.nextUrl.searchParams.get('range') || '30d'
  const daysAgo = range === '7d' ? 7 : range === 'all' ? 365 * 10 : 30
  const since = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)

  const userLessons = await db.select({ id: lessons.id }).from(lessons)
    .where(eq(lessons.createdBy, userId))
  const userCourses = await db.select({ id: courses.id }).from(courses)
    .where(eq(courses.createdBy, userId))

  const lessonIds = userLessons.map(l => l.id)
  const courseIds = userCourses.map(c => c.id)

  if (lessonIds.length === 0 && courseIds.length === 0) {
    return NextResponse.json({ views: 0, completions: 0, topDomains: [] })
  }

  const viewsResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM embed_events
    WHERE event_type = 'view'
    AND created_at >= ${since}
    AND (lesson_id = ANY(${lessonIds}) OR course_id = ANY(${courseIds}))
  `)

  const completionsResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM embed_events
    WHERE event_type IN ('lesson_complete', 'course_lesson_complete')
    AND created_at >= ${since}
    AND (lesson_id = ANY(${lessonIds}) OR course_id = ANY(${courseIds}))
  `)

  const topDomainsResult = await db.execute(sql`
    SELECT embed_origin, COUNT(*) as count FROM embed_events
    WHERE event_type = 'view'
    AND created_at >= ${since}
    AND (lesson_id = ANY(${lessonIds}) OR course_id = ANY(${courseIds}))
    GROUP BY embed_origin
    ORDER BY count DESC
    LIMIT 10
  `)

  return NextResponse.json({
    views: Number((viewsResult as unknown as Array<{ count: string }>)[0]?.count || 0),
    completions: Number((completionsResult as unknown as Array<{ count: string }>)[0]?.count || 0),
    topDomains: (topDomainsResult as unknown as Array<{ embed_origin: string; count: string }>).map(r => ({
      domain: r.embed_origin,
      count: Number(r.count),
    })),
  })
}
