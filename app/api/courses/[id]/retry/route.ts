/**
 * POST /api/courses/[id]/retry
 * Retry failed lesson(s). Body: { chapterLessonIds: string[] }
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { courses, chapterLessons } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { getSession } from '@/session'
import { runCourseGeneration, type LessonGenInput } from '@/lib/course-gen'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: courseId } = await params
  const course = await db.query.courses.findFirst({ where: eq(courses.id, courseId) })
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (course.createdBy !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { chapterLessonIds } = await req.json() as { chapterLessonIds: string[] }
  if (!chapterLessonIds?.length) return NextResponse.json({ error: 'chapterLessonIds required' }, { status: 400 })

  const rows = await db.select().from(chapterLessons)
    .where(inArray(chapterLessons.id, chapterLessonIds))

  const lessonInputs: LessonGenInput[] = rows.map(r => ({
    chapterLessonId: r.id,
    title: r.title,
    sourceText: r.sourceText ?? undefined,
    audience: r.audience ?? undefined,
    level: r.level ?? undefined,
  }))

  // Reset to pending before retrying
  await db.update(chapterLessons)
    .set({ generationStatus: 'pending', lessonId: null })
    .where(inArray(chapterLessons.id, chapterLessonIds))

  runCourseGeneration(courseId, lessonInputs, session.user.id).catch(err => {
    console.error(`[retry] Unhandled error in retry for ${courseId}:`, err)
  })

  return NextResponse.json({ status: 'retrying', count: lessonInputs.length }, { status: 202 })
}
