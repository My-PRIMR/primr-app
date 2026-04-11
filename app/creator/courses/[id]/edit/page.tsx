import { notFound, redirect } from 'next/navigation'
import { db } from '@/db'
import { courses, courseSections, courseChapters, chapterLessons } from '@/db/schema'
import { eq, asc } from 'drizzle-orm'
import { getSession } from '@/session'
import { toPageHeaderUser } from '../../../../components/pageHeaderUser'
import CourseEditClient from './CourseEditClient'
import type { FullCourseTree } from '@/types/course'

export default async function CourseEditPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.user?.id) redirect('/login')

  const { id } = await params

  const course = await db.query.courses.findFirst({ where: eq(courses.id, id) })
  if (!course) notFound()
  if (course.createdBy !== session.user.id) notFound()

  const sections = await db.select().from(courseSections)
    .where(eq(courseSections.courseId, id))
    .orderBy(asc(courseSections.position))

  const allChapters = sections.length
    ? await db.select().from(courseChapters)
        .where(eq(courseChapters.sectionId, sections[0].id)) // overridden below
        .then(async () => {
          const result = []
          for (const section of sections) {
            const ch = await db.select().from(courseChapters)
              .where(eq(courseChapters.sectionId, section.id))
              .orderBy(asc(courseChapters.position))
            result.push(...ch)
          }
          return result
        })
    : []

  const allLessons = allChapters.length
    ? await (async () => {
        const result = []
        for (const chapter of allChapters) {
          const cl = await db.select().from(chapterLessons)
            .where(eq(chapterLessons.chapterId, chapter.id))
            .orderBy(asc(chapterLessons.position))
          result.push(...cl)
        }
        return result
      })()
    : []

  const tree: FullCourseTree = {
    id: course.id,
    title: course.title,
    slug: course.slug,
    description: course.description,
    isPublic: course.isPublic,
    status: course.status as FullCourseTree['status'],
    createdBy: course.createdBy,
    priceCents: course.priceCents,
    isPaid: course.isPaid,
    sections: sections.map(s => ({
      id: s.id,
      title: s.title,
      inferred: s.inferred,
      position: s.position,
      chapters: allChapters
        .filter(c => c.sectionId === s.id)
        .map(c => ({
          id: c.id,
          title: c.title,
          position: c.position,
          lessons: allLessons
            .filter(l => l.chapterId === c.id)
            .map(l => ({
              id: l.id,
              title: l.title,
              position: l.position,
              generationStatus: l.generationStatus as 'pending' | 'generating' | 'done' | 'failed',
              lessonId: l.lessonId,
              isDisabled: l.isDisabled,
            })),
        })),
    })),
  }

  return (
    <CourseEditClient
      course={tree}
      plan={session.user.plan}
      internalRole={session.user.internalRole}
      user={toPageHeaderUser(session.user)}
    />
  )
}
