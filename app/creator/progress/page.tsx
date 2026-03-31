import Link from 'next/link'
import { UserMenu } from '../../components/UserMenu'
import ProgressDashboard from './ProgressDashboard'
import { db } from '@/db'
import {
  users, lessons, lessonAttempts, lessonInvitations,
  courses, courseSections, courseChapters, chapterLessons, courseEnrollments,
} from '@/db/schema'
import { eq, and, sql, inArray, desc, isNull } from 'drizzle-orm'
import { getSession } from '@/session'
import { redirect } from 'next/navigation'
import styles from '../page.module.css'

export const dynamic = 'force-dynamic'

export default async function ProgressPage() {
  const session = await getSession()
  if (!session?.user?.id || !session.user.email) redirect('/login')

  const role = session.user.productRole ?? 'learner'
  const isCreator = role === 'creator' || role === 'lnd_manager' || role === 'org_admin'
  if (!isCreator) redirect('/creator')

  const userId = session.user.id

  // ── Courses the creator owns with learner progress ─────────────────────────
  const createdCourses = await db
    .select({
      id: courses.id,
      title: courses.title,
      status: courses.status,
      lessonCount: sql<number>`count(distinct case when ${chapterLessons.lessonId} is not null then ${chapterLessons.id} end)::int`,
    })
    .from(courses)
    .leftJoin(courseSections, eq(courseSections.courseId, courses.id))
    .leftJoin(courseChapters, eq(courseChapters.sectionId, courseSections.id))
    .leftJoin(chapterLessons, eq(chapterLessons.chapterId, courseChapters.id))
    .where(eq(courses.createdBy, userId))
    .groupBy(courses.id)
    .orderBy(desc(courses.createdAt))

  // For each course, get enrolled learners + their progress
  const courseIds = createdCourses.map(c => c.id)

  type CourseEnrollmentRow = {
    courseId: string
    email: string
    userName: string | null
    enrolledAt: string
  }

  let courseEnrollmentRows: CourseEnrollmentRow[] = []
  if (courseIds.length > 0) {
    courseEnrollmentRows = await db
      .select({
        courseId: courseEnrollments.courseId,
        email: courseEnrollments.email,
        userName: users.name,
        enrolledAt: sql<string>`${courseEnrollments.createdAt}::text`,
      })
      .from(courseEnrollments)
      .leftJoin(users, sql`lower(${users.email}) = lower(${courseEnrollments.email})`)
      .where(inArray(courseEnrollments.courseId, courseIds))
      .orderBy(courseEnrollments.createdAt)
  }

  // Get completion data for enrolled learners in creator's courses
  // For each (courseId, userId) pair, count distinct completed lessons
  type CourseCompletionRow = {
    courseId: string
    learnerEmail: string
    completedCount: number
    bestAvgScore: number | null
    lastActivity: string | null
  }

  let courseCompletionRows: CourseCompletionRow[] = []
  if (courseIds.length > 0) {
    courseCompletionRows = await db
      .select({
        courseId: courseSections.courseId,
        learnerEmail: sql<string>`lower(${users.email})`,
        completedCount: sql<number>`count(distinct ${lessonAttempts.lessonId})::int`,
        bestAvgScore: sql<number | null>`avg(${lessonAttempts.score})`,
        lastActivity: sql<string | null>`max(${lessonAttempts.completedAt})::text`,
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

  // Build course progress data
  const courseProgressData = createdCourses.map(course => {
    const enrollees = courseEnrollmentRows.filter(e => e.courseId === course.id)
    const completionMap = new Map(
      courseCompletionRows
        .filter(c => c.courseId === course.id)
        .map(c => [c.learnerEmail, c])
    )

    const learners = enrollees.map(e => {
      const completion = completionMap.get(e.email.toLowerCase())
      return {
        email: e.email,
        name: e.userName,
        completedLessons: completion?.completedCount ?? 0,
        avgScore: completion?.bestAvgScore ?? null,
        lastActivity: completion?.lastActivity ?? null,
      }
    })

    return {
      id: course.id,
      title: course.title,
      status: course.status,
      totalLessons: course.lessonCount,
      enrolledCount: enrollees.length,
      learners,
    }
  })

  // ── Standalone lessons (not in any course) with learner progress ────────────
  const createdLessons = await db.select({
    id: lessons.id,
    title: lessons.title,
    publishedAt: lessons.publishedAt,
  })
    .from(lessons)
    .leftJoin(chapterLessons, eq(chapterLessons.lessonId, lessons.id))
    .where(and(eq(lessons.createdBy, userId), isNull(chapterLessons.id)))
    .orderBy(desc(lessons.updatedAt))

  const lessonIds = createdLessons.map(l => l.id)

  type LessonInviteeRow = {
    lessonId: string
    email: string
    userName: string | null
  }

  let lessonInviteeRows: LessonInviteeRow[] = []
  if (lessonIds.length > 0) {
    lessonInviteeRows = await db
      .select({
        lessonId: lessonInvitations.lessonId,
        email: lessonInvitations.email,
        userName: users.name,
      })
      .from(lessonInvitations)
      .leftJoin(users, sql`lower(${users.email}) = lower(${lessonInvitations.email})`)
      .where(inArray(lessonInvitations.lessonId, lessonIds))
  }

  // Get attempt data per (lessonId, user email)
  type LessonAttemptRow = {
    lessonId: string
    learnerEmail: string
    attemptCount: number
    bestScore: number | null
    completed: boolean
    lastActivity: string | null
  }

  let lessonAttemptRows: LessonAttemptRow[] = []
  if (lessonIds.length > 0) {
    lessonAttemptRows = await db
      .select({
        lessonId: lessonAttempts.lessonId,
        learnerEmail: sql<string>`lower(${users.email})`,
        attemptCount: sql<number>`count(*)::int`,
        bestScore: sql<number | null>`max(${lessonAttempts.score})`,
        completed: sql<boolean>`bool_or(${lessonAttempts.status} = 'completed')`,
        lastActivity: sql<string | null>`max(coalesce(${lessonAttempts.completedAt}, ${lessonAttempts.startedAt}))::text`,
      })
      .from(lessonAttempts)
      .innerJoin(users, eq(users.id, lessonAttempts.userId))
      .where(inArray(lessonAttempts.lessonId, lessonIds))
      .groupBy(lessonAttempts.lessonId, sql`lower(${users.email})`)
  }

  const lessonProgressData = createdLessons.map(lesson => {
    const invitees = lessonInviteeRows.filter(i => i.lessonId === lesson.id)
    const attemptMap = new Map(
      lessonAttemptRows
        .filter(a => a.lessonId === lesson.id)
        .map(a => [a.learnerEmail, a])
    )

    const learners = invitees.map(inv => {
      const attempt = attemptMap.get(inv.email.toLowerCase())
      return {
        email: inv.email,
        name: inv.userName,
        attemptCount: attempt?.attemptCount ?? 0,
        bestScore: attempt?.bestScore ?? null,
        completed: attempt?.completed ?? false,
        lastActivity: attempt?.lastActivity ?? null,
      }
    })

    return {
      id: lesson.id,
      title: lesson.title,
      published: !!lesson.publishedAt,
      invitedCount: invitees.length,
      learners,
    }
  })

  return (
    <main className={styles.main}>
      <nav className={styles.nav}>
        <Link href="/" className={styles.wordmark}>Primr</Link>
        <div className={styles.navActions}>
          <Link href="/creator" className={styles.newCourseBtn}>Dashboard</Link>
          <UserMenu userName={session.user.name} userEmail={session.user.email} role={session.user.productRole} internalRole={session.user.internalRole} internalUrl={process.env.PRIMR_INTERNAL_URL ?? 'http://localhost:3004'} />
        </div>
      </nav>

      <div className={styles.content}>
        <h1 className={styles.heading}>Learner progress</h1>
        <ProgressDashboard
          courses={courseProgressData}
          lessons={lessonProgressData}
        />
      </div>
    </main>
  )
}
