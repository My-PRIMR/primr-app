import Link from 'next/link'
import { UserMenu } from '../components/UserMenu'
import CreatorDashboard from './CreatorDashboard'
import LearnerDashboard from './LearnerDashboard'
import { db } from '@/db'
import {
  lessons, lessonInvitations, lessonAttempts,
  courses, courseSections, courseChapters, chapterLessons, courseEnrollments,
} from '@/db/schema'
import { desc, eq, and, sql, inArray, max, isNull } from 'drizzle-orm'
import { getSession } from '@/session'
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
        lastAttempt: sql<string | null>`max(${lessonAttempts.completedAt})::text`,
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
      lastAttempt: sql<string | null>`max(${lessonAttempts.startedAt})::text`,
    })
    .from(lessonAttempts)
    .innerJoin(lessons, eq(lessons.id, lessonAttempts.lessonId))
    .where(eq(lessonAttempts.userId, userId))
    .groupBy(lessons.id, lessons.title)
    .orderBy(desc(max(lessonAttempts.startedAt)))

  const hasAnything = isCreator || enrolledCourses.length > 0 || invitedLessons.length > 0 || lessonHistory.length > 0

  return (
    <main className={styles.main}>
      <nav className={styles.nav}>
        <Link href="/" className={styles.wordmark}>Primr</Link>
        <div className={styles.navActions}>
          {isCreator && (
            <>
              <Link href="/creator/courses/new" className={styles.newCourseBtn}>+ New course</Link>
              <Link href="/creator/new" className={styles.newBtn}>+ New lesson</Link>
            </>
          )}
          <UserMenu userName={session.user.name} userEmail={session.user.email} role={session.user.productRole} internalRole={session.user.internalRole} internalUrl={process.env.PRIMR_INTERNAL_URL ?? 'http://localhost:3004'} />
        </div>
      </nav>

      <div className={styles.content}>

        {/* ── Creator: courses / lessons / learning tabs ── */}
        {isCreator && (
          <>
            <h1 className={styles.heading}>Your content</h1>
            <CreatorDashboard
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
