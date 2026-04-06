import { db } from '@/db'
import { lessons, lessonInvitations, chapterLessons, courseChapters, courseSections, courseEnrollments } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

/**
 * Check if a user can access a lesson:
 * - They are internal staff/admin, OR
 * - They created it, OR
 * - They have an invitation (by email), OR
 * - They are enrolled in a course that contains the lesson
 */
export async function canAccessLesson(lessonId: string, userId: string, userEmail: string, internalRole?: string | null): Promise<boolean> {
  // Internal staff and admins can view any lesson without an explicit invitation
  if (internalRole === 'staff' || internalRole === 'admin') return true

  const lesson = await db.query.lessons.findFirst({
    where: eq(lessons.id, lessonId),
  })
  if (!lesson) return false

  // Creator always has access (draft or published)
  if (lesson.createdBy === userId) return true

  // Non-creators can only access published lessons
  if (!lesson.publishedAt) return false

  // Check direct invitation by email
  const invitation = await db.query.lessonInvitations.findFirst({
    where: and(
      eq(lessonInvitations.lessonId, lessonId),
      eq(lessonInvitations.email, userEmail.toLowerCase()),
    ),
  })
  if (invitation) return true

  // Check course enrollment: if the lesson belongs to a course the user is enrolled in
  const chapterLesson = await db.query.chapterLessons.findFirst({
    where: eq(chapterLessons.lessonId, lessonId),
  })

  if (chapterLesson) {
    const chapter = await db.query.courseChapters.findFirst({
      where: eq(courseChapters.id, chapterLesson.chapterId),
    })
    if (chapter) {
      const section = await db.query.courseSections.findFirst({
        where: eq(courseSections.id, chapter.sectionId),
      })
      if (section) {
        const enrollment = await db.query.courseEnrollments.findFirst({
          where: and(
            eq(courseEnrollments.courseId, section.courseId),
            eq(courseEnrollments.email, userEmail.toLowerCase()),
          ),
        })
        if (enrollment) return true

        // Course creator also has access
        const { courses } = await import('@/db/schema')
        const course = await db.query.courses.findFirst({
          where: eq(courses.id, section.courseId),
        })
        if (course?.createdBy === userId) return true
      }
    }
  }

  return false
}
