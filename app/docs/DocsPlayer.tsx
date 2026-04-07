'use client'

import { useState, useEffect, useRef } from 'react'
import '@primr/components/dist/style.css'
import { LessonRenderer } from '@primr/components'
import type { LessonManifest } from '@primr/components'
import styles from '../learn/course/[id]/CoursePlayer.module.css'

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
  courseTitle: string
  userRole: string
  tree: CourseSectionData[]
}

function defaultHomeHref(role: string): string {
  if (role === 'creator' || role === 'lnd_manager' || role === 'org_admin') return '/creator'
  return '/my-primr'
}

export default function DocsPlayer({ courseTitle, userRole, tree }: Props) {
  const flatLessons = tree.flatMap(s =>
    s.chapters.flatMap(c =>
      c.lessons.map(l => ({ ...l, sectionTitle: s.title, chapterTitle: c.title }))
    )
  )

  const firstReady = flatLessons.find(l => l.generationStatus === 'done' && l.manifest)
  const [currentLesson, setCurrentLesson] = useState(firstReady ?? null)

  const storageKey = 'primr_docs_pos'

  // After hydration: restore saved position
  useEffect(() => {
    const savedId = localStorage.getItem(storageKey)
    if (!savedId) return
    const saved = flatLessons.find(l => l.id === savedId)
    if (saved && saved.id !== currentLesson?.id) {
      setCurrentLesson(saved) // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, []) // intentionally empty — runs once after mount

  // Persist position when lesson changes
  useEffect(() => {
    if (currentLesson?.id) {
      localStorage.setItem(storageKey, currentLesson.id)
    }
  }, [currentLesson?.id])

  function isReady(lesson: CourseLesson): boolean {
    return lesson.generationStatus === 'done' && !!lesson.manifest
  }

  function handleSelectLesson(lesson: typeof flatLessons[number]) {
    if (!isReady(lesson)) return
    setCurrentLesson(lesson)
  }

  // Scroll the active lesson button into view whenever the current lesson changes
  const activeLessonBtnRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    activeLessonBtnRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [currentLesson?.id])

  function handleLessonComplete() {
    if (!currentLesson) return
    const idx = flatLessons.findIndex(l => l.id === currentLesson.id)
    const next = flatLessons.slice(idx + 1).find(l => isReady(l))
    if (next) setCurrentLesson(next)
  }

  const exitHref = defaultHomeHref(userRole)

  return (
    <div className={styles.layout}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.sidebarTop}>
            <span className={styles.wordmark}>Primr</span>
            <a href={exitHref} className={styles.exitBtn} title="Back to dashboard">
              ← Exit
            </a>
          </div>
          <h2 className={styles.courseTitle}>{courseTitle}</h2>
        </div>

        <nav className={styles.treeNav}>
          {tree.map(section => (
            <div key={section.id} className={styles.sideSection}>
              <div className={styles.sideSectionTitle}>{section.title}</div>
              {section.chapters.map(chapter => (
                <div key={chapter.id} className={styles.sideChapter}>
                  <div className={styles.sideChapterTitle}>{chapter.title}</div>
                  {chapter.lessons.map(lesson => {
                    const full = { ...lesson, sectionTitle: section.title, chapterTitle: chapter.title }
                    const ready = isReady(lesson)
                    const isCurrent = currentLesson?.id === lesson.id

                    return (
                      <button
                        key={lesson.id}
                        ref={isCurrent ? activeLessonBtnRef : null}
                        className={[
                          styles.lessonBtn,
                          isCurrent ? styles.lessonActive : '',
                        ].join(' ')}
                        onClick={() => handleSelectLesson(full)}
                        disabled={!ready}
                        title={ready ? lesson.title : 'Still generating…'}
                      >
                        <span className={styles.lessonIcon}>
                          {!ready ? '⏳' : '○'}
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
        {currentLesson?.manifest ? (
          <div className={styles.lessonWrap}>
            <LessonRenderer
              key={currentLesson.id}
              manifest={currentLesson.manifest}
              adminMode={false}
              mode="showcase"
              examEnforced={false}
              hideAutoAdvance
              onLessonComplete={handleLessonComplete}
            />
          </div>
        ) : currentLesson?.generationStatus === 'pending' || currentLesson?.generationStatus === 'generating' ? (
          <div className={styles.notReady}>
            <div className={styles.spinner} />
            <p>This lesson is still being generated…</p>
          </div>
        ) : (
          <div className={styles.notReady}>
            <p>Select a lesson from the sidebar to begin.</p>
          </div>
        )}
      </main>
    </div>
  )
}
