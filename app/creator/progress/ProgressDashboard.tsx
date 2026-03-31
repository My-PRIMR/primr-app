'use client'

import { useState } from 'react'
import styles from './ProgressDashboard.module.css'

type CourseLearner = {
  email: string
  name: string | null
  completedLessons: number
  avgScore: number | null
  lastActivity: string | null
}

type CourseProgress = {
  id: string
  title: string
  status: string
  totalLessons: number
  enrolledCount: number
  learners: CourseLearner[]
}

type LessonLearner = {
  email: string
  name: string | null
  attemptCount: number
  bestScore: number | null
  completed: boolean
  lastActivity: string | null
}

type LessonProgress = {
  id: string
  title: string
  published: boolean
  invitedCount: number
  learners: LessonLearner[]
}

type Tab = 'courses' | 'lessons'

export default function ProgressDashboard({
  courses,
  lessons,
}: {
  courses: CourseProgress[]
  lessons: LessonProgress[]
}) {
  const [tab, setTab] = useState<Tab>(courses.length > 0 ? 'courses' : 'lessons')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function toggleExpand(id: string) {
    setExpandedId(prev => prev === id ? null : id)
  }

  const totalCourseLearners = courses.reduce((sum, c) => sum + c.enrolledCount, 0)
  const totalLessonLearners = lessons.reduce((sum, l) => sum + l.invitedCount, 0)

  return (
    <div>
      {/* Summary stats */}
      <div className={styles.statsRow}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{courses.length}</span>
          <span className={styles.statLabel}>Courses</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{lessons.length}</span>
          <span className={styles.statLabel}>Lessons</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{totalCourseLearners + totalLessonLearners}</span>
          <span className={styles.statLabel}>Total learners</span>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'courses' ? styles.tabActive : ''}`}
          onClick={() => { setTab('courses'); setExpandedId(null) }}
        >
          Courses
          {courses.length > 0 && <span className={styles.tabBadge}>{courses.length}</span>}
        </button>
        <button
          className={`${styles.tab} ${tab === 'lessons' ? styles.tabActive : ''}`}
          onClick={() => { setTab('lessons'); setExpandedId(null) }}
        >
          Lessons
          {lessons.length > 0 && <span className={styles.tabBadge}>{lessons.length}</span>}
        </button>
      </div>

      {/* Courses tab */}
      {tab === 'courses' && (
        courses.length === 0 ? (
          <p className={styles.empty}>No courses created yet.</p>
        ) : (
          <div className={styles.list}>
            {courses.map(course => {
              const isExpanded = expandedId === course.id
              const completedAll = course.learners.filter(l => l.completedLessons >= course.totalLessons && course.totalLessons > 0)
              const completionRate = course.enrolledCount > 0 && course.totalLessons > 0
                ? Math.round((completedAll.length / course.enrolledCount) * 100)
                : 0

              return (
                <div key={course.id} className={styles.item}>
                  <button className={styles.itemHeader} onClick={() => toggleExpand(course.id)}>
                    <span className={styles.expandIcon}>{isExpanded ? '−' : '+'}</span>
                    <div className={styles.itemInfo}>
                      <span className={styles.itemTitle}>{course.title}</span>
                      <span className={styles.itemMeta}>
                        {course.enrolledCount} learner{course.enrolledCount !== 1 ? 's' : ''}
                        {' · '}
                        {course.totalLessons} lesson{course.totalLessons !== 1 ? 's' : ''}
                        {course.enrolledCount > 0 && ` · ${completionRate}% completion`}
                      </span>
                    </div>
                    {course.enrolledCount > 0 && course.totalLessons > 0 && (
                      <div className={styles.miniBar}>
                        <div
                          className={styles.miniBarFill}
                          style={{ width: `${completionRate}%` }}
                        />
                      </div>
                    )}
                  </button>

                  {isExpanded && (
                    <div className={styles.learnerTable}>
                      {course.learners.length === 0 ? (
                        <p className={styles.emptyNested}>No learners enrolled yet.</p>
                      ) : (
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th>Learner</th>
                              <th>Progress</th>
                              <th>Avg score</th>
                              <th>Last activity</th>
                            </tr>
                          </thead>
                          <tbody>
                            {course.learners.map(learner => {
                              const pct = course.totalLessons > 0
                                ? Math.round((learner.completedLessons / course.totalLessons) * 100)
                                : 0
                              const done = learner.completedLessons >= course.totalLessons && course.totalLessons > 0
                              return (
                                <tr key={learner.email}>
                                  <td>
                                    <span className={styles.learnerName}>{learner.name || learner.email}</span>
                                    {learner.name && <span className={styles.learnerEmail}>{learner.email}</span>}
                                  </td>
                                  <td>
                                    <div className={styles.progressCell}>
                                      <div className={styles.progressBar}>
                                        <div
                                          className={`${styles.progressBarFill} ${done ? styles.progressComplete : ''}`}
                                          style={{ width: `${pct}%` }}
                                        />
                                      </div>
                                      <span className={styles.progressLabel}>
                                        {learner.completedLessons}/{course.totalLessons}
                                      </span>
                                    </div>
                                  </td>
                                  <td>
                                    {learner.avgScore != null
                                      ? `${Math.round(learner.avgScore * 100)}%`
                                      : '—'}
                                  </td>
                                  <td className={styles.dateCell}>
                                    {learner.lastActivity
                                      ? new Date(learner.lastActivity).toLocaleDateString()
                                      : 'Not started'}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      )}

      {/* Lessons tab */}
      {tab === 'lessons' && (
        lessons.length === 0 ? (
          <p className={styles.empty}>No standalone lessons created yet.</p>
        ) : (
          <div className={styles.list}>
            {lessons.map(lesson => {
              const isExpanded = expandedId === lesson.id
              const completedCount = lesson.learners.filter(l => l.completed).length
              const completionRate = lesson.invitedCount > 0
                ? Math.round((completedCount / lesson.invitedCount) * 100)
                : 0

              return (
                <div key={lesson.id} className={styles.item}>
                  <button className={styles.itemHeader} onClick={() => toggleExpand(lesson.id)}>
                    <span className={styles.expandIcon}>{isExpanded ? '−' : '+'}</span>
                    <div className={styles.itemInfo}>
                      <span className={styles.itemTitle}>
                        {lesson.title}
                        {!lesson.published && <span className={styles.draftBadge}>Draft</span>}
                      </span>
                      <span className={styles.itemMeta}>
                        {lesson.invitedCount} learner{lesson.invitedCount !== 1 ? 's' : ''}
                        {lesson.invitedCount > 0 && ` · ${completionRate}% completed`}
                      </span>
                    </div>
                    {lesson.invitedCount > 0 && (
                      <div className={styles.miniBar}>
                        <div
                          className={styles.miniBarFill}
                          style={{ width: `${completionRate}%` }}
                        />
                      </div>
                    )}
                  </button>

                  {isExpanded && (
                    <div className={styles.learnerTable}>
                      {lesson.learners.length === 0 ? (
                        <p className={styles.emptyNested}>No learners invited yet.</p>
                      ) : (
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th>Learner</th>
                              <th>Attempts</th>
                              <th>Best score</th>
                              <th>Status</th>
                              <th>Last activity</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lesson.learners.map(learner => (
                              <tr key={learner.email}>
                                <td>
                                  <span className={styles.learnerName}>{learner.name || learner.email}</span>
                                  {learner.name && <span className={styles.learnerEmail}>{learner.email}</span>}
                                </td>
                                <td>{learner.attemptCount || '—'}</td>
                                <td>
                                  {learner.bestScore != null
                                    ? `${Math.round(learner.bestScore * 100)}%`
                                    : '—'}
                                </td>
                                <td>
                                  <span className={`${styles.statusBadge} ${learner.completed ? styles.statusComplete : learner.attemptCount > 0 ? styles.statusInProgress : styles.statusNotStarted}`}>
                                    {learner.completed ? 'Completed' : learner.attemptCount > 0 ? 'In progress' : 'Not started'}
                                  </span>
                                </td>
                                <td className={styles.dateCell}>
                                  {learner.lastActivity
                                    ? new Date(learner.lastActivity).toLocaleDateString()
                                    : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
