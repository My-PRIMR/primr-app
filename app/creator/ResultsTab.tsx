'use client'

import { useState } from 'react'
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

export type CourseLearnerRow = {
  email: string
  name: string | null
  completedLessons: number
  totalLessons: number
  avgScore: number | null
  status: 'completed' | 'in_progress' | 'not_started'
  lastActivity: string | null
}

export type CourseResultRow = {
  id: string
  title: string
  totalLessons: number
  enrolledCount: number
  completedCount: number   // learners who completed all lessons
  learners: CourseLearnerRow[]
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
  courseRows: CourseResultRow[]
}

export default function ResultsTab({ results }: { results: ResultsData }) {
  const { totalLearners, startedCount, completedCount, avgScore, lastActivityDate, dailyActivity, lessonRows, courseRows } = results

  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const completionRate = startedCount > 0 ? Math.round((completedCount / startedCount) * 100) : null
  const maxActivity = Math.max(...dailyActivity.map(d => d.count), 1)

  const hasAnything = courseRows.length > 0 || lessonRows.length > 0

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
            {lastActivityDate ? new Date(lastActivityDate).toLocaleDateString('en-US', { timeZone: 'UTC' }) : '—'}
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

      {/* Empty state */}
      {!hasAnything && (
        <p className={styles.empty}>No lessons published yet.</p>
      )}

      {/* Courses section */}
      {courseRows.length > 0 && (
        <>
          <div className={styles.resultsSectionTitle}>Courses</div>
          <div className={styles.courseList}>
            {courseRows.map(course => {
              const isExpanded = expanded.has(course.id)
              const completionPct = course.enrolledCount > 0
                ? Math.round((course.completedCount / course.enrolledCount) * 100)
                : null

              return (
                <div key={course.id} className={styles.courseItem}>
                  <div className={styles.courseHeader}>
                    <button
                      type="button"
                      className={styles.expandToggle}
                      onClick={() => toggleExpand(course.id)}
                      aria-expanded={isExpanded}
                    >
                      <span className={styles.expandIcon}>{isExpanded ? '−' : '+'}</span>
                      <div className={styles.courseInfo}>
                        <div className={styles.courseTitle}>{course.title}</div>
                        <div className={styles.courseMeta}>
                          {course.enrolledCount} enrolled · {course.totalLessons} lessons
                        </div>
                      </div>
                      <div className={styles.courseCompletionWrap}>
                        <div className={styles.courseMiniBar}>
                          <div
                            className={styles.courseMiniBarFill}
                            style={{
                              width: completionPct != null ? `${completionPct}%` : '0%'
                            }}
                          />
                        </div>
                        <span className={styles.courseCompletionPct}>
                          {completionPct != null ? `${completionPct}% completed` : '—'}
                        </span>
                      </div>
                    </button>
                    <Link
                      href={`/creator/courses/${course.id}/results`}
                      className={styles.courseViewLink}
                    >
                      View results →
                    </Link>
                  </div>

                  {isExpanded && (
                    <div className={styles.learnerSubTable}>
                      <table className={styles.learnerTable}>
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
                          {course.learners.map(learner => {
                            const progressFrac = learner.totalLessons > 0
                              ? learner.completedLessons / learner.totalLessons
                              : 0
                            const progressPct = Math.round(progressFrac * 100)

                            const barColor = learner.status === 'completed'
                              ? 'var(--color-teal)'
                              : learner.status === 'in_progress'
                                ? 'var(--color-amber)'
                                : 'var(--color-ink-muted, #999)'

                            const pillClass = learner.status === 'completed'
                              ? styles.completedPillSub
                              : learner.status === 'in_progress'
                                ? styles.inProgressPillSub
                                : styles.notStartedPillSub

                            const pillLabel = learner.status === 'completed'
                              ? 'Completed'
                              : learner.status === 'in_progress'
                                ? 'In progress'
                                : 'Not started'

                            return (
                              <tr key={learner.email}>
                                <td>
                                  {learner.name && <div className={styles.learnerName}>{learner.name}</div>}
                                  <div className={styles.learnerEmail}>{learner.email}</div>
                                </td>
                                <td>
                                  <div className={styles.progWrap}>
                                    <div className={styles.progBarBg}>
                                      <div
                                        className={styles.progBarFill}
                                        style={{ width: `${progressPct}%`, backgroundColor: barColor }}
                                      />
                                    </div>
                                    <span className={styles.progLabel}>
                                      {learner.completedLessons} / {learner.totalLessons} lessons
                                    </span>
                                  </div>
                                </td>
                                <td>
                                  {learner.avgScore != null ? (
                                    <div className={styles.scoreBarWrap}>
                                      <div className={styles.scoreBarTrack}>
                                        <div
                                          className={styles.scoreBarFill}
                                          style={{ width: `${Math.round(learner.avgScore * 100)}%` }}
                                        />
                                      </div>
                                      <span className={styles.scorePct}>{Math.round(learner.avgScore * 100)}%</span>
                                    </div>
                                  ) : (
                                    <span style={{ color: 'var(--ink-muted, #888)' }}>—</span>
                                  )}
                                </td>
                                <td>
                                  <span className={pillClass}>{pillLabel}</span>
                                </td>
                                <td>
                                  {learner.lastActivity
                                    ? new Date(learner.lastActivity).toLocaleDateString('en-US', { timeZone: 'UTC' })
                                    : '—'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Standalone lessons table */}
      {lessonRows.length > 0 && (
        <>
          <div className={styles.resultsSectionTitle}>Standalone lessons</div>
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
                const denominator = row.invitedCount > 0 ? row.invitedCount : row.startedCount
                const completedFrac = denominator > 0 ? row.completedCount / denominator : 0
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
                        {row.completedCount} / {denominator}
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
                        <span style={{ color: 'var(--ink-muted, #888)' }}>—</span>
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
