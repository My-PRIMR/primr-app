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
 *
 * INVARIANT: relies on lesson_invitations.email and course_enrollments.email
 * being stored lowercased + trimmed by all insert sites. Confirmed at
 * app/api/lessons/[id]/invite/route.ts and app/api/courses/[id]/enroll/route.ts.
 * If you add a new insert site, preserve this normalization or the existence
 * check below will silently miss matches.
 *
 * NOT TRANSACTIONAL: concurrent invites racing at the cap boundary can exceed
 * the cap by 1–N. Acceptable for a soft product cap on a low-concurrency
 * workflow; if strict enforcement is ever needed, wrap the check + insert in
 * a transaction with SELECT ... FOR UPDATE on a sentinel row.
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
  const result = await db.execute<{ count: number }>(sql`
    SELECT COUNT(*)::int AS count FROM (
      SELECT li.email
      FROM lesson_invitations li
      JOIN lessons l ON l.id = li.lesson_id
      WHERE l.created_by = ${teacherUserId}
      UNION
      SELECT ce.email
      FROM course_enrollments ce
      JOIN courses c ON c.id = ce.course_id
      WHERE c.created_by = ${teacherUserId}
    ) AS roster
  `)
  return result[0]?.count ?? 0
}

/**
 * Check whether the teacher can add ONE more student. Pass the prospective
 * email to dedupe — if the student is already in the roster, the cap is not
 * incremented and `capped` is false even at 150.
 *
 * Single round-trip: a CTE computes the roster once, then SELECTs both the
 * roster size and an EXISTS check for the prospective email in one query.
 */
export async function checkStudentCap(
  teacherUserId: string,
  prospectiveEmail: string,
): Promise<StudentCapResult> {
  const email = prospectiveEmail.trim().toLowerCase()

  const result = await db.execute<{ count: number; is_existing: boolean }>(sql`
    WITH roster AS (
      SELECT li.email
      FROM lesson_invitations li
      JOIN lessons l ON l.id = li.lesson_id
      WHERE l.created_by = ${teacherUserId}
      UNION
      SELECT ce.email
      FROM course_enrollments ce
      JOIN courses c ON c.id = ce.course_id
      WHERE c.created_by = ${teacherUserId}
    )
    SELECT
      (SELECT COUNT(*)::int FROM roster) AS count,
      EXISTS (SELECT 1 FROM roster WHERE email = ${email}) AS is_existing
  `)

  const row = result[0]
  const count = row?.count ?? 0
  const isExisting = row?.is_existing ?? false

  if (isExisting) {
    return { count, cap: TEACHER_STUDENT_CAP, capped: false }
  }
  return { count, cap: TEACHER_STUDENT_CAP, capped: count >= TEACHER_STUDENT_CAP }
}
