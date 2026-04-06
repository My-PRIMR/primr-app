import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/db'
import {
  courses, courseSections, courseChapters, chapterLessons,
  courseEnrollments, lessonAttempts, users,
} from '@/db/schema'
import { eq, and, inArray, sql } from 'drizzle-orm'
import { getSession } from '@/session'
import PageHeaderServer from '../../../../components/PageHeaderServer'
import styles from './page.module.css'

export const dynamic = 'force-dynamic'

export default async function CourseResultsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const session = await getSession()
  if (!session?.user?.id) notFound()

  const course = await db.query.courses.findFirst({
    where: eq(courses.id, id),
  })
  if (!course || course.createdBy !== session.user.id) notFound()

  // 1. Course lessons in curriculum order
  const courseLessonRows = await db
    .select({
      lessonId: chapterLessons.lessonId,
      lessonTitle: chapterLessons.title,
      sectionPosition: courseSections.position,
      chapterPosition: courseChapters.position,
      lessonPosition: chapterLessons.position,
    })
    .from(chapterLessons)
    .innerJoin(courseChapters, eq(courseChapters.id, chapterLessons.chapterId))
    .innerJoin(courseSections, eq(courseSections.id, courseChapters.sectionId))
    .where(eq(courseSections.courseId, id))
    .orderBy(courseSections.position, courseChapters.position, chapterLessons.position)

  const filteredLessonRows = courseLessonRows.filter(
    (r): r is typeof r & { lessonId: string } => r.lessonId !== null
  )

  // 2. Enrolled learners
  const enrollmentRows = await db
    .select({
      email: courseEnrollments.email,
      userName: users.name,
    })
    .from(courseEnrollments)
    .leftJoin(users, sql`lower(${users.email}) = lower(${courseEnrollments.email})`)
    .where(eq(courseEnrollments.courseId, id))

  const lessonIds = filteredLessonRows.map(r => r.lessonId)
  const enrolledEmails = enrollmentRows.map(r => r.email.toLowerCase())

  // 3. Per-learner completion (only if enrolledCount > 0 and lessonIds.length > 0)
  let completionRows: {
    learnerEmail: string
    completedCount: number
    avgScore: number | null
    lastActivity: string | null
  }[] = []
  if (lessonIds.length > 0 && enrolledEmails.length > 0) {
    completionRows = await db
      .select({
        learnerEmail: sql<string>`lower(${users.email})`,
        completedCount: sql<number>`count(distinct ${lessonAttempts.lessonId})::int`,
        avgScore: sql<number | null>`avg(${lessonAttempts.score})`,
        lastActivity: sql<string | null>`max(${lessonAttempts.completedAt})::text`,
      })
      .from(lessonAttempts)
      .innerJoin(users, eq(users.id, lessonAttempts.userId))
      .innerJoin(courseEnrollments, sql`lower(${courseEnrollments.email}) = lower(${users.email}) and ${courseEnrollments.courseId} = ${id}`)
      .where(and(
        eq(lessonAttempts.status, 'completed'),
        inArray(lessonAttempts.lessonId, lessonIds),
      ))
      .groupBy(sql`lower(${users.email})`)
  }

  // 4. Per-lesson completion counts (only enrolled learners)
  let lessonCompletionCounts: { lessonId: string; completedCount: number }[] = []
  if (lessonIds.length > 0 && enrolledEmails.length > 0) {
    lessonCompletionCounts = await db
      .select({
        lessonId: lessonAttempts.lessonId,
        completedCount: sql<number>`count(distinct ${users.id})::int`,
      })
      .from(lessonAttempts)
      .innerJoin(users, eq(users.id, lessonAttempts.userId))
      .innerJoin(courseEnrollments, sql`lower(${courseEnrollments.email}) = lower(${users.email}) and ${courseEnrollments.courseId} = ${id}`)
      .where(and(
        eq(lessonAttempts.status, 'completed'),
        inArray(lessonAttempts.lessonId, lessonIds),
      ))
      .groupBy(lessonAttempts.lessonId)
  }

  // Computed values
  const PASS_THRESHOLD = 0.70

  const totalLessons = filteredLessonRows.length
  const enrolledCount = enrollmentRows.length

  const completionMap = new Map(completionRows.map(r => [r.learnerEmail, r]))

  type LearnerRow = {
    email: string
    name: string | null
    completedLessons: number
    avgScore: number | null
    status: 'completed' | 'in_progress' | 'not_started'
    lastActivity: string | null
  }

  const learners: LearnerRow[] = enrollmentRows.map(e => {
    const comp = completionMap.get(e.email.toLowerCase())
    const completedLessons = comp?.completedCount ?? 0
    const status: LearnerRow['status'] =
      completedLessons >= totalLessons && totalLessons > 0 ? 'completed'
      : completedLessons > 0 ? 'in_progress'
      : 'not_started'
    return {
      email: e.email,
      name: e.userName,
      completedLessons,
      avgScore: comp?.avgScore ?? null,
      status,
      lastActivity: comp?.lastActivity ?? null,
    }
  })

  // Sort: completed (avgScore desc) → in_progress → not_started
  learners.sort((a, b) => {
    const order = { completed: 0, in_progress: 1, not_started: 2 }
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status]
    if (a.status === 'completed') return (b.avgScore ?? 0) - (a.avgScore ?? 0)
    return 0
  })

  const completedLearners = learners.filter(l => l.status === 'completed')
  const completedCount = completedLearners.length
  const completionRate = enrolledCount > 0 ? Math.round((completedCount / enrolledCount) * 100) : null

  const completedScores = completedLearners.map(l => l.avgScore).filter((s): s is number => s != null)
  const avgScore = completedScores.length > 0
    ? completedScores.reduce((a, b) => a + b, 0) / completedScores.length
    : null
  const passCount = completedScores.filter(s => s >= PASS_THRESHOLD).length
  const passRate = completedScores.length > 0 ? passCount / completedScores.length : null

  const lessonCompletionMap = new Map(lessonCompletionCounts.map(r => [r.lessonId, r.completedCount]))

  return (
    <>
      <PageHeaderServer
        leftSlot={
          <Link href="/creator" className={styles.backLink} style={{ marginBottom: 0 }}>← Back to results</Link>
        }
      />
      <main className={styles.main}>
        <h1 className={styles.pageTitle}>{course.title}</h1>
      <p className={styles.pageMeta}>Course · {totalLessons} lesson{totalLessons !== 1 ? 's' : ''} · {enrolledCount} enrolled learner{enrolledCount !== 1 ? 's' : ''}</p>

      {/* Stat strip */}
      <div className={styles.statStrip}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Enrolled</div>
          <div className={styles.statValue}>{enrolledCount}</div>
          <div className={styles.statSub}>learners</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Completed</div>
          <div className={styles.statValue}>{completedCount}</div>
          <div className={styles.statSub}>{completionRate != null ? `${completionRate}% completion rate` : 'no learners yet'}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Avg score</div>
          <div className={styles.statValue}>{avgScore != null ? `${Math.round(avgScore * 100)}%` : '—'}</div>
          <div className={styles.statSub}>completed learners only</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Pass rate</div>
          <div className={styles.statValue}>{passRate != null ? `${Math.round(passRate * 100)}%` : '—'}</div>
          <div className={styles.statSub}>≥ {Math.round(PASS_THRESHOLD * 100)}% avg, scored only</div>
        </div>
      </div>

      {/* Learner roster */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Learner roster</div>
        {learners.length === 0 ? (
          <p className={styles.empty}>No learners enrolled yet.</p>
        ) : (
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Learner</th>
                <th>Progress</th>
                <th>Avg score</th>
                <th>Status</th>
                <th>Last active</th>
              </tr>
            </thead>
            <tbody>
              {learners.map(l => {
                const progressFrac = totalLessons > 0 ? l.completedLessons / totalLessons : 0
                const progressPct = Math.round(progressFrac * 100)
                const progressBarColor =
                  l.status === 'completed' ? 'var(--teal, #0a7c6e)'
                  : l.status === 'in_progress' ? 'var(--amber, #d97706)'
                  : 'var(--border, #e8e8e8)'
                return (
                  <tr key={l.email}>
                    <td>
                      <div className={styles.learnerName}>{l.name ?? l.email}</div>
                      {l.name && <div className={styles.learnerEmail}>{l.email}</div>}
                    </td>
                    <td>
                      <div className={styles.progWrap}>
                        <div className={styles.progBarBg}>
                          <div className={styles.progBarFill} style={{ width: `${progressPct}%`, background: progressBarColor }} />
                        </div>
                        <span className={styles.progLabel}>{l.completedLessons} / {totalLessons}</span>
                      </div>
                    </td>
                    <td>
                      {l.avgScore != null ? (
                        <div className={styles.scoreBarWrap}>
                          <div className={styles.scoreBarTrack}>
                            <div className={styles.scoreBarFill} style={{ width: `${Math.round(l.avgScore * 100)}%` }} />
                          </div>
                          <span className={styles.scorePct}>{Math.round(l.avgScore * 100)}%</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--ink-muted, #888)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <span className={
                        l.status === 'completed' ? styles.completedPill
                        : l.status === 'in_progress' ? styles.inProgressPill
                        : styles.notStartedPill
                      }>
                        {l.status === 'completed' ? 'Completed' : l.status === 'in_progress' ? 'In progress' : 'Not started'}
                      </span>
                    </td>
                    <td className={styles.muted}>
                      {l.lastActivity
                        ? new Date(l.lastActivity).toLocaleDateString('en-US', { timeZone: 'UTC' })
                        : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Per-lesson breakdown */}
      {filteredLessonRows.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            Lesson completion
            <span className={styles.sectionSubtitle}>(% of enrolled learners who completed each lesson)</span>
          </div>
          <div className={styles.lessonList}>
            {filteredLessonRows.map((lesson, i) => {
              const count = lessonCompletionMap.get(lesson.lessonId) ?? 0
              const pct = enrolledCount > 0 ? Math.round((count / enrolledCount) * 100) : 0
              const barClass = pct >= 80 ? styles.lessonBarFillHigh : pct >= 50 ? styles.lessonBarFillMid : styles.lessonBarFillLow
              const pctClass = pct >= 80 ? styles.lessonPctHigh : pct >= 50 ? styles.lessonPctMid : styles.lessonPctLow
              return (
                <div key={lesson.lessonId} className={styles.lessonRow}>
                  <div className={styles.lessonNum}>{i + 1}</div>
                  <div className={styles.lessonInfo}>
                    <div className={styles.lessonName}>{lesson.lessonTitle}</div>
                    <div className={styles.lessonSub}>{count} / {enrolledCount} completed</div>
                  </div>
                  <div className={styles.lessonBarWrap}>
                    <div className={styles.lessonBarBg}>
                      <div className={barClass} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className={styles.lessonPctWrap}>
                    <div className={pctClass}>{enrolledCount > 0 ? `${pct}%` : '—'}</div>
                    <div className={styles.lessonPctLabel}>completed</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </main></>
  )
}
