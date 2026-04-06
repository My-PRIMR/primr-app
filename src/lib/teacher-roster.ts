/**
 * Per-student progress roll-up for the teacher dashboard.
 *
 * Returns one row per unique student email across all the teacher's
 * lessons and courses, with aggregate stats from lesson_attempts.
 */
import { sql } from 'drizzle-orm'
import { db } from '@/db'

export interface TeacherRosterRow {
  email: string
  lessonsStarted: number
  lessonsCompleted: number
  averageScore: number | null
  lastActivity: Date | null
}

export async function listTeacherRoster(teacherUserId: string): Promise<TeacherRosterRow[]> {
  const result = await db.execute<{
    email: string
    lessons_started: number
    lessons_completed: number
    average_score: string | number | null
    last_activity: Date | null
  }>(sql`
    WITH teacher_lessons AS (
      SELECT id FROM lessons WHERE created_by = ${teacherUserId}
      UNION
      SELECT cl.lesson_id AS id
      FROM chapter_lessons cl
      JOIN course_chapters cc ON cc.id = cl.chapter_id
      JOIN course_sections cs ON cs.id = cc.section_id
      JOIN courses c ON c.id = cs.course_id
      WHERE c.created_by = ${teacherUserId}
        AND cl.lesson_id IS NOT NULL
    ),
    student_emails AS (
      SELECT li.email
      FROM lesson_invitations li
      JOIN teacher_lessons tl ON tl.id = li.lesson_id
      UNION
      SELECT ce.email
      FROM course_enrollments ce
      JOIN courses c ON c.id = ce.course_id
      WHERE c.created_by = ${teacherUserId}
    )
    SELECT
      se.email,
      COUNT(la.id)::int AS lessons_started,
      COUNT(la.id) FILTER (WHERE la.status = 'completed')::int AS lessons_completed,
      AVG(la.score) AS average_score,
      MAX(la.started_at) AS last_activity
    FROM student_emails se
    LEFT JOIN users u ON u.email = se.email
    LEFT JOIN lesson_attempts la
      ON la.user_id = u.id
      AND la.lesson_id IN (SELECT id FROM teacher_lessons)
    GROUP BY se.email
    ORDER BY last_activity DESC NULLS LAST, se.email
  `)

  return result.map(r => ({
    email:            r.email,
    lessonsStarted:   r.lessons_started,
    lessonsCompleted: r.lessons_completed,
    // AVG returns numeric in postgres which postgres-js returns as string. Coerce to number.
    averageScore:     r.average_score == null ? null : Number(r.average_score),
    lastActivity:     r.last_activity,
  }))
}
