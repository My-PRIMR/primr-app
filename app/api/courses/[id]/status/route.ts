import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { courses, courseSections, courseChapters, chapterLessons } from '@/db/schema'
import { eq, asc } from 'drizzle-orm'
import { auth } from '@/auth'
import type { FlatLesson, CourseStatusResponse } from '@/types/course'

// GET /api/courses/[id]/status — poll generation progress
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const course = await db.query.courses.findFirst({ where: eq(courses.id, id) })
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Fetch flat lesson list with section/chapter titles
  const sections = await db.select().from(courseSections)
    .where(eq(courseSections.courseId, id))
    .orderBy(asc(courseSections.position))

  const flatLessons: FlatLesson[] = []
  let position = 0

  for (const section of sections) {
    const chapters = await db.select().from(courseChapters)
      .where(eq(courseChapters.sectionId, section.id))
      .orderBy(asc(courseChapters.position))

    for (const chapter of chapters) {
      const lessons = await db.select().from(chapterLessons)
        .where(eq(chapterLessons.chapterId, chapter.id))
        .orderBy(asc(chapterLessons.position))

      for (const lesson of lessons) {
        flatLessons.push({
          chapterLessonId: lesson.id,
          chapterId: chapter.id,
          sectionTitle: section.title,
          chapterTitle: chapter.title,
          title: lesson.title,
          position: position++,
          generationStatus: lesson.generationStatus,
          lessonId: lesson.lessonId,
        })
      }
    }
  }

  const response: CourseStatusResponse = {
    courseId: id,
    courseStatus: course.status,
    lessons: flatLessons,
  }

  return NextResponse.json(response)
}
