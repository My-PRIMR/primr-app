import { db } from '@/db'
import { lessons, lessonInvitations } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

/**
 * Check if a user can access a lesson:
 * - They created it, OR
 * - They have an invitation (by email)
 */
export async function canAccessLesson(lessonId: string, userId: string, userEmail: string): Promise<boolean> {
  const lesson = await db.query.lessons.findFirst({
    where: eq(lessons.id, lessonId),
  })
  if (!lesson) return false

  // Creator always has access
  if (lesson.createdBy === userId) return true

  // Check invitation by email
  const invitation = await db.query.lessonInvitations.findFirst({
    where: and(
      eq(lessonInvitations.lessonId, lessonId),
      eq(lessonInvitations.email, userEmail.toLowerCase()),
    ),
  })

  return !!invitation
}
