'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import type { CourseTree, CourseSection, CourseChapter, CourseLesson, FlatLesson } from '@/types/course'
import styles from './CourseWizard.module.css'

// ── Wizard State ──────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4 | 5
type Status = 'idle' | 'loading' | 'error'

interface WizardState {
  step: Step
  // Step 1 inputs
  title: string
  description: string
  audience: string
  level: 'beginner' | 'intermediate' | 'advanced'
  focus: string
  // Step 3: tree + exclusions
  courseTree: CourseTree | null
  excludedLessons: Set<string>  // localIds of lessons the creator wants to skip
  // Step 4: generation
  courseId: string | null
  flatLessons: FlatLesson[]
  // UI
  status: Status
  errorMessage: string
}

const initialState: WizardState = {
  step: 1,
  title: '',
  description: '',
  audience: 'General',
  level: 'beginner',
  focus: '',
  courseTree: null,
  excludedLessons: new Set(),
  courseId: null,
  flatLessons: [],
  status: 'idle',
  errorMessage: '',
}

// ── Tree editor helpers ───────────────────────────────────────────────────────

function genId() {
  return Math.random().toString(36).slice(2, 9)
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CourseWizard() {
  const [state, setState] = useState<WizardState>(initialState)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Step 4 polling
  useEffect(() => {
    if (state.step === 4 && state.courseId) {
      const poll = async () => {
        try {
          const res = await fetch(`/api/courses/${state.courseId}/status`)
          if (!res.ok) return
          const data = await res.json()
          setState(s => ({ ...s, flatLessons: data.lessons }))

          // If all lessons are done or failed (none pending/generating), stop polling
          const allSettled = data.lessons.every(
            (l: FlatLesson) => l.generationStatus === 'done' || l.generationStatus === 'failed'
          )
          if (allSettled && data.courseStatus !== 'generating') {
            if (pollingRef.current) clearInterval(pollingRef.current)
          }
        } catch {
          // ignore poll errors
        }
      }
      poll()
      pollingRef.current = setInterval(poll, 2000)
      return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
    }
  }, [state.step, state.courseId])

  function set(updates: Partial<WizardState>) {
    setState(s => ({ ...s, ...updates }))
  }

  // ── Step 1: Upload or manual ──────────────────────────────────────────────

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    set({ status: 'loading', step: 2, errorMessage: '' })

    const formData = new FormData()
    formData.append('file', file)
    formData.append('audience', state.audience)
    formData.append('level', state.level)
    if (state.focus.trim()) formData.append('focus', state.focus.trim())

    try {
      const res = await fetch('/api/courses/parse', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        set({ status: 'error', step: 1, errorMessage: data.error || 'Failed to parse document.' })
        return
      }

      const tree: CourseTree = data.courseTree
      // Override title/description if user filled them in
      if (state.title.trim()) tree.title = state.title.trim()
      if (state.description.trim()) tree.description = state.description.trim()

      set({ status: 'idle', step: 3, courseTree: tree })
    } catch {
      set({ status: 'error', step: 1, errorMessage: 'Network error. Please try again.' })
    }
  }

  function handleManualContinue() {
    if (!state.title.trim()) return
    const tree: CourseTree = {
      title: state.title.trim(),
      description: state.description.trim(),
      sections: [{
        localId: genId(),
        title: 'General',
        inferred: false,
        chapters: [{
          localId: genId(),
          title: 'Chapter 1',
          lessons: [],
        }],
      }],
    }
    set({ step: 3, courseTree: tree })
  }

  // ── Step 3 → 4: Confirm tree and start generation ─────────────────────────

  async function handleConfirmTree() {
    if (!state.courseTree) return

    // Build tree with excluded lessons removed and focus stamped on each lesson
    const filteredTree = {
      ...state.courseTree,
      sections: state.courseTree.sections.map(s => ({
        ...s,
        chapters: s.chapters.map(c => ({
          ...c,
          lessons: c.lessons
            .filter(l => !state.excludedLessons.has(l.localId))
            .map(l => ({ ...l, focus: state.focus.trim() || l.focus })),
        })).filter(c => c.lessons.length > 0),
      })).filter(s => s.chapters.length > 0),
    }

    const lessonCount = filteredTree.sections
      .flatMap(s => s.chapters)
      .flatMap(c => c.lessons)
      .length

    if (lessonCount === 0) {
      set({ errorMessage: 'Add at least one lesson before generating.' })
      return
    }

    set({ status: 'loading', errorMessage: '' })

    try {
      // 1. Create course record
      const createRes = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: filteredTree.title,
          description: filteredTree.description,
        }),
      })
      const createData = await createRes.json()
      if (!createRes.ok) {
        set({ status: 'error', errorMessage: createData.error || 'Failed to create course.' })
        return
      }

      const courseId: string = createData.course.id

      // 2. Start generation with filtered tree
      const genRes = await fetch(`/api/courses/${courseId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tree: filteredTree }),
      })
      const genData = await genRes.json()
      if (!genRes.ok) {
        set({ status: 'error', errorMessage: genData.error || 'Failed to start generation.' })
        return
      }

      set({ status: 'idle', step: 4, courseId })
    } catch {
      set({ status: 'error', errorMessage: 'Network error. Please try again.' })
    }
  }

  // ── Step 5 navigation ─────────────────────────────────────────────────────

  function handleViewCourse() {
    set({ step: 5 })
  }

  // ── Tree editing ──────────────────────────────────────────────────────────

  function updateTree(updater: (tree: CourseTree) => CourseTree) {
    setState(s => ({
      ...s,
      courseTree: s.courseTree ? updater(s.courseTree) : s.courseTree,
    }))
  }

  function updateSectionTitle(sectionLocalId: string, title: string) {
    updateTree(tree => ({
      ...tree,
      sections: tree.sections.map(s => s.localId === sectionLocalId ? { ...s, title } : s),
    }))
  }

  function deleteSection(sectionLocalId: string) {
    updateTree(tree => ({
      ...tree,
      sections: tree.sections.filter(s => s.localId !== sectionLocalId),
    }))
  }

  function addSection() {
    updateTree(tree => ({
      ...tree,
      sections: [...tree.sections, {
        localId: genId(),
        title: 'New Section',
        inferred: false,
        chapters: [{ localId: genId(), title: 'Chapter 1', lessons: [] }],
      }],
    }))
  }

  function updateChapterTitle(sectionLocalId: string, chapterLocalId: string, title: string) {
    updateTree(tree => ({
      ...tree,
      sections: tree.sections.map(s => s.localId !== sectionLocalId ? s : {
        ...s,
        chapters: s.chapters.map(c => c.localId === chapterLocalId ? { ...c, title } : c),
      }),
    }))
  }

  function deleteChapter(sectionLocalId: string, chapterLocalId: string) {
    updateTree(tree => ({
      ...tree,
      sections: tree.sections.map(s => s.localId !== sectionLocalId ? s : {
        ...s,
        chapters: s.chapters.filter(c => c.localId !== chapterLocalId),
      }),
    }))
  }

  function addChapter(sectionLocalId: string) {
    updateTree(tree => ({
      ...tree,
      sections: tree.sections.map(s => s.localId !== sectionLocalId ? s : {
        ...s,
        chapters: [...s.chapters, { localId: genId(), title: 'New Chapter', lessons: [] }],
      }),
    }))
  }

  function updateLessonTitle(sectionLocalId: string, chapterLocalId: string, lessonLocalId: string, title: string) {
    updateTree(tree => ({
      ...tree,
      sections: tree.sections.map(s => s.localId !== sectionLocalId ? s : {
        ...s,
        chapters: s.chapters.map(c => c.localId !== chapterLocalId ? c : {
          ...c,
          lessons: c.lessons.map(l => l.localId === lessonLocalId ? { ...l, title } : l),
        }),
      }),
    }))
  }

  function deleteLesson(sectionLocalId: string, chapterLocalId: string, lessonLocalId: string) {
    updateTree(tree => ({
      ...tree,
      sections: tree.sections.map(s => s.localId !== sectionLocalId ? s : {
        ...s,
        chapters: s.chapters.map(c => c.localId !== chapterLocalId ? c : {
          ...c,
          lessons: c.lessons.filter(l => l.localId !== lessonLocalId),
        }),
      }),
    }))
  }

  function addLesson(sectionLocalId: string, chapterLocalId: string) {
    updateTree(tree => ({
      ...tree,
      sections: tree.sections.map(s => s.localId !== sectionLocalId ? s : {
        ...s,
        chapters: s.chapters.map(c => c.localId !== chapterLocalId ? c : {
          ...c,
          lessons: [...c.lessons, {
            localId: genId(),
            title: 'New Lesson',
            audience: state.audience,
            level: state.level,
          }],
        }),
      }),
    }))
  }

  async function handleRetry(chapterLessonId: string) {
    if (!state.courseId) return
    await fetch(`/api/courses/${state.courseId}/retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapterLessonIds: [chapterLessonId] }),
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const totalLessons = state.courseTree
    ? state.courseTree.sections.flatMap(s => s.chapters).flatMap(c => c.lessons).length
    : 0

  const includedLessons = totalLessons - state.excludedLessons.size

  const doneLessons = state.flatLessons.filter(l => l.generationStatus === 'done').length
  const failedLessons = state.flatLessons.filter(l => l.generationStatus === 'failed').length
  const allSettled = state.flatLessons.length > 0 &&
    state.flatLessons.every(l => l.generationStatus === 'done' || l.generationStatus === 'failed')

  return (
    <div className={styles.wrapper}>
      <nav className={styles.nav}>
        <Link href="/creator" className={styles.wordmark}>Primr</Link>
        <span className={styles.navTitle}>New Course</span>
      </nav>

      <div className={styles.content}>
        {/* Step indicator */}
        <div className={styles.steps}>
          {(['Upload', 'Analyzing', 'Review', 'Generating', 'Done'] as const).map((label, i) => (
            <div key={label} className={`${styles.stepDot} ${state.step === i + 1 ? styles.stepActive : ''} ${state.step > i + 1 ? styles.stepDone : ''}`}>
              <span>{i + 1}</span>
            </div>
          ))}
        </div>

        {/* ── Step 1: Upload ── */}
        {state.step === 1 && (
          <div className={styles.card}>
            <h1 className={styles.heading}>Create a course</h1>
            <p className={styles.subheading}>Upload a document to auto-generate the course structure, or fill in the details manually.</p>

            {state.errorMessage && <div className={styles.error}>{state.errorMessage}</div>}

            <div className={styles.formGroup}>
              <label className={styles.label}>Course title</label>
              <input
                className={styles.input}
                value={state.title}
                onChange={e => set({ title: e.target.value })}
                placeholder="e.g. Introduction to Cybersecurity"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Description <span className={styles.optional}>(optional)</span></label>
              <textarea
                className={styles.textarea}
                value={state.description}
                onChange={e => set({ description: e.target.value })}
                placeholder="What will learners get from this course?"
                rows={3}
              />
            </div>

            <div className={styles.row}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Audience</label>
                <input
                  className={styles.input}
                  value={state.audience}
                  onChange={e => set({ audience: e.target.value })}
                  placeholder="e.g. IT professionals"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Level</label>
                <select
                  className={styles.select}
                  value={state.level}
                  onChange={e => set({ level: e.target.value as WizardState['level'] })}
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>
                Scope / Focus <span className={styles.optional}>(optional)</span>
              </label>
              <input
                className={styles.input}
                value={state.focus}
                onChange={e => set({ focus: e.target.value })}
                placeholder="e.g. Class C passenger vehicles only, not commercial or motorcycle"
              />
              <p className={styles.fieldHint}>Narrows what Claude covers when structuring and generating lessons.</p>
            </div>

            <div className={styles.uploadSection}>
              <label className={styles.uploadLabel}>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,.md"
                  className={styles.fileInput}
                  onChange={handleFileUpload}
                />
                <div className={styles.uploadBox}>
                  <span className={styles.uploadIcon}>📄</span>
                  <span className={styles.uploadText}>Upload document to auto-generate structure</span>
                  <span className={styles.uploadHint}>PDF, DOCX, TXT, or MD</span>
                </div>
              </label>
            </div>

            <div className={styles.divider}>
              <span>or</span>
            </div>

            <button
              className={styles.secondaryBtn}
              onClick={handleManualContinue}
              disabled={!state.title.trim()}
            >
              Continue without document →
            </button>
          </div>
        )}

        {/* ── Step 2: Analyzing ── */}
        {state.step === 2 && (
          <div className={styles.card}>
            <div className={styles.loadingCenter}>
              <div className={styles.spinner} />
              <h2 className={styles.loadingTitle}>Analyzing document structure…</h2>
              <p className={styles.loadingHint}>This takes about 30 seconds for large documents.</p>
            </div>
          </div>
        )}

        {/* ── Step 3: Tree editor ── */}
        {state.step === 3 && state.courseTree && (
          <div className={styles.card}>
            <div className={styles.treeHeader}>
              <div>
                <h1 className={styles.heading}>Review course structure</h1>
                <p className={styles.subheading}>
                  {includedLessons} of {totalLessons} lessons selected across {state.courseTree.sections.length} sections.
                  Uncheck lessons to exclude them, rename or delete nodes, then generate.
                </p>
              </div>
            </div>

            {state.errorMessage && <div className={styles.error}>{state.errorMessage}</div>}

            {/* Course title */}
            <div className={styles.formGroup}>
              <label className={styles.label}>Course title</label>
              <input
                className={styles.input}
                value={state.courseTree.title}
                onChange={e => updateTree(t => ({ ...t, title: e.target.value }))}
              />
            </div>

            {/* Tree */}
            <div className={styles.tree}>
              {state.courseTree.sections.map(section => (
                <div key={section.localId} className={styles.sectionNode}>
                  <div className={styles.sectionRow}>
                    <span className={styles.nodeIcon}>▸</span>
                    <input
                      className={styles.nodeInput}
                      value={section.title}
                      onChange={e => updateSectionTitle(section.localId, e.target.value)}
                    />
                    {section.inferred && <span className={styles.inferredBadge}>inferred</span>}
                    <button className={styles.deleteBtn} onClick={() => deleteSection(section.localId)} title="Delete section">✕</button>
                  </div>

                  {section.chapters.map(chapter => (
                    <div key={chapter.localId} className={styles.chapterNode}>
                      <div className={styles.chapterRow}>
                        <span className={styles.nodeIcon}>▹</span>
                        <input
                          className={styles.nodeInput}
                          value={chapter.title}
                          onChange={e => updateChapterTitle(section.localId, chapter.localId, e.target.value)}
                        />
                        <button className={styles.deleteBtn} onClick={() => deleteChapter(section.localId, chapter.localId)} title="Delete chapter">✕</button>
                      </div>

                      {chapter.lessons.map(lesson => {
                        const excluded = state.excludedLessons.has(lesson.localId)
                        return (
                          <div key={lesson.localId} className={`${styles.lessonNode} ${excluded ? styles.lessonNodeExcluded : ''}`}>
                            <input
                              type="checkbox"
                              className={styles.lessonCheck}
                              checked={!excluded}
                              onChange={() => setState(s => {
                                const next = new Set(s.excludedLessons)
                                excluded ? next.delete(lesson.localId) : next.add(lesson.localId)
                                return { ...s, excludedLessons: next }
                              })}
                              title={excluded ? 'Include this lesson' : 'Exclude this lesson'}
                            />
                            <input
                              className={styles.nodeInput}
                              value={lesson.title}
                              onChange={e => updateLessonTitle(section.localId, chapter.localId, lesson.localId, e.target.value)}
                              disabled={excluded}
                            />
                            {lesson.sourceText && !excluded && (
                              <span className={styles.snippetBadge} title={lesson.sourceText.slice(0, 200)}>has text</span>
                            )}
                            <button className={styles.deleteBtn} onClick={() => deleteLesson(section.localId, chapter.localId, lesson.localId)} title="Delete lesson">✕</button>
                          </div>
                        )
                      })}

                      <button className={styles.addBtn} onClick={() => addLesson(section.localId, chapter.localId)}>
                        + lesson
                      </button>
                    </div>
                  ))}

                  <button className={styles.addBtn} onClick={() => addChapter(section.localId)}>
                    + chapter
                  </button>
                </div>
              ))}

              <button className={styles.addSectionBtn} onClick={addSection}>
                + Add section
              </button>
            </div>

            <div className={styles.actions}>
              <button className={styles.secondaryBtn} onClick={() => set({ step: 1 })}>← Back</button>
              <button
                className={styles.primaryBtn}
                onClick={handleConfirmTree}
                disabled={state.status === 'loading' || includedLessons === 0}
              >
                {state.status === 'loading' ? 'Starting…' : `Generate ${includedLessons} lesson${includedLessons !== 1 ? 's' : ''} →`}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Generation progress ── */}
        {state.step === 4 && (
          <div className={styles.card}>
            <h1 className={styles.heading}>Generating lessons…</h1>
            <p className={styles.subheading}>
              {doneLessons}/{state.flatLessons.length} complete
              {failedLessons > 0 && ` · ${failedLessons} failed`}
            </p>

            <div className={styles.progressList}>
              {state.flatLessons.map(lesson => (
                <div key={lesson.chapterLessonId} className={styles.progressRow}>
                  <div className={styles.progressMeta}>
                    <span className={styles.progressSection}>{lesson.sectionTitle} › {lesson.chapterTitle}</span>
                    <span className={styles.progressTitle}>{lesson.title}</span>
                  </div>
                  <div className={styles.progressStatus}>
                    {lesson.generationStatus === 'done' && <span className={styles.statusDone}>✓</span>}
                    {lesson.generationStatus === 'generating' && <span className={styles.statusGenerating}><span className={styles.pulse} /></span>}
                    {lesson.generationStatus === 'pending' && <span className={styles.statusPending}>—</span>}
                    {lesson.generationStatus === 'failed' && (
                      <>
                        <span className={styles.statusFailed}>✗</span>
                        <button className={styles.retryBtn} onClick={() => handleRetry(lesson.chapterLessonId)}>Retry</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {allSettled && (
              <div className={styles.actions}>
                <button className={styles.primaryBtn} onClick={handleViewCourse}>
                  View course →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Step 5: Done ── */}
        {state.step === 5 && state.courseId && (
          <div className={styles.card}>
            <div className={styles.doneHeader}>
              <span className={styles.doneIcon}>🎉</span>
              <h1 className={styles.heading}>Course ready!</h1>
              <p className={styles.subheading}>
                {doneLessons} lessons generated.
                {failedLessons > 0 && ` ${failedLessons} failed — go back to retry.`}
              </p>
            </div>

            <div className={styles.doneActions}>
              <Link href={`/learn/course/${state.courseId}`} className={styles.primaryBtn}>
                Preview course
              </Link>
              <Link href="/creator" className={styles.secondaryBtn}>
                Go to dashboard
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
