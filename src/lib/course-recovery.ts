/**
 * Startup recovery for courses stuck in 'generating' status.
 * Called once on server startup via instrumentation.ts.
 *
 * If the server was killed mid-generation, any courses with status='generating'
 * will never complete. This marks stuck lessons as 'failed' and courses as 'ready'
 * so creators can retry individual lessons from the editor, then emails the creator.
 */
import { db } from '@/db'
import { courses, courseSections, courseChapters, chapterLessons, users } from '@/db/schema'
import { and, eq, inArray, ne } from 'drizzle-orm'
import { sendEmail } from '@/lib/email'
import { courseInterruptedEmail } from '@/lib/email-templates'

export async function recoverStuckCourses(): Promise<void> {
  const stuckCourses = await db.query.courses.findMany({
    where: eq(courses.status, 'generating'),
  })

  if (stuckCourses.length === 0) return

  console.log(`[course-recovery] Found ${stuckCourses.length} stuck course(s) — recovering`)

  for (const course of stuckCourses) {
    // Collect all chapter IDs belonging to this course
    const sections = await db.query.courseSections.findMany({
      where: eq(courseSections.courseId, course.id),
    })
    const sectionIds = sections.map(s => s.id)

    let failedCount = 0
    let doneCount = 0

    if (sectionIds.length > 0) {
      const chapters = await db.query.courseChapters.findMany({
        where: inArray(courseChapters.sectionId, sectionIds),
      })
      const chapterIds = chapters.map(c => c.id)

      if (chapterIds.length > 0) {
        const allLessons = await db.query.chapterLessons.findMany({
          where: inArray(chapterLessons.chapterId, chapterIds),
        })

        doneCount = allLessons.filter(l => l.generationStatus === 'done').length
        failedCount = allLessons.filter(
          l => l.generationStatus === 'generating' || l.generationStatus === 'pending'
        ).length

        // Mark stuck/pending lessons as failed so creators can retry them
        // Leave 'done' and already-'failed' lessons untouched
        if (failedCount > 0) {
          await db.update(chapterLessons)
            .set({ generationStatus: 'failed' })
            .where(
              and(
                inArray(chapterLessons.chapterId, chapterIds),
                ne(chapterLessons.generationStatus, 'done'),
                ne(chapterLessons.generationStatus, 'failed'),
              ),
            )
        }
      }
    }

    // Mark course ready so it's accessible and lessons can be retried
    await db.update(courses)
      .set({ status: 'ready', updatedAt: new Date() })
      .where(eq(courses.id, course.id))

    console.log(`[course-recovery] Recovered course ${course.id} ("${course.title}") — ${doneCount} done, ${failedCount} interrupted`)

    // Notify the creator if we have their email
    if (course.createdBy) {
      const creator = await db.query.users.findFirst({ where: eq(users.id, course.createdBy) })
      if (creator?.email) {
        const appBase = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'https://app.primr.me'
        const courseUrl = `${appBase}/creator/courses/${course.id}/edit`

        const result = await sendEmail({
          to: creator.email,
          ...courseInterruptedEmail({ courseTitle: course.title, courseUrl, doneCount, failedCount }),
        })
        if (!result.ok && !result.skipped) {
          console.error(`[course-recovery] Failed to email ${creator.email}:`, result.error)
        }
      }
    }
  }
}
