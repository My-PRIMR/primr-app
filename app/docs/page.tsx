import { redirect } from 'next/navigation'
import { getSession } from '@/session'
import { db } from '@/db'
import { courses, courseSections, courseChapters, chapterLessons, lessons } from '@/db/schema'
import { eq, asc, and } from 'drizzle-orm'
import LearnHeader from '../learn/LearnHeader'
import DocsPlayer from './DocsPlayer'
import type { LessonManifest } from '@primr/components'

export const dynamic = 'force-dynamic'

export default async function DocsPage() {
  const session = await getSession()
  if (!session?.user?.id || !session.user.email) redirect('/login')

  const header = (
    <LearnHeader
      userName={session.user.name}
      userEmail={session.user.email}
      role={session.user.productRole}
      internalRole={session.user.internalRole}
      internalUrl={process.env.PRIMR_INTERNAL_URL ?? 'http://localhost:3004'}
    />
  )

  const courseId = process.env.PRIMR_DOCS_COURSE_ID

  if (!courseId) {
    return (
      <>
        {header}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 60px)', color: 'var(--ink-muted)', fontFamily: 'DM Sans, system-ui, sans-serif' }}>
          Documentation is not available.
        </div>
      </>
    )
  }

  const course = await db.query.courses.findFirst({ where: eq(courses.id, courseId) })

  if (!course) {
    return (
      <>
        {header}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 60px)', color: 'var(--ink-muted)', fontFamily: 'DM Sans, system-ui, sans-serif' }}>
          Documentation is not available.
        </div>
      </>
    )
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
      {header}
      <DocsPlayer
        courseTitle={course.title}
        userRole={session.user.productRole}
        tree={tree}
      />
    </>
  )
}
