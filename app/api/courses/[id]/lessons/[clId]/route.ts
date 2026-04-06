import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { chapterLessons, courseChapters, courseSections, courses } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/session'
import { cancelLessonGeneration } from '@/lib/course-gen'
import { assertMutableCourse } from '@/lib/system-content'

// PATCH /api/courses/[id]/lessons/[clId] — toggle isDisabled on a chapter lesson
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; clId: string }> }
) {
  const session = await getSession()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: courseId, clId } = await params

  // Verify caller owns the course
  const course = await db.query.courses.findFirst({ where: eq(courses.id, courseId) })
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (course.createdBy !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const blocked = assertMutableCourse(course)
  if (blocked) return blocked

  const body = await req.json()
  if (typeof body.isDisabled !== 'boolean') {
    return NextResponse.json({ error: 'isDisabled (boolean) required' }, { status: 400 })
  }

  const [updated] = await db.update(chapterLessons)
    .set({ isDisabled: body.isDisabled })
    .where(eq(chapterLessons.id, clId))
    .returning()

  if (!updated) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })

  return NextResponse.json({ ok: true, isDisabled: updated.isDisabled })
}

// DELETE /api/courses/[id]/lessons/[clId] — remove a chapter lesson
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; clId: string }> }
) {
  const session = await getSession()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: courseId, clId } = await params

  const course = await db.query.courses.findFirst({ where: eq(courses.id, courseId) })
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (course.createdBy !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const blocked = assertMutableCourse(course)
  if (blocked) return blocked

  cancelLessonGeneration(clId)
  await db.delete(chapterLessons).where(eq(chapterLessons.id, clId))
  return NextResponse.json({ ok: true })
}
