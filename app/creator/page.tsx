import Link from 'next/link'
import PageHeaderServer from '../components/PageHeaderServer'
import CreatorDashboard from './CreatorDashboard'
import LearnerDashboard from './LearnerDashboard'
import { db } from '@/db'
import {
  users, lessons, lessonInvitations, lessonAttempts,
  courses, courseSections, courseChapters, chapterLessons, courseEnrollments, lessonFeedback,
} from '@/db/schema'
import { desc, eq, and, sql, inArray, max, isNull, gte } from 'drizzle-orm'
import { getSession } from '@/session'
import { fillDailyActivity } from '@/lib/results'
import type { ResultsData, CourseResultRow, CourseLearnerRow } from './ResultsTab'
import { redirect } from 'next/navigation'
import styles from './page.module.css'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const session = await getSession()
  if (!session?.user?.id || !session.user.email) redirect('/login')

  const role = session.user.productRole ?? 'learner'
  const isCreator = role === 'creator' || role === 'lnd_manager' || role === 'org_admin'
  const email = session.user.email.toLowerCase()
  const userId = session.user.id

  // ── Creator: courses they made ──────────────────────────────────────────────
  const createdCourses = isCreator
    ? await db
        .select({
          id: courses.id,
          title: courses.title,
          status: courses.status,
          createdAt: courses.createdAt,
          lessonCount: sql<number>`count(${chapterLessons.id})::int`,
          doneCount: sql<number>`count(case when ${chapterLessons.generationStatus} = 'done' then 1 end)::int`,
        })
        .from(courses)
        .leftJoin(courseSections, eq(courseSections.courseId, courses.id))
        .leftJoin(courseChapters, eq(courseChapters.sectionId, courseSections.id))
        .leftJoin(chapterLessons, eq(chapterLessons.chapterId, courseChapters.id))
        .where(eq(courses.createdBy, userId))
        .groupBy(courses.id)
        .orderBy(desc(courses.createdAt))
    : []

  // ── Creator: standalone lessons (not attached to any course) ────────────────
  const createdLessons = isCreator
    ? await db.select({
        id: lessons.id,
        title: lessons.title,
        slug: lessons.slug,
        createdAt: lessons.createdAt,
        updatedAt: lessons.updatedAt,
        publishedAt: lessons.publishedAt,
        examEnforced: lessons.examEnforced,
        showcase: lessons.showcase,
      })
        .from(lessons)
        .leftJoin(chapterLessons, eq(chapterLessons.lessonId, lessons.id))
        .where(and(eq(lessons.createdBy, userId), isNull(chapterLessons.id)))
        .orderBy(desc(lessons.updatedAt))
    : []

  // ── Creator: results data ─────────────────────────────────────────────────
  let resultsData: ResultsData | undefined

  if (isCreator && (createdLessons.length > 0 || createdCourses.length > 0)) {
    const createdLessonIds = createdLessons.map(l => l.id)
    const courseIds = createdCourses.map(c => c.id)

    // Course lesson IDs (for aggregate stats)
    let courseLessonIds: string[] = []
    if (courseIds.length > 0) {
      const courseLessonRows = await db
        .select({ lessonId: chapterLessons.lessonId })
        .from(chapterLessons)
        .innerJoin(courseChapters, eq(courseChapters.id, chapterLessons.chapterId))
        .innerJoin(courseSections, eq(courseSections.id, courseChapters.sectionId))
        .where(inArray(courseSections.courseId, courseIds))
      courseLessonIds = courseLessonRows.map(r => r.lessonId).filter((id): id is string => id !== null)
    }

    const allLessonIds = [...createdLessonIds, ...courseLessonIds]

    // Per-lesson: invited counts (standalone lessons only)
    let invitedRows: { lessonId: string; count: number }[] = []
    if (createdLessonIds.length > 0) {
      invitedRows = await db
        .select({
          lessonId: lessonInvitations.lessonId,
          count: sql<number>`count(*)::int`,
        })
        .from(lessonInvitations)
        .where(inArray(lessonInvitations.lessonId, createdLessonIds))
        .groupBy(lessonInvitations.lessonId)
    }

    const invitedMap = new Map(invitedRows.map(r => [r.lessonId, r.count]))

    // Per-lesson: attempt stats (distinct users) for standalone lessons
    let attemptStatRows: {
      lessonId: string
      startedCount: number
      completedCount: number
      avgScore: number | null
    }[] = []
    if (createdLessonIds.length > 0) {
      attemptStatRows = await db
        .select({
          lessonId: lessonAttempts.lessonId,
          startedCount: sql<number>`count(distinct ${lessonAttempts.userId})::int`,
          completedCount: sql<number>`count(distinct case when ${lessonAttempts.status} = 'completed' then ${lessonAttempts.userId} end)::int`,
          avgScore: sql<number | null>`avg(case when ${lessonAttempts.status} = 'completed' and ${lessonAttempts.score} is not null then ${lessonAttempts.score} end)`,
        })
        .from(lessonAttempts)
        .where(inArray(lessonAttempts.lessonId, createdLessonIds))
        .groupBy(lessonAttempts.lessonId)
    }

    const attemptStatMap = new Map(attemptStatRows.map(r => [r.lessonId, r]))

    // Per-lesson average rating
    let ratingRows: { lessonId: string; avgRating: number | null }[] = []
    if (createdLessonIds.length > 0) {
      ratingRows = await db
        .select({
          lessonId: lessonFeedback.lessonId,
          avgRating: sql<number | null>`avg(${lessonFeedback.rating})`,
        })
        .from(lessonFeedback)
        .where(inArray(lessonFeedback.lessonId, createdLessonIds))
        .groupBy(lessonFeedback.lessonId)
    }
    const ratingMap = new Map(ratingRows.map(r => [r.lessonId, r.avgRating]))

    // Overall started/completed counts across all lessons (standalone + course)
    let overallStarted = 0
    let overallCompleted = 0
    if (allLessonIds.length > 0) {
      const overallAttemptStats = await db
        .select({
          startedCount: sql<number>`count(distinct ${lessonAttempts.userId})::int`,
          completedCount: sql<number>`count(distinct case when ${lessonAttempts.status} = 'completed' then ${lessonAttempts.userId} end)::int`,
        })
        .from(lessonAttempts)
        .where(inArray(lessonAttempts.lessonId, allLessonIds))
      overallStarted = overallAttemptStats[0]?.startedCount ?? 0
      overallCompleted = overallAttemptStats[0]?.completedCount ?? 0
    }

    // Course enrollment rows
    let enrolledEmails: string[] = []
    let courseEnrollmentRows: { courseId: string; email: string; userName: string | null }[] = []
    if (courseIds.length > 0) {
      const rows = await db
        .select({
          courseId: courseEnrollments.courseId,
          email: courseEnrollments.email,
          userName: users.name,
        })
        .from(courseEnrollments)
        .leftJoin(users, sql`lower(${users.email}) = lower(${courseEnrollments.email})`)
        .where(inArray(courseEnrollments.courseId, courseIds))
      courseEnrollmentRows = rows
      enrolledEmails = rows.map(r => r.email.toLowerCase())
    }

    // Course completion rows
    let courseCompletionRows: {
      courseId: string
      learnerEmail: string
      completedCount: number
      avgScore: number | null
      lastActivity: string | null
    }[] = []
    if (courseIds.length > 0) {
      courseCompletionRows = await db
        .select({
          courseId: courseSections.courseId,
          learnerEmail: sql<string>`lower(${users.email})`,
          completedCount: sql<number>`count(distinct ${lessonAttempts.lessonId})::int`,
          avgScore: sql<number | null>`avg(${lessonAttempts.score})`,
          lastActivity: sql<string | null>`to_char(max(${lessonAttempts.completedAt}) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`,
        })
        .from(lessonAttempts)
        .innerJoin(users, eq(users.id, lessonAttempts.userId))
        .innerJoin(chapterLessons, eq(chapterLessons.lessonId, lessonAttempts.lessonId))
        .innerJoin(courseChapters, eq(courseChapters.id, chapterLessons.chapterId))
        .innerJoin(courseSections, eq(courseSections.id, courseChapters.sectionId))
        .where(and(
          eq(lessonAttempts.status, 'completed'),
          inArray(courseSections.courseId, courseIds),
        ))
        .groupBy(courseSections.courseId, sql`lower(${users.email})`)
    }

    // Build courseRows
    const courseRows: CourseResultRow[] = createdCourses.map(course => {
      const enrollees = courseEnrollmentRows.filter(e => e.courseId === course.id)
      const completionMap = new Map(
        courseCompletionRows
          .filter(c => c.courseId === course.id)
          .map(c => [c.learnerEmail, c])
      )
      const totalLessons = course.lessonCount

      const learners: CourseLearnerRow[] = enrollees.map(e => {
        const completion = completionMap.get(e.email.toLowerCase())
        const completedLessons = completion?.completedCount ?? 0
        const status: CourseLearnerRow['status'] =
          completedLessons >= totalLessons && totalLessons > 0 ? 'completed'
          : completedLessons > 0 ? 'in_progress'
          : 'not_started'
        return {
          email: e.email,
          name: e.userName,
          completedLessons,
          totalLessons,
          avgScore: completion?.avgScore ?? null,
          status,
          lastActivity: completion?.lastActivity ?? null,
        }
      })

      // Sort: completed (avgScore desc) → in_progress → not_started
      learners.sort((a, b) => {
        const statusOrder = { completed: 0, in_progress: 1, not_started: 2 }
        if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status]
        if (a.status === 'completed') return (b.avgScore ?? 0) - (a.avgScore ?? 0)
        return 0
      })

      return {
        id: course.id,
        title: course.title,
        totalLessons,
        enrolledCount: enrollees.length,
        completedCount: learners.filter(l => l.status === 'completed').length,
        learners,
      }
    })

    // Total learners: dedup by lowercased email across enrollments + lesson attempts
    let lessonAttemptEmails: string[] = []
    if (allLessonIds.length > 0) {
      const emailRows = await db
        .select({ email: sql<string>`lower(${users.email})` })
        .from(lessonAttempts)
        .innerJoin(users, eq(users.id, lessonAttempts.userId))
        .where(inArray(lessonAttempts.lessonId, allLessonIds))
        .groupBy(users.email)
      lessonAttemptEmails = emailRows.map(r => r.email)
    }
    const totalLearners = new Set([...enrolledEmails, ...lessonAttemptEmails]).size

    // Overall avg score and last activity across all completed attempts
    const overallScoreRow = await db
      .select({
        avgScore: sql<number | null>`avg(${lessonAttempts.score})`,
        lastActivity: sql<string | null>`to_char(max(${lessonAttempts.completedAt}) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`,
      })
      .from(lessonAttempts)
      .where(and(
        allLessonIds.length > 0 ? inArray(lessonAttempts.lessonId, allLessonIds) : sql`false`,
        eq(lessonAttempts.status, 'completed'),
      ))

    // Daily activity: completed attempts per day for last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const dailyRows = await db
      .select({
        date: sql<string>`date(${lessonAttempts.completedAt})::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(lessonAttempts)
      .where(and(
        allLessonIds.length > 0 ? inArray(lessonAttempts.lessonId, allLessonIds) : sql`false`,
        eq(lessonAttempts.status, 'completed'),
        gte(lessonAttempts.completedAt, thirtyDaysAgo),
      ))
      .groupBy(sql`date(${lessonAttempts.completedAt})`)

    resultsData = {
      totalLearners,
      startedCount: overallStarted,
      completedCount: overallCompleted,
      avgScore: overallScoreRow[0]?.avgScore ?? null,
      lastActivityDate: overallScoreRow[0]?.lastActivity ?? null,
      dailyActivity: fillDailyActivity(dailyRows, 30),
      lessonRows: createdLessons.map(l => {
        const stat = attemptStatMap.get(l.id)
        return {
          id: l.id,
          title: l.title,
          invitedCount: invitedMap.get(l.id) ?? 0,
          startedCount: stat?.startedCount ?? 0,
          completedCount: stat?.completedCount ?? 0,
          avgScore: stat?.avgScore ?? null,
          avgRating: ratingMap.get(l.id) ?? null,
        }
      }),
      courseRows,
    }
  }

  // ── Learner: enrolled courses with progress ─────────────────────────────────
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

  // Get completed lesson counts per enrolled course
  const enrolledCourseIds = enrolledCourseRows.map(c => c.id)
  const courseProgressMap = new Map<string, number>()

  if (enrolledCourseIds.length > 0) {
    // For each course, count distinct lessons the user has completed
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

  // ── Learner: individually invited lessons ───────────────────────────────────
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

  // ── Lesson history: all lessons the user has attempted ──────────────────────
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

  const hasAnything = isCreator || enrolledCourses.length > 0 || invitedLessons.length > 0 || lessonHistory.length > 0

  return (
    <main className={styles.main}>
      <PageHeaderServer
        rightSlot={isCreator && (
          <>
            <Link href="/creator/courses/new" className={styles.newCourseBtn}>+ New course</Link>
            <Link href="/creator/new" className={styles.newBtn}>+ New lesson</Link>
          </>
        )}
      />

      <div className={styles.content}>

        {/* ── Creator: courses / lessons / learning tabs ── */}
        {isCreator && (
          <>
            <h1 className={styles.heading}>Your content</h1>
            <CreatorDashboard
              results={resultsData}
              courses={createdCourses.map(c => ({
                id: c.id,
                title: c.title,
                status: c.status,
                createdAt: c.createdAt.toISOString(),
                lessonCount: c.lessonCount,
                doneCount: c.doneCount,
              }))}
              lessons={createdLessons.map(l => ({
                id: l.id,
                title: l.title,
                slug: l.slug,
                createdAt: l.createdAt.toISOString(),
                updatedAt: l.updatedAt.toISOString(),
                publishedAt: l.publishedAt?.toISOString() ?? null,
                examEnforced: l.examEnforced,
                showcase: l.showcase,
              }))}
              learner={{
                courses: enrolledCourses,
                lessons: invitedLessons.map(l => ({
                  id: l.id,
                  title: l.title,
                  slug: l.slug,
                  attemptCount: statsMap.get(l.id)?.attemptCount ?? 0,
                  bestScore: statsMap.get(l.id)?.bestScore ?? null,
                  lastAttempt: statsMap.get(l.id)?.lastAttempt ?? null,
                })),
                history: lessonHistory,
              }}
            />
          </>
        )}

        {/* ── Pure learner: enrolled courses, assigned lessons, history ── */}
        {!isCreator && (enrolledCourses.length > 0 || invitedLessons.length > 0 || lessonHistory.length > 0) && (
          <>
            <h1 className={styles.heading}>Your courses &amp; lessons</h1>
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
          </>
        )}

        {!hasAnything && (
          <p className={styles.empty}>No lessons or courses assigned to you yet.</p>
        )}
      </div>
    </main>
  )
}
