import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { embedEvents, lessons, courses } from '@/db/schema'
import { eq } from 'drizzle-orm'

const ALLOWED_EVENT_TYPES = ['view', 'block_complete', 'lesson_complete', 'course_lesson_complete']

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { lessonId, courseId, eventType, anonymousSessionId, embedOrigin, payload } = body as {
    lessonId?: string
    courseId?: string
    eventType?: string
    anonymousSessionId?: string
    embedOrigin?: string
    payload?: Record<string, unknown>
  }

  if (!eventType || !ALLOWED_EVENT_TYPES.includes(eventType)) {
    return NextResponse.json({ error: 'Invalid event type' }, { status: 400 })
  }

  if (!anonymousSessionId) {
    return NextResponse.json({ error: 'Missing anonymousSessionId' }, { status: 400 })
  }

  if (!lessonId && !courseId) {
    return NextResponse.json({ error: 'Must provide lessonId or courseId' }, { status: 400 })
  }

  // Validate that the content is embeddable
  if (lessonId && !courseId) {
    const [lesson] = await db.select({ showcase: lessons.showcase })
      .from(lessons).where(eq(lessons.id, lessonId)).limit(1)
    if (!lesson?.showcase) {
      return NextResponse.json({ error: 'Not embeddable' }, { status: 403 })
    }
  }

  if (courseId) {
    const [course] = await db.select({ embeddable: courses.embeddable })
      .from(courses).where(eq(courses.id, courseId)).limit(1)
    if (!course?.embeddable) {
      return NextResponse.json({ error: 'Not embeddable' }, { status: 403 })
    }
  }

  const origin = typeof embedOrigin === 'string' ? embedOrigin : req.headers.get('referer') || 'unknown'

  await db.insert(embedEvents).values({
    lessonId: lessonId || null,
    courseId: courseId || null,
    eventType,
    embedOrigin: origin,
    anonymousSessionId,
    payload: payload || null,
  })

  return NextResponse.json({ ok: true })
}
