'use client'

import Link from 'next/link'
import styles from './CreatorDashboard.module.css'

export type LessonResultRow = {
  id: string
  title: string
  invitedCount: number
  startedCount: number
  completedCount: number
  avgScore: number | null
}

export type ResultsData = {
  totalLearners: number
  startedCount: number
  completedCount: number
  avgScore: number | null
  lastActivityDate: string | null
  /** 30 entries, one per day, ascending date order */
  dailyActivity: Array<{ date: string; count: number }>
  lessonRows: LessonResultRow[]
}

export default function ResultsTab({ results }: { results: ResultsData }) {
  const { totalLearners, startedCount, completedCount, avgScore, lastActivityDate, dailyActivity, lessonRows } = results

  const completionRate = startedCount > 0 ? Math.round((completedCount / startedCount) * 100) : null
  const maxActivity = Math.max(...dailyActivity.map(d => d.count), 1)

  return (
    <div>
      {/* Stat cards */}
      <div className={styles.resultsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total learners</div>
          <div className={styles.statValue}>{totalLearners}</div>
          <div className={styles.statSub}>across all lessons</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Completion rate</div>
          <div className={styles.statValue}>{completionRate != null ? `${completionRate}%` : '—'}</div>
          <div className={styles.statSub}>{completedCount} of {startedCount} completed</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Avg score</div>
          <div className={styles.statValue}>{avgScore != null ? `${Math.round(avgScore * 100)}%` : '—'}</div>
          <div className={styles.statSub}>completed attempts only</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Last activity</div>
          <div className={styles.statValue} style={{ fontSize: '18px', paddingTop: '4px' }}>
            {lastActivityDate ? new Date(lastActivityDate).toLocaleDateString() : '—'}
          </div>
          <div className={styles.statSub}>{lastActivityDate ? 'most recent completion' : 'no completions yet'}</div>
        </div>
      </div>

      {/* Activity chart */}
      <div className={styles.activityChart}>
        <div className={styles.activityChartTitle}>Completions — last 30 days</div>
        <div className={styles.chartBars}>
          {dailyActivity.map((day, i) => {
            const isToday = i === dailyActivity.length - 1
            const heightPct = Math.max((day.count / maxActivity) * 100, day.count > 0 ? 4 : 2)
            return (
              <div key={day.date} className={styles.chartBarCol} title={`${day.date}: ${day.count}`}>
                <div className={styles.chartBar} style={{ height: `${heightPct}%` }} />
                {isToday && <div className={styles.chartBarLabel}>Today</div>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Per-lesson table */}
      {lessonRows.length === 0 ? (
        <p className={styles.empty}>No lessons published yet.</p>
      ) : (
        <>
          <div className={styles.resultsSectionTitle}>Results by lesson</div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Lesson</th>
                <th className={styles.thMeta}>Invited</th>
                <th className={styles.thMeta}>Started</th>
                <th className={styles.thMeta}>Completed</th>
                <th className={styles.thMeta}>Avg score</th>
                <th className={styles.thActions}></th>
              </tr>
            </thead>
            <tbody>
              {lessonRows.map(row => {
                const completedFrac = row.invitedCount > 0 ? row.completedCount / row.invitedCount : 0
                const pillClass = completedFrac >= 0.8
                  ? styles.completedPill
                  : completedFrac > 0
                    ? styles.partialPill
                    : styles.notStartedPill

                return (
                  <tr key={row.id} className={styles.row}>
                    <td className={styles.tdTitle}>{row.title}</td>
                    <td className={styles.tdMeta}>{row.invitedCount}</td>
                    <td className={styles.tdMeta}>{row.startedCount}</td>
                    <td className={styles.tdMeta}>
                      <span className={pillClass}>
                        {row.completedCount} / {row.invitedCount}
                      </span>
                    </td>
                    <td className={styles.tdMeta}>
                      {row.avgScore != null ? (
                        <div className={styles.scoreBarWrap}>
                          <div className={styles.scoreBarTrack}>
                            <div
                              className={styles.scoreBarFill}
                              style={{ width: `${Math.round(row.avgScore * 100)}%` }}
                            />
                          </div>
                          <span className={styles.scorePct}>{Math.round(row.avgScore * 100)}%</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--ink-muted)' }}>—</span>
                      )}
                    </td>
                    <td className={styles.tdActions}>
                      <div className={styles.rowActions}>
                        <Link href={`/creator/lessons/${row.id}/results`} className={styles.editLink}>
                          View results →
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
