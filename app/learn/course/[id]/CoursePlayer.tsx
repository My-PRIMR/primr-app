'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import '@primr/components/dist/style.css'
import { LessonRenderer } from '@primr/components'
import type { LessonManifest, LessonCompletePayload } from '@primr/components'
import styles from './CoursePlayer.module.css'

interface CourseLesson {
  id: string
  title: string
  position: number
  lessonId: string | null
  generationStatus: string
  manifest?: LessonManifest
}

interface CourseChapter {
  id: string
  title: string
  position: number
  lessons: CourseLesson[]
}

interface CourseSectionData {
  id: string
  title: string
  inferred: boolean
  position: number
  chapters: CourseChapter[]
}

interface Props {
  courseId: string
  courseTitle: string
  userId: string
  tree: CourseSectionData[]
  initialChapterLessonId: string | null
}

export default function CoursePlayer({ courseId, courseTitle, userId, tree, initialChapterLessonId }: Props) {
  // Flatten all lessons in order (stable — tree is from server props)
  const flatLessons = tree.flatMap(s =>
    s.chapters.flatMap(c =>
      c.lessons.map(l => ({ ...l, sectionTitle: s.title, chapterTitle: c.title }))
    )
  )

  // Completed lesson IDs (fetched from server, updated optimistically on completion)
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(new Set())
  const [progressLoaded, setProgressLoaded] = useState(false)

  const refreshProgress = useCallback(() => {
    fetch(`/api/courses/${courseId}/progress`)
      .then(r => r.json())
      .then(data => {
        setCompletedLessonIds(new Set(data.completedLessonIds || []))
        setProgressLoaded(true)
      })
      .catch(() => setProgressLoaded(true))
  }, [courseId])

  useEffect(() => { refreshProgress() }, [refreshProgress])

  const storageKey = `primr_course_pos_${courseId}`

  // Initial lesson from URL param only — no localStorage here (avoids SSR/hydration mismatch)
  const defaultLesson = initialChapterLessonId
    ? (flatLessons.find(l => l.id === initialChapterLessonId) ?? flatLessons[0])
    : flatLessons[0]

  const [currentLesson, setCurrentLesson] = useState(defaultLesson ?? null)
  const [lessonCompleted, setLessonCompleted] = useState(false)
  const [allDone, setAllDone] = useState(false)
  const [lessonError, setLessonError] = useState('')

  // Attempt tracking
  const attemptIdRef = useRef<string | null>(null)
  const submittedRef = useRef(false)

  // After hydration: restore saved position if no URL param was provided
  useEffect(() => {
    if (initialChapterLessonId) return  // URL param takes priority
    const savedId = localStorage.getItem(storageKey)
    if (!savedId) return
    const savedLesson = flatLessons.find(l => l.id === savedId)
    if (savedLesson && savedLesson.id !== currentLesson?.id) {
      setCurrentLesson(savedLesson)
    }
  }, []) // intentionally empty — runs once after mount only

  // Persist position whenever the current lesson changes
  useEffect(() => {
    if (currentLesson?.id) {
      localStorage.setItem(storageKey, currentLesson.id)
    }
  }, [currentLesson?.id, storageKey])

  // Start a fresh attempt whenever the current lesson changes
  useEffect(() => {
    if (!currentLesson?.lessonId) return
    attemptIdRef.current = null
    submittedRef.current = false
    setLessonCompleted(false)
    setLessonError('')

    fetch(`/api/lessons/${currentLesson.lessonId}/attempts`, { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        if (data.attempt?.id) attemptIdRef.current = data.attempt.id
        else setLessonError('Could not start lesson.')
      })
      .catch(() => setLessonError('Could not start lesson.'))
  }, [currentLesson?.lessonId])

  // Use a ref so LessonRenderer always calls the *latest* handler,
  // even if it captured the callback before attemptId was set.
  const onCompleteRef = useRef<(payload: LessonCompletePayload) => Promise<void>>(async () => {})

  onCompleteRef.current = async (payload: LessonCompletePayload) => {
    if (submittedRef.current) return
    submittedRef.current = true

    const attemptId = attemptIdRef.current
    if (attemptId) {
      try {
        await fetch(`/api/attempts/${attemptId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            score: payload.score,
            scoredBlocks: payload.scoredBlocks,
            blockResults: payload.blockResults,
          }),
        })
      } catch {
        // still mark as locally completed even if network fails
      }
    }

    // Optimistically mark as completed and show Next button
    if (currentLesson?.lessonId) {
      setCompletedLessonIds(prev => new Set([...prev, currentLesson.lessonId!]))
    }
    setLessonCompleted(true)

    // Refresh from server to stay in sync
    refreshProgress()
  }

  // Stable wrapper — passed to LessonRenderer once, always calls the latest ref
  const stableOnComplete = useCallback((payload: LessonCompletePayload) => {
    onCompleteRef.current(payload)
  }, [])

  function isUnlocked(lesson: typeof flatLessons[number]): boolean {
    if (!lesson.lessonId || lesson.generationStatus !== 'done') return false
    const idx = flatLessons.findIndex(l => l.id === lesson.id)
    for (let i = 0; i < idx; i++) {
      const prev = flatLessons[i]
      if (prev.lessonId && prev.generationStatus === 'done' && !completedLessonIds.has(prev.lessonId)) {
        return false
      }
    }
    return true
  }

  function isAccessible(lesson: typeof flatLessons[number]): boolean {
    if (!lesson.lessonId || lesson.generationStatus !== 'done') return false
    const completed = completedLessonIds.has(lesson.lessonId)
    return completed || isUnlocked(lesson)
  }

  function handleSelectLesson(lesson: typeof flatLessons[number]) {
    if (!isAccessible(lesson)) return
    setCurrentLesson(lesson)
    setLessonCompleted(false)
  }

  function handleNextLesson() {
    const currentIdx = flatLessons.findIndex(l => l.id === currentLesson?.id)
    const nextLesson = flatLessons.slice(currentIdx + 1).find(
      l => l.lessonId && l.generationStatus === 'done'
    )
    if (nextLesson) {
      setCurrentLesson(nextLesson)
      setLessonCompleted(false)
    } else {
      setAllDone(true)
    }
  }

  const completedCount = flatLessons.filter(l => l.lessonId && completedLessonIds.has(l.lessonId)).length
  const totalCount = flatLessons.filter(l => l.lessonId && l.generationStatus === 'done').length

  // Determine if there is a next lesson after the current one
  const currentIdx = flatLessons.findIndex(l => l.id === currentLesson?.id)
  const hasNextLesson = flatLessons.slice(currentIdx + 1).some(
    l => l.lessonId && l.generationStatus === 'done'
  )

  // Scroll the active lesson button into view whenever the current lesson changes
  const activeLessonBtnRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    activeLessonBtnRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [currentLesson?.id])

  return (
    <div className={styles.layout}>
      {/* Top header */}
      <header className={styles.topHeader}>
        <Link href="/creator" className={styles.topWordmark}>Primr</Link>
        <Link href="/creator" className={styles.topExitBtn}>← Exit</Link>
      </header>

      <div className={styles.body}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2 className={styles.courseTitle}>{courseTitle}</h2>
          {progressLoaded && (
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : '0%' }}
              />
            </div>
          )}
          <p className={styles.progressText}>{completedCount}/{totalCount} complete</p>
        </div>

        <nav className={styles.treeNav}>
          {tree.map(section => (
            <div key={section.id} className={styles.sideSection}>
              <div className={styles.sideSectionTitle}>{section.title}</div>
              {section.chapters.map(chapter => (
                <div key={chapter.id} className={styles.sideChapter}>
                  <div className={styles.sideChapterTitle}>{chapter.title}</div>
                  {chapter.lessons.map(lesson => {
                    const fullLesson = { ...lesson, sectionTitle: section.title, chapterTitle: chapter.title }
                    const accessible = progressLoaded ? isAccessible(fullLesson) : false
                    const completed = lesson.lessonId ? completedLessonIds.has(lesson.lessonId) : false
                    const isCurrent = currentLesson?.id === lesson.id
                    const notReady = lesson.generationStatus !== 'done'

                    return (
                      <button
                        key={lesson.id}
                        ref={isCurrent ? activeLessonBtnRef : null}
                        className={[
                          styles.lessonBtn,
                          isCurrent ? styles.lessonActive : '',
                          completed ? styles.lessonCompleted : '',
                          !accessible && !isCurrent ? styles.lessonLocked : '',
                        ].join(' ')}
                        onClick={() => handleSelectLesson(fullLesson)}
                        disabled={!accessible || notReady}
                        title={
                          notReady ? 'Still generating…'
                          : !accessible ? 'Complete previous lessons first'
                          : lesson.title
                        }
                      >
                        <span className={styles.lessonIcon}>
                          {notReady ? '⏳' : completed ? '✓' : accessible ? '○' : '🔒'}
                        </span>
                        <span className={styles.lessonLabel}>{lesson.title}</span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className={styles.main}>
        {allDone ? (
          <div className={styles.completionScreen}>
            <span className={styles.completionIcon}>🎓</span>
            <h1 className={styles.completionTitle}>Course complete!</h1>
            <p className={styles.completionSub}>You've completed all {totalCount} lessons.</p>
            <Link href="/creator" className={styles.completionBtn}>Back to dashboard</Link>
          </div>
        ) : currentLesson?.manifest ? (
          <div className={styles.lessonWrap}>
            {lessonError && <div className={styles.error}>{lessonError}</div>}
            <LessonRenderer
              key={currentLesson.id}
              manifest={currentLesson.manifest}
              onLessonComplete={stableOnComplete}
            />
            {lessonCompleted && (
              <div className={styles.nextBar}>
                {hasNextLesson ? (
                  <button className={styles.nextBtn} onClick={handleNextLesson}>
                    Next lesson →
                  </button>
                ) : (
                  <button className={styles.nextBtn} onClick={() => setAllDone(true)}>
                    Finish course →
                  </button>
                )}
              </div>
            )}
          </div>
        ) : currentLesson?.generationStatus === 'pending' || currentLesson?.generationStatus === 'generating' ? (
          <div className={styles.notReady}>
            <div className={styles.spinner} />
            <p>This lesson is still being generated…</p>
          </div>
        ) : currentLesson?.generationStatus === 'failed' ? (
          <div className={styles.notReady}>
            <p>⚠️ This lesson failed to generate. Ask your instructor to retry it.</p>
          </div>
        ) : (
          <div className={styles.notReady}>
            <p>Select a lesson from the sidebar to begin.</p>
          </div>
        )}
      </main>
      </div>
    </div>
  )
}
