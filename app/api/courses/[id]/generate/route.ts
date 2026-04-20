/**
 * POST /api/courses/[id]/generate
 * Receives the full course tree + document text chunks.
 * Creates sections/chapters/chapter_lessons in DB, then starts background generation.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { courses, courseSections, courseChapters, chapterLessons } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/session'
import { resolveModel, getDefaultModel, modelById, canSelectModels } from '@/lib/models'
import { checkCap, logUsage } from '@/lib/usage-cap'
import { runCourseGeneration, type LessonGenInput } from '@/lib/course-gen'
import { assertMutableCourse } from '@/lib/system-content'
import { users } from '@/db/schema'
import type { CourseTree } from '@/types/course'

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
  const blocked = assertMutableCourse(course)
  if (blocked) return blocked

  const body = await req.json() as { tree: CourseTree, model?: string, passiveLesson?: boolean, skipHero?: boolean, notifyEmail?: boolean, includeImages?: boolean }
  const { tree, model, passiveLesson, skipHero, notifyEmail, includeImages } = body

  if (!tree?.sections?.length) {
    return NextResponse.json({ error: 'tree with sections is required' }, { status: 400 })
  }

  const internalRole = session.user.internalRole ?? null
  const productRole = session.user.productRole ?? null
  let resolvedModel = modelById(await getDefaultModel())!
  if (model) {
    const m = resolveModel(model, internalRole, productRole)
    if (!m) return NextResponse.json({ error: 'Unauthorized model selection' }, { status: 403 })
    resolvedModel = m
  }

  const { allowed } = await checkCap(session.user.id, resolvedModel.id)
  if (!allowed) {
    const resetAt = new Date()
    resetAt.setUTCHours(24, 0, 0, 0)
    return NextResponse.json({ error: 'Daily generation limit reached', resetAt: resetAt.toISOString() }, { status: 429 })
  }

  // Create the full structure in DB
  const lessonInputs: LessonGenInput[] = []

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
          focus: lesson.focus,
          videoUrl: lesson.videoUrl,
          videoStartTime: lesson.videoStartTime,
          videoEndTime: lesson.videoEndTime,
        })
      }
    }
  }

  // Update course title/description from tree if provided
  await db.update(courses).set({
    title: tree.title || course.title,
    description: tree.description || course.description,
    updatedAt: new Date(),
  }).where(eq(courses.id, courseId))

  // Look up creator email for completion notification
  let creatorEmail: string | undefined
  if (notifyEmail) {
    const creator = await db.query.users.findFirst({ where: eq(users.id, session.user.id) })
    creatorEmail = creator?.email
  }

  // Fire and forget — background generation
  const userId = session.user.id
  runCourseGeneration(courseId, lessonInputs, userId, resolvedModel.id, passiveLesson && canSelectModels(internalRole, productRole), creatorEmail, !!skipHero, includeImages && canSelectModels(internalRole, productRole)).catch(err => {
    console.error(`[generate] Unhandled error in course generation for ${courseId}:`, err)
  })

  // Log usage at generation start (fire-and-forget means we can't log on completion)
  await logUsage(userId, 'course', resolvedModel.id)

  return NextResponse.json({
    courseId,
    lessonCount: lessonInputs.length,
    status: 'generating',
  }, { status: 202 })
}
