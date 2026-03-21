/**
 * Startup recovery for courses stuck in 'generating' status.
 * Called once on server startup via instrumentation.ts.
 *
 * If the server was killed mid-generation, any courses with status='generating'
 * will never complete. This marks stuck lessons as 'failed' and courses as 'ready'
 * so creators can retry individual lessons from the editor.
 */
import { db } from '@/db'
import { courses, courseSections, courseChapters, chapterLessons } from '@/db/schema'
import { and, eq, inArray, ne } from 'drizzle-orm'

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

    if (sectionIds.length > 0) {
      const chapters = await db.query.courseChapters.findMany({
        where: inArray(courseChapters.sectionId, sectionIds),
      })
      const chapterIds = chapters.map(c => c.id)

      if (chapterIds.length > 0) {
        // Mark stuck/pending lessons as failed so creators can retry them
        // Leave 'done' and already-'failed' lessons untouched
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

    // Mark course ready so it's accessible and lessons can be retried
    await db.update(courses)
      .set({ status: 'ready', updatedAt: new Date() })
      .where(eq(courses.id, course.id))

    console.log(`[course-recovery] Recovered course ${course.id} ("${course.title}")`)
  }
}
