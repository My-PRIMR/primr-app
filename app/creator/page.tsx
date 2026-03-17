import Link from 'next/link'
import { InvitePanel } from './InvitePanel'
import { UserMenu } from '../components/UserMenu'
import { db } from '@/db'
import {
  lessons, lessonInvitations, lessonAttempts,
  courses, courseSections, courseChapters, chapterLessons, courseEnrollments,
} from '@/db/schema'
import { desc, eq, and, sql, inArray, max } from 'drizzle-orm'
import { getSession } from '@/session'
import { redirect } from 'next/navigation'
import styles from './page.module.css'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const session = await getSession()
  if (!session?.user?.id || !session.user.email) redirect('/login')

  const role = session.user.role ?? 'learner'
  const isCreator = role === 'creator' || role === 'administrator'
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

  // ── Creator: standalone lessons ─────────────────────────────────────────────
  const createdLessons = isCreator
    ? await db.select({
        id: lessons.id,
        title: lessons.title,
        slug: lessons.slug,
        createdAt: lessons.createdAt,
        updatedAt: lessons.updatedAt,
      }).from(lessons).where(eq(lessons.createdBy, userId)).orderBy(desc(lessons.updatedAt))
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

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function creatorCourseLabel(status: string, doneCount: number, lessonCount: number) {
    if (status === 'generating') return `Generating… ${doneCount}/${lessonCount} lessons`
    if (status === 'ready' || status === 'published') return `${lessonCount} lessons`
    return 'Draft'
  }

  function enrolledCourseLabel(doneCount: number, completedCount: number) {
    if (doneCount === 0) return 'Not yet available'
    if (completedCount === 0) return `${doneCount} lessons · Not started`
    if (completedCount >= doneCount) return `${doneCount} lessons · Complete ✓`
    return `${doneCount} lessons · ${completedCount} done`
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
          <UserMenu userName={session.user.name} userEmail={session.user.email} role={session.user.role} />
        </div>
      </nav>

      <div className={styles.content}>

        {/* ── Creator: courses they made ── */}
        {isCreator && (
          <>
            <h1 className={styles.heading}>Your courses</h1>
            {createdCourses.length === 0 ? (
              <p className={styles.empty}>
                No courses yet. <Link href="/creator/courses/new" className={styles.link}>Create your first course →</Link>
              </p>
            ) : (
              <div className={styles.list}>
                {createdCourses.map(course => (
                  <div key={course.id} className={styles.card}>
                    <div className={styles.cardBody}>
                      <h2 className={styles.cardTitle}>{course.title}</h2>
                      <p className={styles.cardMeta}>
                        {creatorCourseLabel(course.status, course.doneCount, course.lessonCount)}
                        {' · '}
                        Created {course.createdAt.toLocaleDateString()}
                      </p>
                    </div>
                    <div className={styles.cardActions}>
                      <Link href={`/learn/course/${course.id}`} className={styles.previewLink}>
                        Preview as learner
                      </Link>
                      <InvitePanel type="course" id={course.id} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Creator: standalone lessons ── */}
        {isCreator && (
          <>
            <h1 className={styles.heading} style={createdCourses.length > 0 ? { marginTop: '2.5rem' } : undefined}>
              Your lessons
            </h1>
            {createdLessons.length === 0 ? (
              <p className={styles.empty}>
                No lessons yet. <Link href="/creator/new" className={styles.link}>Create your first one →</Link>
              </p>
            ) : (
              <div className={styles.list}>
                {createdLessons.map(lesson => (
                  <div key={lesson.id} className={styles.card}>
                    <div className={styles.cardBody}>
                      <h2 className={styles.cardTitle}>{lesson.title}</h2>
                      <p className={styles.cardMeta}>
                        Created {lesson.createdAt.toLocaleDateString()} · Updated {lesson.updatedAt.toLocaleDateString()}
                      </p>
                    </div>
                    <div className={styles.cardActions}>
                      <Link href={`/creator/edit/${lesson.id}`} className={styles.editLink}>Edit</Link>
                      <Link href={`/creator/preview/${lesson.id}`} className={styles.previewLink}>Preview</Link>
                      <Link href={`/learn/${lesson.id}`} className={styles.previewLink}>Take lesson</Link>
                      <InvitePanel type="lesson" id={lesson.id} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Learner: enrolled courses ── */}
        {enrolledCourses.length > 0 && (
          <>
            <h1 className={styles.heading} style={isCreator ? { marginTop: '2.5rem' } : undefined}>
              {isCreator ? 'Courses assigned to you' : 'Your courses'}
            </h1>
            <div className={styles.list}>
              {enrolledCourses.map(course => {
                const allDone = course.doneCount > 0 && course.completedCount >= course.doneCount
                const started = course.completedCount > 0
                return (
                  <div key={course.id} className={styles.card}>
                    <div className={styles.cardBody}>
                      <h2 className={styles.cardTitle}>{course.title}</h2>
                      <p className={styles.cardMeta}>{enrolledCourseLabel(course.doneCount, course.completedCount)}</p>
                    </div>
                    <div className={styles.cardActions}>
                      <Link href={`/learn/course/${course.id}`} className={styles.editLink}>
                        {allDone ? 'Review' : started ? 'Continue' : 'Start'}
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ── Learner: individually assigned lessons ── */}
        {invitedLessons.length > 0 && (
          <>
            <h1 className={styles.heading} style={(isCreator || enrolledCourses.length > 0) ? { marginTop: '2.5rem' } : undefined}>
              {isCreator ? 'Lessons assigned to you' : enrolledCourses.length > 0 ? 'Assigned lessons' : 'Your lessons'}
            </h1>
            <div className={styles.list}>
              {invitedLessons.map(lesson => {
                const stat = statsMap.get(lesson.id)
                return (
                  <div key={lesson.id} className={styles.card}>
                    <div className={styles.cardBody}>
                      <h2 className={styles.cardTitle}>{lesson.title}</h2>
                      <p className={styles.cardMeta}>
                        {stat
                          ? `${stat.attemptCount} attempt${stat.attemptCount !== 1 ? 's' : ''}${stat.bestScore != null ? ` · Best: ${Math.round(stat.bestScore * 100)}%` : ''}${stat.lastAttempt ? ` · Last: ${new Date(stat.lastAttempt).toLocaleDateString()}` : ''}`
                          : 'Not started'}
                      </p>
                    </div>
                    <div className={styles.cardActions}>
                      <Link href={`/learn/${lesson.id}`} className={styles.editLink}>Take lesson</Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ── Lesson history ── */}
        {lessonHistory.length > 0 && (
          <>
            <h1 className={styles.heading} style={{ marginTop: '2.5rem' }}>
              Lessons taken
            </h1>
            <div className={styles.list}>
              {lessonHistory.map(lesson => (
                <div key={lesson.id} className={styles.card}>
                  <div className={styles.cardBody}>
                    <h2 className={styles.cardTitle}>{lesson.title}</h2>
                    <p className={styles.cardMeta}>
                      {lesson.attemptCount} attempt{lesson.attemptCount !== 1 ? 's' : ''}
                      {lesson.bestScore != null ? ` · Best: ${Math.round(lesson.bestScore * 100)}%` : ''}
                      {lesson.lastAttempt ? ` · Last: ${new Date(lesson.lastAttempt).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                  <div className={styles.cardActions}>
                    <Link href={`/learn/${lesson.id}`} className={styles.previewLink}>Retake</Link>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {!hasAnything && (
          <p className={styles.empty}>No lessons or courses assigned to you yet.</p>
        )}
      </div>
    </main>
  )
}
