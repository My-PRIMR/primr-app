'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import '@primr/components/dist/style.css'
import { LessonRenderer } from '@primr/components'
import type { LessonManifest, LessonCompletePayload } from '@primr/components'
import styles from './EmbedCoursePlayer.module.css'

interface CourseLesson {
  id: string; title: string; position: number
  lessonId: string | null; generationStatus: string; manifest?: LessonManifest
}

interface CourseChapter {
  id: string; title: string; position: number; lessons: CourseLesson[]
}

interface CourseSectionData {
  id: string; title: string; inferred: boolean; position: number; chapters: CourseChapter[]
}

interface Props {
  courseId: string; courseTitle: string; tree: CourseSectionData[]
  initialChapterLessonId: string | null; initialTheme?: 'light' | 'dark'
}

function getOrCreateSessionId(): string {
  const key = 'primr_embed_sid'
  let sid = ''
  try {
    sid = localStorage.getItem(key) || ''
    if (!sid) { sid = crypto.randomUUID(); localStorage.setItem(key, sid) }
  } catch { sid = crypto.randomUUID() }
  return sid
}

export default function EmbedCoursePlayer({ courseId, courseTitle, tree, initialChapterLessonId, initialTheme }: Props) {
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === 'primr-auth-complete') {
        setLoggedIn(true)
        window.parent.postMessage({ type: 'primr-auth-complete', userId: e.data.userId }, '*')
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  function handleLogin() {
    const authUrl = process.env.NEXT_PUBLIC_PRIMR_AUTH_URL || 'http://localhost:3001'
    const w = window.open(
      `${authUrl}/login?embed=true`,
      'primr-login',
      'width=500,height=700,menubar=no,toolbar=no'
    )
    if (!w) {
      window.location.href = `${authUrl}/login?embed=true&returnUrl=${encodeURIComponent(window.location.href)}`
    }
  }

  const flatLessons = tree.flatMap(s =>
    s.chapters.flatMap(c =>
      c.lessons.map(l => ({ ...l, sectionTitle: s.title, chapterTitle: c.title }))
    )
  )

  const storageKey = `primr_embed_course_${courseId}`
  const defaultLesson = initialChapterLessonId
    ? (flatLessons.find(l => l.id === initialChapterLessonId) ?? flatLessons[0])
    : flatLessons[0]

  const [currentLesson, setCurrentLesson] = useState(defaultLesson ?? null)
  const [lessonCompleted, setLessonCompleted] = useState(false)
  const [allDone, setAllDone] = useState(false)
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (initialTheme) document.documentElement.setAttribute('data-theme', initialTheme)
    document.body.dataset.embedType = 'course'
    document.body.dataset.embedId = courseId
  }, [initialTheme, courseId])

  // Restore position from localStorage
  useEffect(() => {
    if (initialChapterLessonId) return
    try {
      const savedId = localStorage.getItem(storageKey)
      if (!savedId) return
      const savedLesson = flatLessons.find(l => l.id === savedId)
      if (savedLesson && savedLesson.id !== currentLesson?.id) setCurrentLesson(savedLesson)
    } catch {}
  }, [])

  // Persist position
  useEffect(() => {
    if (currentLesson?.id) {
      try { localStorage.setItem(storageKey, currentLesson.id) } catch {}
    }
  }, [currentLesson?.id, storageKey])

  // Restore completed lessons from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`${storageKey}_completed`)
      if (raw) setCompletedLessonIds(new Set(JSON.parse(raw)))
    } catch {}
  }, [])

  // Fire view event
  useEffect(() => {
    const sid = getOrCreateSessionId()
    fetch('/api/embed/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId, eventType: 'view', anonymousSessionId: sid, embedOrigin: document.referrer || '' }),
    }).catch(() => {})
  }, [courseId])

  const onCompleteRef = useRef<(payload: LessonCompletePayload) => void>(() => {})

  onCompleteRef.current = (payload: LessonCompletePayload) => {
    setLessonCompleted(true)
    if (currentLesson?.lessonId) {
      const next = new Set([...completedLessonIds, currentLesson.lessonId])
      setCompletedLessonIds(next)
      try { localStorage.setItem(`${storageKey}_completed`, JSON.stringify([...next])) } catch {}
    }
    window.parent.postMessage({
      type: 'primr-lesson-complete', lessonId: currentLesson?.lessonId, courseId, score: payload.score,
    }, '*')
    const sid = getOrCreateSessionId()
    fetch('/api/embed/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courseId, lessonId: currentLesson?.lessonId, eventType: 'course_lesson_complete',
        anonymousSessionId: sid, embedOrigin: document.referrer || '',
        payload: { score: payload.score, scoredBlocks: payload.scoredBlocks, totalBlocks: payload.totalBlocks },
      }),
    }).catch(() => {})
  }

  const stableOnComplete = useCallback((payload: LessonCompletePayload) => { onCompleteRef.current(payload) }, [])

  function handleSelectLesson(lesson: typeof flatLessons[number]) {
    if (!lesson.lessonId || lesson.generationStatus !== 'done') return
    setCurrentLesson(lesson)
    setLessonCompleted(false)
  }

  function handleNextLesson() {
    const currentIdx = flatLessons.findIndex(l => l.id === currentLesson?.id)
    const nextLesson = flatLessons.slice(currentIdx + 1).find(l => l.lessonId && l.generationStatus === 'done')
    if (nextLesson) { setCurrentLesson(nextLesson); setLessonCompleted(false) }
    else setAllDone(true)
  }

  const completedCount = flatLessons.filter(l => l.lessonId && completedLessonIds.has(l.lessonId)).length
  const totalCount = flatLessons.filter(l => l.lessonId && l.generationStatus === 'done').length
  const currentIdx = flatLessons.findIndex(l => l.id === currentLesson?.id)
  const hasNextLesson = flatLessons.slice(currentIdx + 1).some(l => l.lessonId && l.generationStatus === 'done')

  const activeLessonBtnRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { activeLessonBtnRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }, [currentLesson?.id])

  return (
    <div className={styles.layout}>
      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <h2 className={styles.courseTitle}>{courseTitle}</h2>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : '0%' }} />
            </div>
            <p className={styles.progressText}>{completedCount}/{totalCount} complete</p>
            {!loggedIn && (
              <button
                onClick={handleLogin}
                className={styles.loginLink}
              >
                Sign in to save progress
              </button>
            )}
          </div>
          <nav className={styles.treeNav}>
            {tree.map(section => (
              <div key={section.id} className={styles.sideSection}>
                <div className={styles.sideSectionTitle}>{section.title}</div>
                {section.chapters.map(chapter => (
                  <div key={chapter.id} className={styles.sideChapter}>
                    <div className={styles.sideChapterTitle}>{chapter.title}</div>
                    {chapter.lessons.map(lesson => {
                      const completed = lesson.lessonId ? completedLessonIds.has(lesson.lessonId) : false
                      const isCurrent = currentLesson?.id === lesson.id
                      const notReady = lesson.generationStatus !== 'done'
                      const accessible = !notReady && !!lesson.lessonId
                      return (
                        <button
                          key={lesson.id}
                          ref={isCurrent ? activeLessonBtnRef : null}
                          className={[styles.lessonBtn, isCurrent ? styles.lessonActive : '', completed ? styles.lessonCompleted : ''].join(' ')}
                          onClick={() => handleSelectLesson({ ...lesson, sectionTitle: section.title, chapterTitle: chapter.title })}
                          disabled={!accessible}
                          title={notReady ? 'Still generating...' : lesson.title}
                        >
                          <span className={styles.lessonIcon}>{notReady ? '...' : completed ? '\u2713' : '\u25CB'}</span>
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
        <main className={styles.main}>
          {allDone ? (
            <div className={styles.completionScreen}>
              <h1 className={styles.completionTitle}>Course complete!</h1>
              <p className={styles.completionSub}>You completed all {totalCount} lessons.</p>
            </div>
          ) : currentLesson?.manifest ? (
            <div className={styles.lessonWrap}>
              <LessonRenderer key={currentLesson.id} manifest={currentLesson.manifest} adminMode={false} mode="showcase" examEnforced={false} onLessonComplete={stableOnComplete} hideAutoAdvance />
              {lessonCompleted && (
                <div className={styles.nextBar}>
                  {hasNextLesson ? (
                    <button className={styles.nextBtn} onClick={handleNextLesson}>Next lesson &rarr;</button>
                  ) : (
                    <button className={styles.nextBtn} onClick={() => setAllDone(true)}>Finish course &rarr;</button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className={styles.notReady}><p>Select a lesson from the sidebar to begin.</p></div>
          )}
        </main>
      </div>
      <footer className={styles.footer}>
        Powered by <a href="https://getprimr.com" target="_blank" rel="noopener">Primr</a>
      </footer>
    </div>
  )
}
