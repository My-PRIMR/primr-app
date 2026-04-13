import { notFound } from 'next/navigation'
import { db } from '@/db'
import { courses, courseSections, courseChapters, chapterLessons, lessons } from '@/db/schema'
import { eq, asc, and } from 'drizzle-orm'
import type { LessonManifest } from '@primr/components'
import EmbedCoursePlayer from './EmbedCoursePlayer'

export default async function EmbedCoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ theme?: string; lesson?: string }>
}) {
  const { id: courseId } = await params
  const { theme, lesson: initialLessonId } = await searchParams

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(courseId)) notFound()

  const course = await db.query.courses.findFirst({
    where: eq(courses.id, courseId),
  })

  if (!course || !course.embeddable || course.status !== 'published') notFound()

  // Build course tree (same logic as learn/course/[id]/page.tsx, without auth)
  const sections = await db.select().from(courseSections)
    .where(eq(courseSections.courseId, courseId))
    .orderBy(asc(courseSections.position))

  type TreeSection = {
    id: string; title: string; inferred: boolean; position: number
    chapters: Array<{
      id: string; title: string; position: number
      lessons: Array<{
        id: string; title: string; position: number
        lessonId: string | null; generationStatus: string; manifest?: LessonManifest
      }>
    }>
  }

  const tree: TreeSection[] = []

  for (const section of sections) {
    const chapters = await db.select().from(courseChapters)
      .where(eq(courseChapters.sectionId, section.id))
      .orderBy(asc(courseChapters.position))

    const chaptersWithLessons = []
    for (const chapter of chapters) {
      const cls = await db.select().from(chapterLessons)
        .where(and(eq(chapterLessons.chapterId, chapter.id), eq(chapterLessons.isDisabled, false)))
        .orderBy(asc(chapterLessons.position))

      const lessonsWithManifests = []
      for (const cl of cls) {
        let manifest: LessonManifest | undefined
        if (cl.lessonId) {
          const lesson = await db.query.lessons.findFirst({ where: eq(lessons.id, cl.lessonId) })
          manifest = lesson?.manifest
        }
        lessonsWithManifests.push({
          id: cl.id, title: cl.title, position: cl.position,
          lessonId: cl.lessonId, generationStatus: cl.generationStatus, manifest,
        })
      }
      chaptersWithLessons.push({ id: chapter.id, title: chapter.title, position: chapter.position, lessons: lessonsWithManifests })
    }
    tree.push({ id: section.id, title: section.title, inferred: section.inferred, position: section.position, chapters: chaptersWithLessons })
  }

  return (
    <EmbedCoursePlayer
      courseId={courseId}
      courseTitle={course.title}
      tree={tree}
      initialChapterLessonId={initialLessonId || null}
      initialTheme={theme === 'dark' ? 'dark' : theme === 'light' ? 'light' : undefined}
    />
  )
}
