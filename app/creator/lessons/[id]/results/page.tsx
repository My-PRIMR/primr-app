import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/db'
import { lessons, lessonAttempts, lessonInvitations, users } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { getSession } from '@/session'
import { computeBlockPerformance } from '@/lib/results'
import { UserMenu } from '../../../../components/UserMenu'
import styles from './page.module.css'

export const dynamic = 'force-dynamic'

const PASS_THRESHOLD = 0.70

export default async function LessonResultsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getSession()
  if (!session?.user?.id) notFound()

  const lesson = await db.query.lessons.findFirst({
    where: eq(lessons.id, id),
  })

  if (!lesson || lesson.createdBy !== session.user.id) notFound()

  // Invited emails
  const invitations = await db
    .select({ email: lessonInvitations.email })
    .from(lessonInvitations)
    .where(eq(lessonInvitations.lessonId, id))

  const invitedEmails = invitations.map(i => i.email.toLowerCase())

  // All attempts for this lesson, joined with user info
  const attemptRows = await db
    .select({
      userId: lessonAttempts.userId,
      email: users.email,
      name: users.name,
      status: lessonAttempts.status,
      score: lessonAttempts.score,
      blockResults: lessonAttempts.blockResults,
      startedAt: lessonAttempts.startedAt,
    })
    .from(lessonAttempts)
    .innerJoin(users, eq(users.id, lessonAttempts.userId))
    .where(eq(lessonAttempts.lessonId, id))
    .orderBy(desc(lessonAttempts.startedAt))

  // Build per-user summary (best completed attempt per user)
  const userMap = new Map<string, {
    userId: string
    email: string
    name: string | null
    attemptCount: number
    bestScore: number | null
    status: 'completed' | 'in_progress'
    lastActiveAt: Date
  }>()

  for (const row of attemptRows) {
    const existing = userMap.get(row.userId)
    if (!existing) {
      userMap.set(row.userId, {
        userId: row.userId,
        email: row.email,
        name: row.name,
        attemptCount: 1,
        bestScore: row.status === 'completed' ? (row.score ?? null) : null,
        status: row.status === 'completed' ? 'completed' : 'in_progress',
        lastActiveAt: row.startedAt,
      })
    } else {
      existing.attemptCount++
      if (row.status === 'completed') {
        existing.status = 'completed'
        if (row.score != null && (existing.bestScore == null || row.score > existing.bestScore)) {
          existing.bestScore = row.score
        }
      }
      if (row.startedAt > existing.lastActiveAt) {
        existing.lastActiveAt = row.startedAt
      }
    }
  }

  // Invited but never attempted
  const attemptedEmails = new Set([...userMap.values()].map(u => u.email.toLowerCase()))
  const notStartedEmails = invitedEmails.filter(e => !attemptedEmails.has(e))

  // Roster: completed first (by score desc), then in_progress, then not started
  const rosterAttempted = [...userMap.values()].sort((a, b) => {
    if (a.status === 'completed' && b.status !== 'completed') return -1
    if (b.status === 'completed' && a.status !== 'completed') return 1
    if (a.status === 'completed' && b.status === 'completed') {
      return (b.bestScore ?? 0) - (a.bestScore ?? 0)
    }
    return 0
  })

  // Stats
  const startedCount = userMap.size
  const completedUsers = [...userMap.values()].filter(u => u.status === 'completed')
  const completedCount = completedUsers.length
  const completedScores = completedUsers.map(u => u.bestScore).filter((s): s is number => s != null)
  const avgScore = completedScores.length > 0
    ? completedScores.reduce((a, b) => a + b, 0) / completedScores.length
    : null
  const passCount = completedScores.filter(s => s >= PASS_THRESHOLD).length
  const passRate = completedScores.length > 0 ? passCount / completedScores.length : null

  // Block performance from completed attempts only
  const completedAttempts = attemptRows.filter(r => r.status === 'completed')
  const blockPerf = computeBlockPerformance(completedAttempts, lesson.manifest.blocks)

  const metaParts = [
    lesson.publishedAt ? 'Published' : 'Draft',
    lesson.examEnforced ? 'Exam enforced' : null,
    `${invitedEmails.length} invited`,
  ].filter(Boolean).join(' · ')

  return (
    <main className={styles.main}>
      <nav className={styles.nav}>
        <Link href="/" className={styles.wordmark}>Primr</Link>
        <UserMenu
          userName={session.user.name}
          userEmail={session.user.email}
          role={session.user.productRole}
          internalRole={session.user.internalRole}
          internalUrl={process.env.PRIMR_INTERNAL_URL ?? 'http://localhost:3004'}
        />
      </nav>

      <Link href="/creator" className={styles.backLink}>← Results</Link>

      <h1 className={styles.pageTitle}>{lesson.title}</h1>
      <p className={styles.pageMeta}>{metaParts}</p>

      {/* Stat strip */}
      <div className={styles.statStrip}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Started</div>
          <div className={styles.statValue}>{startedCount}</div>
          <div className={styles.statSub}>of {invitedEmails.length} invited</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Completed</div>
          <div className={styles.statValue}>{completedCount}</div>
          <div className={styles.statSub}>
            {startedCount > 0 ? `${Math.round((completedCount / startedCount) * 100)}% completion` : 'no attempts yet'}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Avg score</div>
          <div className={styles.statValue}>{avgScore != null ? `${Math.round(avgScore * 100)}%` : '—'}</div>
          <div className={styles.statSub}>completed attempts only</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Pass rate</div>
          <div className={styles.statValue}>{passRate != null ? `${Math.round(passRate * 100)}%` : '—'}</div>
          <div className={styles.statSub}>≥ {Math.round(PASS_THRESHOLD * 100)}% = pass</div>
        </div>
      </div>

      {/* Learner roster */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Learner roster</div>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>Learner</th>
              <th>Status</th>
              <th>Score</th>
              <th>Attempts</th>
              <th>Last active</th>
            </tr>
          </thead>
          <tbody>
            {rosterAttempted.map(u => (
              <tr key={u.userId}>
                <td>
                  <div className={styles.learnerName}>{u.name ?? u.email}</div>
                  {u.name && <div className={styles.learnerEmail}>{u.email}</div>}
                </td>
                <td>
                  <span className={u.status === 'completed' ? styles.completedPill : styles.inProgressPill}>
                    {u.status === 'completed' ? 'Completed' : 'In progress'}
                  </span>
                </td>
                <td>
                  {u.bestScore != null ? (
                    <div className={styles.scoreBarWrap}>
                      <div className={styles.scoreBarTrack}>
                        <div className={styles.scoreBarFill} style={{ width: `${Math.round(u.bestScore * 100)}%` }} />
                      </div>
                      <span className={styles.scorePct}>{Math.round(u.bestScore * 100)}%</span>
                    </div>
                  ) : (
                    <span className={styles.muted}>—</span>
                  )}
                </td>
                <td className={styles.muted}>{u.attemptCount}</td>
                <td className={styles.muted}>{u.lastActiveAt.toLocaleDateString()}</td>
              </tr>
            ))}
            {notStartedEmails.map(email => (
              <tr key={email}>
                <td><div className={styles.learnerName}>{email}</div></td>
                <td><span className={styles.notStartedPill}>Not started</span></td>
                <td><span className={styles.muted}>—</span></td>
                <td className={styles.muted}>0</td>
                <td className={styles.muted}>—</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Block performance */}
      {blockPerf.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            Block performance
            <span className={styles.sectionSubtitle}>(scored blocks · completed attempts only)</span>
          </div>
          <div className={styles.blockList}>
            {blockPerf.map(block => {
              const displayPct = block.pctCorrect != null
                ? Math.round(block.pctCorrect * 100)
                : block.avgScore != null
                  ? Math.round(block.avgScore * 100)
                  : null

              const isLow = displayPct != null && displayPct < 75

              return (
                <div key={block.blockId} className={styles.blockRow}>
                  <div className={styles.blockIcon}>
                    {block.blockType === 'exam' ? '📝' : '🧠'}
                  </div>
                  <div className={styles.blockBody}>
                    <div className={styles.blockName}>{block.label}</div>
                    <div className={styles.blockType}>
                      {block.blockType} · {block.responseCount} response{block.responseCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className={styles.blockBarWrap}>
                    <div className={styles.blockBarTrack}>
                      {displayPct != null && (
                        <div
                          className={isLow ? styles.blockBarFillLow : styles.blockBarFill}
                          style={{ width: `${displayPct}%` }}
                        />
                      )}
                    </div>
                    <div className={styles.blockBarN}>
                      {block.pctCorrect != null
                        ? `${displayPct}% correct`
                        : block.avgScore != null
                          ? `${displayPct}% avg`
                          : '—'}
                    </div>
                  </div>
                  <div className={styles.blockStat}>
                    {displayPct != null ? (
                      <>
                        <div className={isLow ? styles.blockPctLow : styles.blockPct}>{displayPct}%</div>
                        <div className={styles.blockPctLabel}>{block.pctCorrect != null ? 'correct' : 'avg score'}</div>
                      </>
                    ) : (
                      <span className={styles.muted}>—</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </main>
  )
}
