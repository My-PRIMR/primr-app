'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import type { CourseTree, CourseSection, CourseChapter, CourseLesson, FlatLesson } from '@/types/course'
import styles from './CourseWizard.module.css'
import { DEFAULT_MODEL, MODELS, canSelectModels, canSelectOpus } from '@/lib/models'

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
  videoUrl: string
  stagedFiles: File[]
  structureSource: 'document' | 'video'
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
  videoUrl: '',
  stagedFiles: [],
  structureSource: 'document',
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

interface CourseWizardProps {
  internalRole: string | null
  productRole: string | null
}

export default function CourseWizard({ internalRole, productRole }: CourseWizardProps) {
  const [state, setState] = useState<WizardState>(initialState)
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL)
  const [passiveLesson, setPassiveLesson] = useState(false)
  const [skipHero, setSkipHero] = useState(false)
  const [includeImages, setIncludeImages] = useState(false)
  const [notifyEmail, setNotifyEmail] = useState(true)
  const [isPasting, setIsPasting] = useState(false)
  const [pastedText, setPastedText] = useState('')
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

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    set({ stagedFiles: [...state.stagedFiles, ...picked].slice(0, 5), errorMessage: '' })
    e.target.value = ''
  }

  function removeFile(idx: number) {
    set({ stagedFiles: state.stagedFiles.filter((_, i) => i !== idx) })
  }

  const hasSources = state.stagedFiles.length > 0 || state.videoUrl.trim().length > 0 || (isPasting && pastedText.trim().length > 0)

  async function handleAnalyzeSources() {
    if (!hasSources) return

    set({ status: 'loading', step: 2, errorMessage: '' })

    const formData = new FormData()
    if (isPasting) {
      formData.append('text', pastedText.trim())
    } else {
      for (const f of state.stagedFiles) formData.append('file', f)
    }
    if (state.videoUrl.trim()) formData.append('videoUrl', state.videoUrl.trim())
    formData.append('audience', state.audience)
    formData.append('level', state.level)
    if (state.focus.trim()) formData.append('focus', state.focus.trim())
    formData.append('structureSource', state.structureSource)
    formData.append('model', selectedModel)

    try {
      const res = await fetch('/api/courses/parse', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        set({ status: 'error', step: 1, errorMessage: data.error || 'Failed to analyze sources.' })
        return
      }

      const tree: CourseTree = data.courseTree
      if (state.title.trim()) tree.title = state.title.trim()
      if (state.description.trim()) tree.description = state.description.trim()

      set({ status: 'idle', step: 3, courseTree: tree, stagedFiles: [], videoUrl: '' })
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
        body: JSON.stringify({ tree: filteredTree, model: selectedModel, passiveLesson, skipHero, notifyEmail, includeImages }),
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

  function toggleSection(section: CourseTree['sections'][number], include: boolean) {
    const lessonIds = section.chapters.flatMap(c => c.lessons.map(l => l.localId))
    setState(s => {
      const next = new Set(s.excludedLessons)
      for (const id of lessonIds) include ? next.delete(id) : next.add(id)
      return { ...s, excludedLessons: next }
    })
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
          {(['Sources', 'Analyzing', 'Review', 'Generating', 'Done'] as const).map((label, i) => (
            <div key={label} className={`${styles.stepDot} ${state.step === i + 1 ? styles.stepActive : ''} ${state.step > i + 1 ? styles.stepDone : ''}`}>
              <span>{i + 1}</span>
            </div>
          ))}
        </div>

        {/* ── Step 1: Upload ── */}
        {state.step === 1 && (
          <div className={styles.card}>
            <h1 className={styles.heading}>Create a course</h1>

            <p className={styles.subheading}>Upload documents or add a YouTube video — we'll extract the content and generate the course structure for you to review.</p>

            {state.errorMessage && <div className={styles.error}>{state.errorMessage}</div>}

            {/* ── Documents (primary) ── */}
            <div className={styles.formGroup}>
              <label className={styles.label}>Documents <span className={styles.optional}>(optional, up to 5)</span></label>

              {!isPasting ? (
                <>
                  {state.stagedFiles.length > 0 && (
                    <div className={styles.fileList}>
                      {state.stagedFiles.map((f, i) => (
                        <div key={i} className={styles.fileRow}>
                          <span className={styles.fileName}>📎 {f.name}</span>
                          <button type="button" className={styles.deleteBtn} onClick={() => removeFile(i)}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {state.stagedFiles.length < 5 && (
                    <label className={styles.uploadBtn}>
                      {state.stagedFiles.length === 0 ? 'Choose file(s)' : 'Add another file'}
                      <input
                        type="file"
                        accept=".pdf,.docx,.txt,.md"
                        multiple
                        className={styles.fileInput}
                        onChange={handleFilePick}
                      />
                    </label>
                  )}
                  <button
                    type="button"
                    className={styles.pasteToggle}
                    onClick={() => { set({ stagedFiles: [] }); setIsPasting(true) }}
                  >
                    Or paste text instead →
                  </button>
                  <p className={styles.fieldHint}>PDF, DOCX, TXT, or MD. Combined with video transcript as source material.</p>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className={styles.pasteToggle}
                    onClick={() => { setIsPasting(false); setPastedText('') }}
                  >
                    ← Back to file upload
                  </button>
                  <textarea
                    className={`${styles.textarea} ${styles.pasteTextarea}`}
                    placeholder="Paste your content here — article, notes, training material..."
                    value={pastedText}
                    onChange={e => setPastedText(e.target.value)}
                  />
                </>
              )}
            </div>

            {/* ── YouTube URL ── */}
            <div className={styles.formGroup}>
              <label className={styles.label}>YouTube URL <span className={styles.optional}>(optional)</span></label>
              <input
                className={styles.input}
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={state.videoUrl}
                onChange={e => set({ videoUrl: e.target.value, errorMessage: '' })}
              />
            </div>

            {/* ── Structure source toggle ── */}
            {(state.stagedFiles.length > 0 || (isPasting && pastedText.trim().length > 0)) && state.videoUrl.trim() && (
              <div className={styles.formGroup}>
                <label className={styles.label}>Course structure source</label>
                <div className={styles.structureToggle}>
                  <label className={`${styles.structureOption} ${state.structureSource === 'document' ? styles.structureOptionActive : ''}`}>
                    <input
                      type="radio"
                      name="structureSource"
                      value="document"
                      checked={state.structureSource === 'document'}
                      onChange={() => set({ structureSource: 'document' })}
                      className={styles.srOnly}
                    />
                    <span className={styles.structureOptionTitle}>Document</span>
                    <span className={styles.structureOptionHint}>Structure from doc · video clips as supplements</span>
                  </label>
                  <label className={`${styles.structureOption} ${state.structureSource === 'video' ? styles.structureOptionActive : ''}`}>
                    <input
                      type="radio"
                      name="structureSource"
                      value="video"
                      checked={state.structureSource === 'video'}
                      onChange={() => set({ structureSource: 'video' })}
                      className={styles.srOnly}
                    />
                    <span className={styles.structureOptionTitle}>Video</span>
                    <span className={styles.structureOptionHint}>Structure from chapters · doc text as supplements</span>
                  </label>
                </div>
              </div>
            )}

            {/* ── Title ── */}
            <div className={styles.formGroup}>
              <label className={styles.label}>
                Course title{hasSources && <span className={styles.optional}> (optional — inferred from sources if blank)</span>}
              </label>
              <input
                className={styles.input}
                value={state.title}
                onChange={e => set({ title: e.target.value })}
                placeholder="e.g. Introduction to Cybersecurity"
              />
            </div>

            {/* ── Description ── */}
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

            {/* ── Audience + Level ── */}
            <div className={styles.row}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Audience <span className={styles.optional}>(optional)</span></label>
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

            {/* ── Scope / Focus ── */}
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

            {/* ── Options ── */}
            <div className={styles.formGroup} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={notifyEmail}
                  onChange={e => setNotifyEmail(e.target.checked)}
                  className={styles.checkbox}
                />
                Email me when course generation finishes
              </label>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={skipHero}
                  onChange={e => setSkipHero(e.target.checked)}
                  className={styles.checkbox}
                />
                Skip hero block in each lesson
              </label>
            </div>

            {canSelectModels(internalRole, productRole) && (
              <div className={styles.internalControls}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Model</label>
                  <select
                    className={styles.select}
                    value={selectedModel}
                    onChange={e => setSelectedModel(e.target.value)}
                  >
                    <option value={MODELS.haiku.id}>Haiku (fast)</option>
                    <option value={MODELS.sonnet.id}>Sonnet (better)</option>
                    {canSelectOpus(internalRole, productRole) && (
                      <option value={MODELS.opus.id}>Opus (best)</option>
                    )}
                  </select>
                </div>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={passiveLesson}
                    onChange={e => setPassiveLesson(e.target.checked)}
                    className={styles.checkbox}
                  />
                  Informational only (no interactive content)
                </label>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={includeImages}
                    onChange={e => setIncludeImages(e.target.checked)}
                    className={styles.checkbox}
                  />
                  Include images (Pexels)
                </label>
              </div>
            )}

            {hasSources ? (
              <div className={styles.actions}>
                <button
                  className={styles.primaryBtn}
                  onClick={handleAnalyzeSources}
                  disabled={state.status === 'loading'}
                >
                  Analyze sources →
                </button>
              </div>
            ) : (
              <>
                <div className={styles.divider}><span>or</span></div>
                <button
                  className={styles.secondaryBtn}
                  onClick={handleManualContinue}
                  disabled={!state.title.trim()}
                >
                  Continue without sources →
                </button>
              </>
            )}
          </div>
        )}

        {/* ── Step 2: Analyzing ── */}
        {state.step === 2 && (
          <div className={styles.card}>
            <div className={styles.loadingCenter}>
              <div className={styles.spinner} />
              <h2 className={styles.loadingTitle}>Analyzing sources…</h2>
              <p className={styles.loadingHint}>Extracting content and generating course structure. This may take up to a minute for video.</p>
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
              {state.courseTree.sections.map(section => {
                const sectionLessonIds = section.chapters.flatMap(c => c.lessons.map(l => l.localId))
                const excludedInSection = sectionLessonIds.filter(id => state.excludedLessons.has(id)).length
                const sectionAllExcluded = sectionLessonIds.length > 0 && excludedInSection === sectionLessonIds.length
                const sectionIndeterminate = excludedInSection > 0 && !sectionAllExcluded

                return (
                <div key={section.localId} className={styles.sectionNode}>
                  <div className={styles.sectionRow}>
                    <input
                      type="checkbox"
                      className={styles.lessonCheck}
                      checked={!sectionAllExcluded}
                      ref={el => { if (el) el.indeterminate = sectionIndeterminate }}
                      onChange={e => toggleSection(section, e.target.checked)}
                      title={sectionAllExcluded ? 'Include section' : 'Exclude section'}
                    />
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
              )
              })}

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
