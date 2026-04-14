'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import type { LessonManifest } from '@/types/outline'
import type { FullCourseTree } from '@/types/course'
import LessonBlockEditor from '../../../components/LessonBlockEditor'
import { ShellHeaderSlots } from '../../../../../components/shell/ShellHeaderSlots'
import { canUsePexels, canAiEdit as canAiEditFn } from '@/lib/models'
import { PricingSection } from './PricingSection'
import { ThemeSection } from './ThemeSection'

import styles from './CourseEditClient.module.css'

type LessonStatus = { generationStatus: string; lessonId: string | null }

function initStatuses(course: FullCourseTree): Map<string, LessonStatus> {
  const map = new Map<string, LessonStatus>()
  for (const section of course.sections)
    for (const chapter of section.chapters)
      for (const cl of chapter.lessons)
        map.set(cl.id, { generationStatus: cl.generationStatus, lessonId: cl.lessonId })
  return map
}

function initDisabled(course: FullCourseTree): Set<string> {
  const s = new Set<string>()
  for (const section of course.sections)
    for (const chapter of section.chapters)
      for (const cl of chapter.lessons)
        if (cl.isDisabled) s.add(cl.id)
  return s
}

type StatusIcon = { label: string; cls: string }
function statusIcon(status: string): StatusIcon {
  switch (status) {
    case 'done': return { label: '✓', cls: styles.statusDone }
    case 'failed': return { label: '✗', cls: styles.statusFailed }
    case 'generating': return { label: '⟳', cls: styles.statusGenerating }
    case 'retrying': return { label: '⟳', cls: styles.statusRetrying }
    default: return { label: '·', cls: styles.statusPending }
  }
}

export default function CourseEditClient({ course, plan, internalRole }: { course: FullCourseTree; plan: string; internalRole: string | null }) {
  const canPexels = canUsePexels(plan, internalRole)
  const aiEditEnabled = canAiEditFn(plan, internalRole)
  const isInternal = internalRole != null
  // ── Course title editing ───────────────────────────────────────────────────
  const [courseTitle, setCourseTitle] = useState(course.title)

  async function saveCourseTitle(title: string) {
    const trimmed = title.trim()
    if (!trimmed || trimmed === course.title) return
    await fetch(`/api/courses/${course.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: trimmed }),
    })
  }

  // ── Sidebar state ──────────────────────────────────────────────────────────
  const [outlineCollapsed, setOutlineCollapsed] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const [collapsedChapters, setCollapsedChapters] = useState<Set<string>>(new Set())
  const [disabledLessons, setDisabledLessons] = useState<Set<string>>(() => initDisabled(course))

  // ── Live lesson statuses (updated by polling) ──────────────────────────────
  const [lessonStatuses, setLessonStatuses] = useState<Map<string, LessonStatus>>(() => initStatuses(course))
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Selected lesson ────────────────────────────────────────────────────────
  const [selectedClId, setSelectedClId] = useState<string | null>(null)
  const [lessonId, setLessonId] = useState<string | null>(null)
  const [manifest, setManifest] = useState<LessonManifest | null>(null)
  const [loadingLesson, setLoadingLesson] = useState(false)
  const [loadError, setLoadError] = useState('')

  // ── Polling ────────────────────────────────────────────────────────────────
  const selectedClIdRef = useRef(selectedClId)
  selectedClIdRef.current = selectedClId

  function startPolling() {
    if (pollingRef.current) return
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/courses/${course.id}/status`)
        if (!res.ok) return
        const data = await res.json()
        const next = new Map<string, LessonStatus>()
        for (const l of data.lessons)
          next.set(l.chapterLessonId, { generationStatus: l.generationStatus, lessonId: l.lessonId })

        setLessonStatuses(prev => {
          const sel = selectedClIdRef.current
          if (sel) {
            const was = prev.get(sel)
            const now = next.get(sel)
            if (was?.generationStatus !== 'done' && now?.generationStatus === 'done' && now.lessonId) {
              loadLesson(sel, now.lessonId)
            }
          }
          return next
        })

        const anyActive = data.lessons.some(
          (l: { generationStatus: string }) => l.generationStatus === 'generating' || l.generationStatus === 'pending' || l.generationStatus === 'retrying'
        )
        if (!anyActive && pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
        }
      } catch { /* ignore */ }
    }, 2500)
  }

  useEffect(() => {
    const hasActive = [...lessonStatuses.values()].some(
      s => s.generationStatus === 'generating' || s.generationStatus === 'pending' || s.generationStatus === 'retrying'
    )
    if (hasActive) startPolling()
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Auto-select first done lesson ──────────────────────────────────────────
  useEffect(() => {
    for (const section of course.sections) {
      for (const chapter of section.chapters) {
        const cl = chapter.lessons.find(l => {
          const s = lessonStatuses.get(l.id)
          return s?.generationStatus === 'done' && s.lessonId
        })
        if (cl) {
          const s = lessonStatuses.get(cl.id)!
          loadLesson(cl.id, s.lessonId!)
          return
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadLesson(clId: string, lId: string) {
    if (selectedClIdRef.current === clId && manifest) return
    setSelectedClId(clId)
    setLessonId(lId)
    setManifest(null)
    setLoadError('')
    setLoadingLesson(true)
    try {
      const res = await fetch(`/api/lessons/${lId}`)
      if (!res.ok) throw new Error('Failed to load lesson')
      const data = await res.json()
      setManifest(data.manifest)
    } catch {
      setLoadError('Failed to load lesson.')
    } finally {
      setLoadingLesson(false)
    }
  }

  async function retryLesson(clId: string) {
    setLessonStatuses(prev => {
      const next = new Map(prev)
      next.set(clId, { generationStatus: 'generating', lessonId: null })
      return next
    })
    if (selectedClId === clId) {
      setManifest(null)
      setLoadError('')
      setLessonId(null)
    }
    await fetch(`/api/courses/${course.id}/retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapterLessonIds: [clId] }),
    })
    startPolling()
  }

  async function retryAllFailed() {
    const failedIds: string[] = []
    for (const [clId, status] of lessonStatuses) {
      if (status.generationStatus === 'failed') failedIds.push(clId)
    }
    if (failedIds.length === 0) return
    setLessonStatuses(prev => {
      const next = new Map(prev)
      for (const clId of failedIds)
        next.set(clId, { generationStatus: 'generating', lessonId: null })
      return next
    })
    if (selectedClId && failedIds.includes(selectedClId)) {
      setManifest(null)
      setLoadError('')
      setLessonId(null)
    }
    await fetch(`/api/courses/${course.id}/retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapterLessonIds: failedIds }),
    })
    startPolling()
  }

  async function toggleDisabled(clId: string) {
    const next = !disabledLessons.has(clId)
    setDisabledLessons(prev => {
      const s = new Set(prev)
      next ? s.add(clId) : s.delete(clId)
      return s
    })
    await fetch(`/api/courses/${course.id}/lessons/${clId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDisabled: next }),
    })
  }

  // ── Nav breadcrumb ─────────────────────────────────────────────────────────
  let selectedLessonTitle = ''
  for (const section of course.sections) {
    for (const chapter of section.chapters) {
      const cl = chapter.lessons.find(l => l.id === selectedClId)
      if (cl) { selectedLessonTitle = cl.title; break }
    }
    if (selectedLessonTitle) break
  }

  return (
    <div className={styles.root}>
      <ShellHeaderSlots
        left={
          <>
            <input
              className={styles.navTitleInput}
              value={courseTitle}
              onChange={e => setCourseTitle(e.target.value)}
              onBlur={e => saveCourseTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
              aria-label="Course title"
            />
            {selectedLessonTitle && (
              <>
                <span className={styles.navCrumbSep}>›</span>
                <span className={styles.navCrumbLesson}>{selectedLessonTitle}</span>
              </>
            )}
          </>
        }
        right={
          lessonId ? (
            <Link href={`/learn/${lessonId}`} className={styles.navLink}>Take lesson →</Link>
          ) : undefined
        }
      />

      {/* ── Main layout ── */}
      <div className={styles.layout}>
        {/* ── Left sidebar ── */}
        <aside className={`${styles.sidebar} ${outlineCollapsed ? styles.sidebarCollapsed : ''}`}>
          <div className={`${styles.sidebarHeader} ${outlineCollapsed ? styles.sidebarHeaderCollapsed : ''}`}>
            {!outlineCollapsed && (() => {
              const statuses = [...lessonStatuses.values()]
              const total = statuses.length
              const done = statuses.filter(s => s.generationStatus === 'done').length
              const failedCount = statuses.filter(s => s.generationStatus === 'failed').length
              const generating = statuses.some(s => s.generationStatus === 'generating' || s.generationStatus === 'pending' || s.generationStatus === 'retrying')
              return (
                <>
                  {(generating || done !== total) && (
                    <span className={`${styles.progressPill} ${generating ? styles.progressPillActive : ''}`}>
                      {done}/{total}
                    </span>
                  )}
                  {failedCount > 1 && !generating && (
                    <button className={styles.retryAllBtn} onClick={retryAllFailed}>
                      ↺ Retry all ({failedCount})
                    </button>
                  )}
                </>
              )
            })()}
            <button
              className={styles.sidebarCollapseBtn}
              onClick={() => setOutlineCollapsed(v => !v)}
              title={outlineCollapsed ? 'Expand outline' : 'Collapse outline'}
            >
              {outlineCollapsed ? '▶' : '◀'}
            </button>
          </div>
          {!outlineCollapsed && <PricingSection
            courseId={course.id}
            initialPriceCents={course.priceCents}
            initialIsPaid={course.isPaid}
          />}
          {!outlineCollapsed && <ThemeSection courseId={course.id} currentTheme={course.theme} />}
          {!outlineCollapsed && <div className={styles.sidebarBody}>
            {course.sections.map(section => {
              const sectionCollapsed = collapsedSections.has(section.id)
              return (
                <div key={section.id} className={styles.sectionGroup}>
                  <button
                    className={styles.sectionToggle}
                    onClick={() => setCollapsedSections(prev => {
                      const next = new Set(prev)
                      next.has(section.id) ? next.delete(section.id) : next.add(section.id)
                      return next
                    })}
                  >
                    <span className={`${styles.chevron} ${sectionCollapsed ? styles.chevronCollapsed : ''}`}>▾</span>
                    <span className={styles.sectionLabel}>{section.title}</span>
                  </button>

                  {!sectionCollapsed && section.chapters.map(chapter => {
                    const chapCollapsed = collapsedChapters.has(chapter.id)
                    return (
                      <div key={chapter.id} className={styles.chapterGroup}>
                        <button
                          className={styles.chapterToggle}
                          onClick={() => setCollapsedChapters(prev => {
                            const next = new Set(prev)
                            next.has(chapter.id) ? next.delete(chapter.id) : next.add(chapter.id)
                            return next
                          })}
                        >
                          <span className={`${styles.chevron} ${chapCollapsed ? styles.chevronCollapsed : ''}`}>▾</span>
                          <span className={styles.chapterLabel}>{chapter.title}</span>
                        </button>

                        {!chapCollapsed && chapter.lessons.map(cl => {
                          const status = lessonStatuses.get(cl.id) ?? { generationStatus: cl.generationStatus, lessonId: cl.lessonId }
                          const icon = statusIcon(status.generationStatus)
                          const isSelected = cl.id === selectedClId
                          const canEdit = status.generationStatus === 'done' && status.lessonId
                          const isFailed = status.generationStatus === 'failed'
                          const isInProgress = status.generationStatus === 'generating' || status.generationStatus === 'retrying' || status.generationStatus === 'pending'
                          const isOff = disabledLessons.has(cl.id)

                          return (
                            <div
                              key={cl.id}
                              className={`${styles.lessonRow} ${isSelected ? styles.lessonRowActive : ''} ${!canEdit && !isFailed && !isInProgress ? styles.lessonRowDisabled : ''} ${isOff ? styles.lessonRowOff : ''}`}
                            >
                              <span className={`${styles.statusMark} ${icon.cls}`}>{icon.label}</span>
                              <button
                                className={styles.lessonBtn}
                                onClick={() => canEdit && loadLesson(cl.id, status.lessonId!)}
                                disabled={!canEdit}
                                title={cl.title}
                              >
                                {cl.title}
                              </button>
                              {isFailed && (
                                <button
                                  className={styles.retryBtn}
                                  onClick={() => retryLesson(cl.id)}
                                  title="Retry generation"
                                >
                                  ↺ Retry
                                </button>
                              )}
                              <button
                                className={styles.disableBtn}
                                onClick={() => toggleDisabled(cl.id)}
                                title={isOff ? 'Enable lesson (learners can see it)' : 'Disable lesson (hide from learners)'}
                              >
                                {isOff ? '○' : '●'}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>}
        </aside>

        {/* ── Center + right: lesson editor ── */}
        {loadingLesson && (
          <div className={styles.editorArea}>
            <div className={styles.centerState}>
              <div className={styles.spinner} />
              <p className={styles.centerStateText}>Loading lesson…</p>
            </div>
          </div>
        )}
        {!loadingLesson && loadError && (
          <div className={styles.editorArea}>
            <div className={styles.centerState}>
              <p className={styles.centerStateText}>{loadError}</p>
            </div>
          </div>
        )}
        {!loadingLesson && !manifest && !loadError && (() => {
          const selStatus = selectedClId ? lessonStatuses.get(selectedClId) : null
          const isFailed = selStatus?.generationStatus === 'failed'
          const isRetrying = selStatus?.generationStatus === 'retrying'
          const isGenerating = selStatus?.generationStatus === 'generating' || selStatus?.generationStatus === 'pending' || isRetrying
          return (
            <div className={styles.editorArea}>
              <div className={styles.centerState}>
                {isFailed && (
                  <>
                    <p className={styles.centerStateText}>This lesson failed to generate.</p>
                    <button
                      className={styles.centerRetryBtn}
                      onClick={() => selectedClId && retryLesson(selectedClId)}
                    >
                      ↺ Retry generation
                    </button>
                  </>
                )}
                {isGenerating && (
                  <>
                    <div className={styles.spinner} />
                    <p className={styles.centerStateText}>Generating…</p>
                  </>
                )}
                {!isFailed && !isGenerating && (
                  <p className={styles.centerStateText}>Select a lesson from the outline to start editing.</p>
                )}
              </div>
            </div>
          )
        })()}
        {manifest && !loadingLesson && (
          <LessonBlockEditor
            key={selectedClId ?? ''}
            lessonId={lessonId!}
            initialManifest={manifest}
            panelMode="dock"
            paginatorLeft={240}
            canPexels={canPexels}
            canAiEdit={aiEditEnabled}
            plan={plan}
            isInternal={isInternal}
          />
        )}
      </div>
    </div>
  )
}
