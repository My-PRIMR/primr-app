'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { InvitePanel } from './InvitePanel'
import styles from './CreatorDashboard.module.css'
import ActionsDropdown from './ActionsDropdown'
import OnboardingStrip, { type OnboardingLesson } from './OnboardingStrip'
import ResultsTab, { type ResultsData } from './ResultsTab'
import ResultsTabBoundary from './ResultsTabBoundary'
import { PriceBadge } from '../../components/PriceBadge'

export type CourseItem = {
  id: string
  title: string
  status: string
  createdAt: string
  lessonCount: number
  doneCount: number
  priceCents: number | null
  isPaid: boolean
}

export type LessonItem = {
  id: string
  title: string
  slug: string
  createdAt: string
  updatedAt: string
  publishedAt: string | null
  examEnforced: boolean
  showcase: boolean
  isStandalone: boolean
  priceCents: number | null
  isPaid: boolean
}

type Tab = 'courses' | 'lessons' | 'results'
type View = 'card' | 'list'

function courseLabel(status: string, doneCount: number, lessonCount: number) {
  if (status === 'generating') return `Generating… ${doneCount}/${lessonCount} lessons`
  if (status === 'ready' || status === 'published') return `${lessonCount} lesson${lessonCount !== 1 ? 's' : ''}`
  return 'Draft'
}


export default function CreatorDashboard({
  courses,
  lessons,
  results,
  plan,
  onboardingLessons = [],
  initialTab,
}: {
  courses: CourseItem[]
  lessons: LessonItem[]
  results?: ResultsData
  plan?: string
  onboardingLessons?: OnboardingLesson[]
  initialTab?: Tab
}) {
  const router = useRouter()
  const [tab, setTabState] = useState<Tab>(initialTab ?? 'lessons')

  function setTab(next: Tab) {
    setTabState(next)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', next)
    router.replace(url.pathname + url.search, { scroll: false })
  }
  const [view, setView] = useState<View>('card')
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set())
  const [selectedLessons, setSelectedLessons] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const [standaloneOnly, setStandaloneOnly] = useState(true)

  const isCourses = tab === 'courses'
  const visibleLessons = standaloneOnly ? lessons.filter(l => l.isStandalone) : lessons
  const items = isCourses ? courses : visibleLessons
  const selected = isCourses ? selectedCourses : selectedLessons
  const setSelected = isCourses ? setSelectedCourses : setSelectedLessons

  const allSelected = tab !== 'results' && items.length > 0 && selected.size === items.length

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(items.map(i => i.id)))
  }

  async function deleteSelected() {
    if (selected.size === 0) return
    const count = selected.size
    const kind = isCourses ? 'course' : 'lesson'
    if (!confirm(`Delete ${count} ${kind}${count !== 1 ? 's' : ''}? This cannot be undone.`)) return
    setDeleting(true)
    const base = isCourses ? '/api/courses' : '/api/lessons'
    await Promise.all([...selected].map(id => fetch(`${base}/${id}`, { method: 'DELETE' })))
    setSelected(new Set())
    setDeleting(false)
    router.refresh()
  }

  async function publishLesson(id: string) {
    setPublishingId(id)
    await fetch(`/api/lessons/${id}/publish`, { method: 'POST' })
    setPublishingId(null)
    router.refresh()
  }

  async function toggleExamEnforced(id: string, current: boolean) {
    await fetch(`/api/lessons/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ examEnforced: !current }),
    })
    router.refresh()
  }

  async function toggleShowcase(id: string, newValue: boolean) {
    await fetch(`/api/lessons/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ showcase: newValue }),
    })
    router.refresh()
  }

  async function deleteOne(id: string, kind: 'course' | 'lesson') {
    if (!confirm(`Delete this ${kind}? This cannot be undone.`)) return
    const base = kind === 'course' ? '/api/courses' : '/api/lessons'
    await fetch(`${base}/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div>
      {onboardingLessons.length > 0 && (
        <OnboardingStrip lessons={onboardingLessons} />
      )}

      {/* ── Toolbar ── */}
      {tab !== 'results' && <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          {tab === 'lessons' && plan !== 'free' && (
            <label className={styles.filterCheckbox}>
              <input
                type="checkbox"
                checked={standaloneOnly}
                onChange={e => setStandaloneOnly(e.target.checked)}
              />
              Standalone only
            </label>
          )}
          {selected.size > 0 && (
            <button className={styles.deleteBulkBtn} onClick={deleteSelected} disabled={deleting}>
              {deleting ? 'Deleting…' : `Delete ${selected.size} selected`}
            </button>
          )}
        </div>
        <div className={styles.viewToggle}>
          <button
            className={`${styles.viewBtn} ${view === 'card' ? styles.viewBtnActive : ''}`}
            onClick={() => setView('card')}
            title="Card view"
            aria-label="Card view"
          >⊞</button>
          <button
            className={`${styles.viewBtn} ${view === 'list' ? styles.viewBtnActive : ''}`}
            onClick={() => setView('list')}
            title="List view"
            aria-label="List view"
          >☰</button>
        </div>
      </div>}

      {/* ── Courses tab ── */}
      {isCourses && (
        courses.length === 0 ? (
          <p className={styles.empty}>
            No courses yet.{' '}
            <Link href="/creator/courses/new" className={styles.link}>Create your first course →</Link>
          </p>
        ) : view === 'card' ? (
          <div className={styles.cardGrid}>
            {courses.map(course => (
              <div
                key={course.id}
                className={`${styles.card} ${selectedCourses.has(course.id) ? styles.cardSelected : ''}`}
              >
                <label className={styles.checkWrap}>
                  <input
                    type="checkbox"
                    className={styles.check}
                    checked={selectedCourses.has(course.id)}
                    onChange={() => toggle(course.id)}
                  />
                </label>
                <div className={styles.cardBody}>
                  <h2 className={styles.cardTitle}>
                    {course.title}
                    <PriceBadge priceCents={course.priceCents} isPaid={course.isPaid} />
                  </h2>
                  <p className={styles.cardMeta}>
                    {courseLabel(course.status, course.doneCount, course.lessonCount)}
                    {' · '}
                    Created {new Date(course.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className={styles.cardActions}>
                  {course.status === 'generating' ? (
                    <Link href={`/creator/courses/${course.id}/edit`} className={styles.editLink}>
                      View progress →
                    </Link>
                  ) : (
                    <>
                      <Link href={`/creator/courses/${course.id}/edit`} className={styles.editLink}>Edit</Link>
                      <Link href={`/learn/course/${course.id}`} className={styles.previewLink}>Preview</Link>
                      <InvitePanel type="course" id={course.id} />
                      <button className={styles.deleteBtn} onClick={() => deleteOne(course.id, 'course')}>Delete</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thCheck}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                </th>
                <th className={styles.thTitle}>Title</th>
                <th className={styles.thMeta}>Status</th>
                <th className={styles.thMeta}>Created</th>
                <th className={styles.thActions}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {courses.map(course => (
                <tr
                  key={course.id}
                  className={`${styles.row} ${selectedCourses.has(course.id) ? styles.rowSelected : ''}`}
                >
                  <td className={styles.tdCheck}>
                    <input
                      type="checkbox"
                      checked={selectedCourses.has(course.id)}
                      onChange={() => toggle(course.id)}
                    />
                  </td>
                  <td className={styles.tdTitle}>
                    {course.title}
                    <PriceBadge priceCents={course.priceCents} isPaid={course.isPaid} />
                  </td>
                  <td className={styles.tdMeta}>{courseLabel(course.status, course.doneCount, course.lessonCount)}</td>
                  <td className={styles.tdMeta}>{new Date(course.createdAt).toLocaleDateString()}</td>
                  <td className={styles.tdActions}>
                    <ActionsDropdown
                      items={
                        course.status === 'generating'
                          ? [
                              { type: 'link', label: 'View progress', href: `/creator/courses/${course.id}/edit` },
                            ]
                          : [
                              { type: 'link', label: 'Edit', href: `/creator/courses/${course.id}/edit` },
                              { type: 'link', label: 'Preview', href: `/learn/course/${course.id}` },
                              { type: 'divider' },
                              { type: 'button', label: 'Delete', onClick: () => deleteOne(course.id, 'course'), danger: true },
                            ]
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      {/* ── Lessons tab ── */}
      {tab === 'lessons' && (
        visibleLessons.length === 0 ? (
          <p className={styles.empty}>
            {lessons.length === 0
              ? <><Link href="/creator/new" className={styles.link}>Create your first lesson →</Link></>
              : plan === 'free' ? 'No lessons yet.' : 'No standalone lessons. Uncheck "Standalone only" to see all lessons.'}
          </p>
        ) : view === 'card' ? (
          <div className={styles.cardGrid}>
            {visibleLessons.map(lesson => (
              <div
                key={lesson.id}
                className={`${styles.card} ${selectedLessons.has(lesson.id) ? styles.cardSelected : ''}`}
              >
                <label className={styles.checkWrap}>
                  <input
                    type="checkbox"
                    className={styles.check}
                    checked={selectedLessons.has(lesson.id)}
                    onChange={() => toggle(lesson.id)}
                  />
                </label>
                <div className={styles.cardBody}>
                  <h2 className={styles.cardTitle}>
                    {lesson.title}
                    {!lesson.publishedAt && <span className={styles.draftBadge}>Draft</span>}
                    <PriceBadge priceCents={lesson.priceCents} isPaid={lesson.isPaid} />
                  </h2>
                  <p className={styles.cardMeta}>
                    Created {new Date(lesson.createdAt).toLocaleDateString()}
                    {' · '}
                    Updated {new Date(lesson.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className={styles.cardActions}>
                  <Link href={`/creator/edit/${lesson.id}`} className={styles.editLink}>Edit</Link>
                  <Link href={`/creator/preview/${lesson.id}`} className={styles.previewLink}>Preview</Link>
                  {lesson.publishedAt ? (
                    <Link href={`/learn/${lesson.id}`} className={styles.previewLink}>Take</Link>
                  ) : (
                    <button
                      className={styles.publishBtn}
                      onClick={() => publishLesson(lesson.id)}
                      disabled={publishingId === lesson.id}
                    >
                      {publishingId === lesson.id ? 'Publishing…' : 'Publish'}
                    </button>
                  )}
                  {lesson.publishedAt && (
                    <>
                      <button
                        className={lesson.examEnforced ? styles.examOnBtn : styles.examOffBtn}
                        onClick={() => toggleExamEnforced(lesson.id, lesson.examEnforced)}
                        title={lesson.examEnforced ? 'Exam is enforced — click to make it optional' : 'Exam is optional — click to enforce'}
                      >
                        {lesson.examEnforced ? 'Exam: on' : 'Exam: off'}
                      </button>
                      {/* TODO: re-enable showcase toggle */}
                      {/* <button
                        className={lesson.showcase ? styles.examOnBtn : styles.examOffBtn}
                        onClick={() => toggleShowcase(lesson.id, !lesson.showcase)}
                        title={lesson.showcase ? 'Lesson is showcase-only — click to make it normal' : 'Lesson is normal — click to make it showcase-only'}
                      >
                        {lesson.showcase ? 'Showcase Only' : 'Normal'}
                      </button> */}
                    </>
                  )}
                  <InvitePanel type="lesson" id={lesson.id} />
                  <button className={styles.deleteBtn} onClick={() => deleteOne(lesson.id, 'lesson')}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thCheck}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                </th>
                <th className={styles.thTitle}>Title</th>
                <th className={styles.thMeta}>Updated</th>
                <th className={styles.thActions}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleLessons.map(lesson => (
                <tr
                  key={lesson.id}
                  className={`${styles.row} ${selectedLessons.has(lesson.id) ? styles.rowSelected : ''}`}
                >
                  <td className={styles.tdCheck}>
                    <input
                      type="checkbox"
                      checked={selectedLessons.has(lesson.id)}
                      onChange={() => toggle(lesson.id)}
                    />
                  </td>
                  <td className={styles.tdTitle}>
                    {lesson.title}
                    {!lesson.publishedAt && <span className={styles.draftBadge}>Draft</span>}
                    <PriceBadge priceCents={lesson.priceCents} isPaid={lesson.isPaid} />
                  </td>
                  <td className={styles.tdMeta}>{new Date(lesson.updatedAt).toLocaleDateString()}</td>
                  <td className={styles.tdActions}>
                    <ActionsDropdown
                      items={[
                        { type: 'link', label: 'Edit', href: `/creator/edit/${lesson.id}` },
                        { type: 'link', label: 'Preview', href: `/creator/preview/${lesson.id}` },
                        ...(lesson.publishedAt
                          ? [{ type: 'link' as const, label: 'Take', href: `/learn/${lesson.id}` }]
                          : [{ type: 'button' as const, label: publishingId === lesson.id ? 'Publishing…' : 'Publish', onClick: () => publishLesson(lesson.id), disabled: publishingId === lesson.id }]
                        ),
                        ...(lesson.publishedAt
                          ? [{
                              type: 'button' as const,
                              label: lesson.examEnforced ? 'Exam: on' : 'Exam: off',
                              onClick: () => toggleExamEnforced(lesson.id, lesson.examEnforced),
                            }]
                          : []
                        ),
                        { type: 'divider' as const },
                        { type: 'button' as const, label: 'Delete', onClick: () => deleteOne(lesson.id, 'lesson'), danger: true },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      {/* ── Results tab ── */}
      {tab === 'results' && results && (
        <ResultsTabBoundary>
          <ResultsTab results={results} />
        </ResultsTabBoundary>
      )}

    </div>
  )
}
