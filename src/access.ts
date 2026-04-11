import { db } from '@/db'
import { lessons, courses, purchases, subscriptions } from '@/db/schema'
import { and, eq } from 'drizzle-orm'

/**
 * Determines whether the given user has access to a lesson.
 *
 * Rules are evaluated in a fixed order:
 *   1. System content                       → always free
 *   2. Creator of the content               → always has access
 *   3. Free content                         → open access
 *   4. Active subscription to the creator   → access to all their paid content
 *   5. Direct purchase of this lesson       → access
 *   6. Otherwise                            → no access
 */
export async function hasAccessToLesson(
  userId: string | null,
  lessonId: string,
): Promise<boolean> {
  const lesson = await db.query.lessons.findFirst({
    where: eq(lessons.id, lessonId),
  })
  if (!lesson) return false
  if (lesson.isSystem) return true
  if (!lesson.isPaid) return true
  if (!userId) return false
  if (lesson.createdBy === userId) return true

  if (lesson.createdBy) {
    const sub = await db.query.subscriptions.findFirst({
      where: and(
        eq(subscriptions.subscriberId, userId),
        eq(subscriptions.creatorId, lesson.createdBy),
        eq(subscriptions.status, 'active'),
      ),
    })
    if (sub) return true
  }

  const purchase = await db.query.purchases.findFirst({
    where: and(
      eq(purchases.buyerId, userId),
      eq(purchases.lessonId, lessonId),
    ),
  })
  return !!purchase
}

/**
 * Determines whether the given user has access to a course.
 *
 * Applies the same rule order as {@link hasAccessToLesson}, but against the
 * course-scoped subscription/purchase rows.
 */
export async function hasAccessToCourse(
  userId: string | null,
  courseId: string,
): Promise<boolean> {
  const course = await db.query.courses.findFirst({
    where: eq(courses.id, courseId),
  })
  if (!course) return false
  if (course.isSystem) return true
  if (!course.isPaid) return true
  if (!userId) return false
  if (course.createdBy === userId) return true

  if (course.createdBy) {
    const sub = await db.query.subscriptions.findFirst({
      where: and(
        eq(subscriptions.subscriberId, userId),
        eq(subscriptions.creatorId, course.createdBy),
        eq(subscriptions.status, 'active'),
      ),
    })
    if (sub) return true
  }

  const purchase = await db.query.purchases.findFirst({
    where: and(
      eq(purchases.buyerId, userId),
      eq(purchases.courseId, courseId),
    ),
  })
  return !!purchase
}
