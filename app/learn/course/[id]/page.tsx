import { getSession } from '@/session'
import { redirect, notFound } from 'next/navigation'
import { db } from '@/db'
import { courses, courseSections, courseChapters, chapterLessons, courseEnrollments, lessons } from '@/db/schema'
import { eq, asc, and } from 'drizzle-orm'
import CoursePlayer from './CoursePlayer'
import LearnHeader from '../../LearnHeader'
import type { LessonManifest } from '@primr/components'

export const dynamic = 'force-dynamic'

export default async function CourseLearnPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ lesson?: string }>
}) {
  const session = await getSession()
  if (!session?.user?.id || !session.user.email) redirect('/login')

  const { id: courseId } = await params
  const { lesson: currentChapterLessonId } = await searchParams

  const course = await db.query.courses.findFirst({ where: eq(courses.id, courseId) })
  if (!course) notFound()

  const userId = session.user.id
  const userEmail = session.user.email.toLowerCase()
  const isCreator = course.createdBy === userId

  // Check enrollment (creators bypass)
  if (!isCreator) {
    const enrollment = await db.query.courseEnrollments.findFirst({
      where: and(
        eq(courseEnrollments.courseId, courseId),
        eq(courseEnrollments.email, userEmail),
      ),
    })
    if (!enrollment) redirect('/creator')
  }

  // Load full course tree
  const sections = await db.select().from(courseSections)
    .where(eq(courseSections.courseId, courseId))
    .orderBy(asc(courseSections.position))

  type CourseSectionWithChapters = {
    id: string
    title: string
    inferred: boolean
    position: number
    chapters: Array<{
      id: string
      title: string
      position: number
      lessons: Array<{
        id: string
        title: string
        position: number
        lessonId: string | null
        generationStatus: string
        manifest?: LessonManifest
      }>
    }>
  }

  const tree: CourseSectionWithChapters[] = []

  for (const section of sections) {
    const chapters = await db.select().from(courseChapters)
      .where(eq(courseChapters.sectionId, section.id))
      .orderBy(asc(courseChapters.position))

    const chaptersWithLessons = []
    for (const chapter of chapters) {
      const cls = await db.select().from(chapterLessons)
        .where(eq(chapterLessons.chapterId, chapter.id))
        .orderBy(asc(chapterLessons.position))

      // Load manifests for done lessons
      const lessonsWithManifests = []
      for (const cl of cls) {
        let manifest: LessonManifest | undefined
        if (cl.lessonId) {
          const lesson = await db.query.lessons.findFirst({ where: eq(lessons.id, cl.lessonId) })
          manifest = lesson?.manifest
        }
        lessonsWithManifests.push({
          id: cl.id,
          title: cl.title,
          position: cl.position,
          lessonId: cl.lessonId,
          generationStatus: cl.generationStatus,
          manifest,
        })
      }

      chaptersWithLessons.push({
        id: chapter.id,
        title: chapter.title,
        position: chapter.position,
        lessons: lessonsWithManifests,
      })
    }

    tree.push({
      id: section.id,
      title: section.title,
      inferred: section.inferred,
      position: section.position,
      chapters: chaptersWithLessons,
    })
  }

  return (
    <>
      <LearnHeader userName={session.user.name} userEmail={session.user.email} role={session.user.role} />
      <CoursePlayer
        courseId={courseId}
        courseTitle={course.title}
        userId={userId}
        tree={tree}
        initialChapterLessonId={currentChapterLessonId || null}
      />
    </>
  )
}
