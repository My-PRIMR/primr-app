/**
 * POST /api/courses/[id]/generate
 * Receives the full course tree + document text chunks.
 * Creates sections/chapters/chapter_lessons in DB, then starts background generation.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { courses, courseSections, courseChapters, chapterLessons } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { auth } from '@/auth'
import { runCourseGeneration, type LessonGenInput } from '@/lib/course-gen'
import type { CourseTree } from '@/types/course'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: courseId } = await params

  const course = await db.query.courses.findFirst({ where: eq(courses.id, courseId) })
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (course.createdBy !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as { tree: CourseTree }
  const { tree } = body

  if (!tree?.sections?.length) {
    return NextResponse.json({ error: 'tree with sections is required' }, { status: 400 })
  }

  // Create the full structure in DB
  const lessonInputs: LessonGenInput[] = []
  let globalPosition = 0

  for (let si = 0; si < tree.sections.length; si++) {
    const section = tree.sections[si]
    const [dbSection] = await db.insert(courseSections).values({
      courseId,
      title: section.title,
      inferred: section.inferred,
      position: si,
    }).returning()

    for (let ci = 0; ci < section.chapters.length; ci++) {
      const chapter = section.chapters[ci]
      const [dbChapter] = await db.insert(courseChapters).values({
        sectionId: dbSection.id,
        title: chapter.title,
        position: ci,
      }).returning()

      for (let li = 0; li < chapter.lessons.length; li++) {
        const lesson = chapter.lessons[li]
        const [dbLesson] = await db.insert(chapterLessons).values({
          chapterId: dbChapter.id,
          title: lesson.title,
          position: li,
          generationStatus: 'pending',
          sourceText: lesson.sourceText || null,
          audience: lesson.audience || null,
          level: lesson.level || null,
        }).returning()

        lessonInputs.push({
          chapterLessonId: dbLesson.id,
          title: lesson.title,
          sourceText: lesson.sourceText,
          audience: lesson.audience,
          level: lesson.level,
        })
        globalPosition++
      }
    }
  }

  // Update course title/description from tree if provided
  await db.update(courses).set({
    title: tree.title || course.title,
    description: tree.description || course.description,
    updatedAt: new Date(),
  }).where(eq(courses.id, courseId))

  // Fire and forget — background generation
  const userId = session.user.id
  runCourseGeneration(courseId, lessonInputs, userId).catch(err => {
    console.error(`[generate] Unhandled error in course generation for ${courseId}:`, err)
  })

  return NextResponse.json({
    courseId,
    lessonCount: lessonInputs.length,
    status: 'generating',
  }, { status: 202 })
}
