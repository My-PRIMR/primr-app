import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { courses, courseSections, courseChapters, chapterLessons, lessons } from '@/db/schema'
import { eq, asc, inArray } from 'drizzle-orm'
import { getSession } from '@/session'
import { cancelCourseGeneration } from '@/lib/course-gen'
import type { FullCourseTree } from '@/types/course'

// GET /api/courses/[id] — full course tree
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const course = await db.query.courses.findFirst({ where: eq(courses.id, id) })
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const sections = await db.select().from(courseSections).where(eq(courseSections.courseId, id)).orderBy(asc(courseSections.position))
  const chapters = sections.length
    ? await db.select().from(courseChapters)
        .where(eq(courseChapters.sectionId, sections[0].id))
        .orderBy(asc(courseChapters.position))
        .then(async () => {
          // Get chapters for ALL sections
          const allChapters = []
          for (const section of sections) {
            const sc = await db.select().from(courseChapters)
              .where(eq(courseChapters.sectionId, section.id))
              .orderBy(asc(courseChapters.position))
            allChapters.push(...sc)
          }
          return allChapters
        })
    : []

  const chapterIds = chapters.map(c => c.id)
  const allLessons = chapterIds.length
    ? await (async () => {
        const result = []
        for (const chId of chapterIds) {
          const cl = await db.select().from(chapterLessons)
            .where(eq(chapterLessons.chapterId, chId))
            .orderBy(asc(chapterLessons.position))
          result.push(...cl)
        }
        return result
      })()
    : []

  const lessonsByChapter = new Map(chapterIds.map(id => [id, allLessons.filter(l => l.chapterId === id)]))
  const chaptersBySection = new Map(sections.map(s => [
    s.id,
    chapters.filter(c => c.sectionId === s.id),
  ]))

  const tree: FullCourseTree = {
    id: course.id,
    title: course.title,
    slug: course.slug,
    description: course.description,
    isPublic: course.isPublic,
    status: course.status,
    createdBy: course.createdBy,
    sections: sections.map(section => ({
      id: section.id,
      title: section.title,
      inferred: section.inferred,
      position: section.position,
      chapters: (chaptersBySection.get(section.id) || []).map(chapter => ({
        id: chapter.id,
        title: chapter.title,
        position: chapter.position,
        lessons: (lessonsByChapter.get(chapter.id) || []).map(lesson => ({
          id: lesson.id,
          title: lesson.title,
          position: lesson.position,
          generationStatus: lesson.generationStatus,
          lessonId: lesson.lessonId,
          isDisabled: lesson.isDisabled,
        })),
      })),
    })),
  }

  return NextResponse.json({ course: tree })
}

// PATCH /api/courses/[id] — update course metadata
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const course = await db.query.courses.findFirst({ where: eq(courses.id, id) })
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (course.createdBy !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const updates: Partial<typeof course> = {}
  if (body.title !== undefined) updates.title = body.title
  if (body.description !== undefined) updates.description = body.description
  if (body.isPublic !== undefined) updates.isPublic = body.isPublic
  if (body.status !== undefined) updates.status = body.status

  const [updated] = await db.update(courses)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(courses.id, id))
    .returning()

  return NextResponse.json({ course: updated })
}

// DELETE /api/courses/[id] — delete a course created by current user
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const course = await db.query.courses.findFirst({ where: eq(courses.id, id) })
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (course.createdBy !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  cancelCourseGeneration(id)

  // Collect all lesson IDs belonging to this course before cascade deletes the join rows
  const sections = await db.select({ id: courseSections.id }).from(courseSections).where(eq(courseSections.courseId, id))
  const sectionIds = sections.map(s => s.id)
  let lessonIds: string[] = []
  if (sectionIds.length) {
    const chapters = await db.select({ id: courseChapters.id }).from(courseChapters).where(inArray(courseChapters.sectionId, sectionIds))
    const chapterIds = chapters.map(c => c.id)
    if (chapterIds.length) {
      const cls = await db.select({ lessonId: chapterLessons.lessonId }).from(chapterLessons).where(inArray(chapterLessons.chapterId, chapterIds))
      lessonIds = cls.map(cl => cl.lessonId).filter((id): id is string => id != null)
    }
  }

  // Delete the course (cascades to sections → chapters → chapter_lessons, enrollments, invite links)
  await db.delete(courses).where(eq(courses.id, id))

  // Delete the underlying lessons (not covered by cascade)
  if (lessonIds.length) {
    await db.delete(lessons).where(inArray(lessons.id, lessonIds))
  }

  return NextResponse.json({ ok: true })
}
