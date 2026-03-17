import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { courses, courseSections, courseChapters, chapterLessons, lessonAttempts } from '@/db/schema'
import { eq, asc, and, inArray } from 'drizzle-orm'
import { getSession } from '@/session'

// GET /api/courses/[id]/progress — learner's progress through the course
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const course = await db.query.courses.findFirst({ where: eq(courses.id, id) })
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Get all chapter_lessons for this course in flat order
  const sections = await db.select().from(courseSections)
    .where(eq(courseSections.courseId, id))
    .orderBy(asc(courseSections.position))

  const flatLessonIds: string[] = []
  const flatChapterLessons: Array<{ id: string; lessonId: string | null; title: string }> = []

  for (const section of sections) {
    const chapters = await db.select().from(courseChapters)
      .where(eq(courseChapters.sectionId, section.id))
      .orderBy(asc(courseChapters.position))

    for (const chapter of chapters) {
      const cls = await db.select().from(chapterLessons)
        .where(eq(chapterLessons.chapterId, chapter.id))
        .orderBy(asc(chapterLessons.position))

      for (const cl of cls) {
        if (cl.lessonId) flatLessonIds.push(cl.lessonId)
        flatChapterLessons.push({ id: cl.id, lessonId: cl.lessonId, title: cl.title })
      }
    }
  }

  // Find completed attempts for this user's lessons in this course
  const completedLessonIds = new Set<string>()
  if (flatLessonIds.length > 0) {
    const completedAttempts = await db.select({ lessonId: lessonAttempts.lessonId })
      .from(lessonAttempts)
      .where(
        and(
          eq(lessonAttempts.userId, session.user.id),
          eq(lessonAttempts.status, 'completed'),
          inArray(lessonAttempts.lessonId, flatLessonIds),
        )
      )
    for (const a of completedAttempts) completedLessonIds.add(a.lessonId)
  }

  // Determine next lesson: first chapter_lesson where lessonId is set but not completed
  let nextChapterLessonId: string | null = null
  for (const cl of flatChapterLessons) {
    if (cl.lessonId && !completedLessonIds.has(cl.lessonId)) {
      nextChapterLessonId = cl.id
      break
    }
  }

  const allDone = flatLessonIds.length > 0 &&
    flatChapterLessons.every(cl => !cl.lessonId || completedLessonIds.has(cl.lessonId))

  return NextResponse.json({
    completedLessonIds: [...completedLessonIds],
    nextChapterLessonId,
    allDone,
    totalLessons: flatChapterLessons.filter(cl => cl.lessonId).length,
    completedCount: completedLessonIds.size,
  })
}
