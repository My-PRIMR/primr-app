'use client'

import { useState } from 'react'
import Link from 'next/link'
import styles from './CreatorDashboard.module.css'

export type EnrolledCourse = {
  id: string
  title: string
  status: string
  doneCount: number
  completedCount: number
}

export type InvitedLesson = {
  id: string
  title: string
  slug: string
  attemptCount: number
  bestScore: number | null
  lastAttempt: string | null
}

export type HistoryLesson = {
  id: string
  title: string
  attemptCount: number
  bestScore: number | null
  lastAttempt: string | null
}

type Tab = 'courses' | 'lessons' | 'history'

function enrolledLabel(doneCount: number, completedCount: number) {
  if (doneCount === 0) return 'Not yet available'
  if (completedCount === 0) return `${doneCount} lessons · Not started`
  if (completedCount >= doneCount) return `${doneCount} lessons · Complete ✓`
  return `${doneCount} lessons · ${completedCount} done`
}

function attemptMeta(attemptCount: number, bestScore: number | null, lastAttempt: string | null) {
  let s = `${attemptCount} attempt${attemptCount !== 1 ? 's' : ''}`
  if (bestScore != null) s += ` · Best: ${Math.round(bestScore * 100)}%`
  if (lastAttempt) s += ` · Last: ${new Date(lastAttempt).toLocaleDateString()}`
  return s
}

function defaultTab(courses: EnrolledCourse[], lessons: InvitedLesson[], history: HistoryLesson[]): Tab {
  if (courses.length > 0) return 'courses'
  if (lessons.length > 0) return 'lessons'
  return 'history'
}

export default function LearnerDashboard({
  courses,
  lessons,
  history,
  isCreator,
}: {
  courses: EnrolledCourse[]
  lessons: InvitedLesson[]
  history: HistoryLesson[]
  isCreator: boolean
}) {
  const [tab, setTab] = useState<Tab>(() => defaultTab(courses, lessons, history))

  return (
    <div>
      {/* ── Tabs ── */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'courses' ? styles.tabActive : ''}`}
          onClick={() => setTab('courses')}
        >
          {isCreator ? 'Assigned courses' : 'Courses'}
          {courses.length > 0 && <span className={styles.tabBadge}>{courses.length}</span>}
        </button>
        <button
          className={`${styles.tab} ${tab === 'lessons' ? styles.tabActive : ''}`}
          onClick={() => setTab('lessons')}
        >
          {isCreator ? 'Assigned lessons' : 'Lessons'}
          {lessons.length > 0 && <span className={styles.tabBadge}>{lessons.length}</span>}
        </button>
        <button
          className={`${styles.tab} ${tab === 'history' ? styles.tabActive : ''}`}
          onClick={() => setTab('history')}
        >
          History
          {history.length > 0 && <span className={styles.tabBadge}>{history.length}</span>}
        </button>
      </div>

      {/* ── Courses tab ── */}
      {tab === 'courses' && (
        courses.length === 0 ? (
          <p className={styles.empty}>No courses assigned to you yet.</p>
        ) : (
          <div className={styles.cardGrid}>
            {courses.map(course => {
              const allDone = course.doneCount > 0 && course.completedCount >= course.doneCount
              const started = course.completedCount > 0
              return (
                <div key={course.id} className={styles.card}>
                  <div className={styles.cardBody}>
                    <h2 className={styles.cardTitle}>{course.title}</h2>
                    <p className={styles.cardMeta}>{enrolledLabel(course.doneCount, course.completedCount)}</p>
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
        )
      )}

      {/* ── Lessons tab ── */}
      {tab === 'lessons' && (
        lessons.length === 0 ? (
          <p className={styles.empty}>No lessons assigned to you yet.</p>
        ) : (
          <div className={styles.cardGrid}>
            {lessons.map(lesson => (
              <div key={lesson.id} className={styles.card}>
                <div className={styles.cardBody}>
                  <h2 className={styles.cardTitle}>{lesson.title}</h2>
                  <p className={styles.cardMeta}>
                    {lesson.attemptCount > 0
                      ? attemptMeta(lesson.attemptCount, lesson.bestScore, lesson.lastAttempt)
                      : 'Not started'}
                  </p>
                </div>
                <div className={styles.cardActions}>
                  <Link href={`/learn/${lesson.id}`} className={styles.editLink}>Take lesson</Link>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── History tab ── */}
      {tab === 'history' && (
        history.length === 0 ? (
          <p className={styles.empty}>No lessons taken yet.</p>
        ) : (
          <div className={styles.cardGrid}>
            {history.map(lesson => (
              <div key={lesson.id} className={styles.card}>
                <div className={styles.cardBody}>
                  <h2 className={styles.cardTitle}>{lesson.title}</h2>
                  <p className={styles.cardMeta}>
                    {attemptMeta(lesson.attemptCount, lesson.bestScore, lesson.lastAttempt)}
                  </p>
                </div>
                <div className={styles.cardActions}>
                  <Link href={`/learn/${lesson.id}`} className={styles.previewLink}>Retake</Link>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
