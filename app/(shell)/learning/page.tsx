import { db } from '@/db'
import {
  lessons, lessonInvitations, lessonAttempts,
  courses, courseSections, courseChapters, chapterLessons, courseEnrollments,
} from '@/db/schema'
import { desc, eq, and, sql, inArray, max } from 'drizzle-orm'
import { getSession } from '@/session'
import { redirect } from 'next/navigation'
import LearnerDashboard from '../creator/LearnerDashboard'
import styles from '../creator/page.module.css'

export const dynamic = 'force-dynamic'

export default async function LearningPage() {
  const session = await getSession()
  if (!session?.user?.id || !session.user.email) redirect('/login')

  const email = session.user.email.toLowerCase()
  const userId = session.user.id

  // ── Enrolled courses with progress ─────────────────────────────────────────
  const enrolledCourseRows = await db
    .select({
      id: courses.id,
      title: courses.title,
      status: courses.status,
      doneCount: sql<number>`count(case when ${chapterLessons.generationStatus} = 'done' then 1 end)::int`,
    })
    .from(courseEnrollments)
    .innerJoin(courses, eq(courses.id, courseEnrollments.courseId))
    .leftJoin(courseSections, eq(courseSections.courseId, courses.id))
    .leftJoin(courseChapters, eq(courseChapters.sectionId, courseSections.id))
    .leftJoin(chapterLessons, eq(chapterLessons.chapterId, courseChapters.id))
    .where(eq(courseEnrollments.email, email))
    .groupBy(courses.id)
    .orderBy(desc(courses.id))

  const enrolledCourseIds = enrolledCourseRows.map(c => c.id)
  const courseProgressMap = new Map<string, number>()

  if (enrolledCourseIds.length > 0) {
    const completedRows = await db
      .select({
        courseId: courseSections.courseId,
        completedCount: sql<number>`count(distinct ${lessonAttempts.lessonId})::int`,
      })
      .from(lessonAttempts)
      .innerJoin(chapterLessons, eq(chapterLessons.lessonId, lessonAttempts.lessonId))
      .innerJoin(courseChapters, eq(courseChapters.id, chapterLessons.chapterId))
      .innerJoin(courseSections, eq(courseSections.id, courseChapters.sectionId))
      .where(and(
        eq(lessonAttempts.userId, userId),
        eq(lessonAttempts.status, 'completed'),
        inArray(courseSections.courseId, enrolledCourseIds),
      ))
      .groupBy(courseSections.courseId)

    for (const row of completedRows) {
      courseProgressMap.set(row.courseId, row.completedCount)
    }
  }

  const enrolledCourses = enrolledCourseRows.map(c => ({
    ...c,
    completedCount: courseProgressMap.get(c.id) ?? 0,
  }))

  // ── Individually invited lessons ───────────────────────────────────────────
  const invitedLessons = await db
    .select({ id: lessons.id, title: lessons.title, slug: lessons.slug })
    .from(lessonInvitations)
    .innerJoin(lessons, eq(lessonInvitations.lessonId, lessons.id))
    .where(eq(lessonInvitations.email, email))

  let statsMap = new Map<string, { attemptCount: number; bestScore: number | null; lastAttempt: string | null }>()
  if (invitedLessons.length > 0) {
    const lessonIds = invitedLessons.map(l => l.id)
    const stats = await db
      .select({
        lessonId: lessonAttempts.lessonId,
        attemptCount: sql<number>`count(*)::int`,
        bestScore: sql<number | null>`max(${lessonAttempts.score})`,
        lastAttempt: sql<string | null>`to_char(max(${lessonAttempts.completedAt}) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`,
      })
      .from(lessonAttempts)
      .where(and(
        eq(lessonAttempts.userId, userId),
        inArray(lessonAttempts.lessonId, lessonIds),
      ))
      .groupBy(lessonAttempts.lessonId)
    statsMap = new Map(stats.map(s => [s.lessonId, s]))
  }

  // ── Lesson history ─────────────────────────────────────────────────────────
  const lessonHistory = await db
    .select({
      id: lessons.id,
      title: lessons.title,
      attemptCount: sql<number>`count(${lessonAttempts.id})::int`,
      bestScore: sql<number | null>`max(${lessonAttempts.score})`,
      lastAttempt: sql<string | null>`to_char(max(${lessonAttempts.startedAt}) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`,
    })
    .from(lessonAttempts)
    .innerJoin(lessons, eq(lessons.id, lessonAttempts.lessonId))
    .where(eq(lessonAttempts.userId, userId))
    .groupBy(lessons.id, lessons.title)
    .orderBy(desc(max(lessonAttempts.startedAt)))

  const hasAnything = enrolledCourses.length > 0 || invitedLessons.length > 0 || lessonHistory.length > 0

  return (
    <main className={styles.main}>
      <div className={styles.content}>
        {hasAnything ? (
          <LearnerDashboard
            courses={enrolledCourses}
            lessons={invitedLessons.map(l => ({
              id: l.id,
              title: l.title,
              slug: l.slug,
              attemptCount: statsMap.get(l.id)?.attemptCount ?? 0,
              bestScore: statsMap.get(l.id)?.bestScore ?? null,
              lastAttempt: statsMap.get(l.id)?.lastAttempt ?? null,
            }))}
            history={lessonHistory}
            isCreator={false}
          />
        ) : (
          <p className={styles.empty}>No lessons or courses assigned to you yet.</p>
        )}
      </div>
    </main>
  )
}
