/**
 * Student cap enforcement for the Teacher tier.
 *
 * Counts unique student emails across every lesson invitation and course
 * enrollment whose target lesson/course was created by the given teacher.
 * Used by lesson-invite and course-enroll routes to gate the 151st student
 * for users on the teacher plan.
 *
 * Other plans bypass the cap entirely; callers should pass the inviting
 * user's plan and skip the helper when plan !== 'teacher'.
 */
import { sql } from 'drizzle-orm'
import { db } from '@/db'

export const TEACHER_STUDENT_CAP = 150

export interface StudentCapResult {
  count: number
  cap: number
  capped: boolean
}

/**
 * Count unique student emails across the teacher's lessons and courses.
 * The same email invited to two lessons counts once, not twice.
 */
export async function getTeacherStudentCount(teacherUserId: string): Promise<number> {
  const result = await db.execute(sql`
    SELECT COUNT(DISTINCT email)::int AS count FROM (
      SELECT li.email
      FROM lesson_invitations li
      JOIN lessons l ON l.id = li.lesson_id
      WHERE l.created_by = ${teacherUserId}
      UNION
      SELECT ce.email
      FROM course_enrollments ce
      JOIN courses c ON c.id = ce.course_id
      WHERE c.created_by = ${teacherUserId}
    ) AS combined
  `)
  const row = (result as unknown as Array<{ count: number }>)[0]
  return row?.count ?? 0
}

/**
 * Check whether the teacher can add ONE more student. Pass the prospective
 * email to dedupe — if the student is already in the roster, the cap is not
 * incremented and `capped` is false even at 150.
 */
export async function checkStudentCap(
  teacherUserId: string,
  prospectiveEmail: string,
): Promise<StudentCapResult> {
  // Normalize for comparison
  const email = prospectiveEmail.trim().toLowerCase()

  // Check if this exact email is already in the roster — if yes, no new seat is consumed
  const existing = await db.execute(sql`
    SELECT 1 FROM (
      SELECT li.email
      FROM lesson_invitations li
      JOIN lessons l ON l.id = li.lesson_id
      WHERE l.created_by = ${teacherUserId} AND li.email = ${email}
      UNION
      SELECT ce.email
      FROM course_enrollments ce
      JOIN courses c ON c.id = ce.course_id
      WHERE c.created_by = ${teacherUserId} AND ce.email = ${email}
    ) AS combined
    LIMIT 1
  `)
  const isExisting = (existing as unknown[]).length > 0

  const count = await getTeacherStudentCount(teacherUserId)

  if (isExisting) {
    return { count, cap: TEACHER_STUDENT_CAP, capped: false }
  }
  return { count, cap: TEACHER_STUDENT_CAP, capped: count >= TEACHER_STUDENT_CAP }
}
