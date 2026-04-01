# Creator Results — Course Tracking Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge course-level learner tracking from `/creator/progress` into the Results tab on the creator dashboard, add a course drilldown page, and delete `/creator/progress`.

**Architecture:** Pure RSC / server-rendered. All data fetched in `app/creator/page.tsx` (server component) and passed as props to `ResultsTab.tsx` (client component). New course drilldown RSC at `/creator/courses/[id]/results`. No new API routes. No schema changes.

**Tech Stack:** Next.js 15 App Router, Drizzle ORM, PostgreSQL, TypeScript, CSS Modules, design tokens (`--color-*`, `--surface`, `--border`, `--accent`)

---

## File Map

| File | Change |
|---|---|
| `app/creator/CreatorDashboard.module.css` | Append CSS for course expandable rows + learner sub-table |
| `app/creator/ResultsTab.tsx` | Add `CourseLearnerRow` / `CourseResultRow` types; add `courseRows` to `ResultsData`; add courses section UI with expand/collapse + "View results →" |
| `app/creator/page.tsx` | Add course queries; update totalLearners; extend aggregate queries to include course lessons; build `courseRows`; update guard; remove Progress link |
| `app/creator/courses/[id]/results/page.tsx` | New RSC — course drilldown |
| `app/creator/courses/[id]/results/page.module.css` | New CSS module for drilldown |
| `app/creator/progress/page.tsx` | Delete |
| `app/creator/progress/ProgressDashboard.tsx` | Delete |
| `app/creator/progress/ProgressDashboard.module.css` | Delete |

---

## Task 1: CSS for course section

**Files:**
- Modify: `app/creator/CreatorDashboard.module.css` (append at end)

- [ ] **Step 1: Append course section styles**

Open `app/creator/CreatorDashboard.module.css` and append the following at the very end of the file:

```css
/* ── Results: course section ──────────────────────────────────────────────── */
.courseList {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 2rem;
}

.courseItem {
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
}

.courseHeader {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  background: none;
  border: none;
  width: 100%;
  text-align: left;
}

.courseHeader:hover {
  background: var(--surface-alt);
}

.expandIcon {
  font-size: 13px;
  font-weight: 700;
  color: var(--accent);
  width: 16px;
  flex-shrink: 0;
  line-height: 1;
}

.courseInfo {
  flex: 1;
  min-width: 0;
}

.courseTitle {
  font-size: 14px;
  font-weight: 600;
  color: var(--ink);
}

.courseMeta {
  font-size: 12px;
  color: var(--ink-muted);
  margin-top: 1px;
}

.courseCompletionWrap {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.courseMiniBar {
  width: 80px;
  height: 5px;
  background: var(--surface-alt);
  border: 1px solid var(--border);
  border-radius: 3px;
  overflow: hidden;
}

.courseMiniBarFill {
  height: 100%;
  border-radius: 3px;
  background: var(--accent);
}

.courseCompletionPct {
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-soft);
  min-width: 36px;
  text-align: right;
}

.courseViewLink {
  font-size: 12px;
  font-weight: 500;
  color: var(--accent);
  text-decoration: none;
  white-space: nowrap;
  flex-shrink: 0;
}

.courseViewLink:hover {
  opacity: 0.75;
}

/* Expanded learner sub-table */
.learnerSubTable {
  border-top: 1.5px solid var(--border);
  background: var(--surface-alt);
}

.learnerTable {
  width: 100%;
  border-collapse: collapse;
}

.learnerTable thead th {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ink-muted);
  text-align: left;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border);
}

.learnerTable tbody td {
  font-size: 13px;
  color: var(--ink);
  padding: 9px 16px;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}

.learnerTable tbody tr:last-child td {
  border-bottom: none;
}

.learnerName {
  font-weight: 500;
}

.learnerEmail {
  font-size: 11px;
  color: var(--ink-muted);
}

.progWrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.progBarBg {
  width: 80px;
  height: 5px;
  background: var(--border-mid);
  border-radius: 3px;
  overflow: hidden;
}

.progBarFill {
  height: 100%;
  border-radius: 3px;
}

.progLabel {
  font-size: 12px;
  color: var(--ink-muted);
}

.completedPillSub {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 20px;
  background: var(--teal-soft);
  color: var(--teal);
}

.inProgressPillSub {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 20px;
  background: var(--amber-soft);
  color: var(--amber);
}

.notStartedPillSub {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 20px;
  background: var(--surface-alt);
  color: var(--ink-muted);
  border: 1px solid var(--border);
}
```

- [ ] **Step 2: Verify tsc passes**

```bash
cd /Users/gpan/PRIMR/primr-app && npx tsc --noEmit
```

Expected: no output (exit 0).

- [ ] **Step 3: Commit**

```bash
cd /Users/gpan/PRIMR/primr-app
git add app/creator/CreatorDashboard.module.css
git commit -m "style(creator-results): add CSS for course expandable rows and learner sub-table"
```

---

## Task 2: Update `ResultsTab.tsx` — types and courses UI

**Files:**
- Modify: `app/creator/ResultsTab.tsx`

**Context:** `ResultsTab` is a `'use client'` component. It receives all data as props from the server page. It already has `LessonResultRow`, `ResultsData`, stat cards, activity chart, and a per-lesson table. We're adding:
1. Two new types exported from this file
2. `courseRows` field on `ResultsData`
3. Expandable courses section above the existing lessons table
4. Rename of the lessons section title

- [ ] **Step 1: Replace the file contents**

The full new content of `app/creator/ResultsTab.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import styles from './CreatorDashboard.module.css'

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
  completedCount: number
  learners: CourseLearnerRow[]
}

export type LessonResultRow = {
  id: string
  title: string
  invitedCount: number
  startedCount: number
  completedCount: number
  avgScore: number | null
}

export type ResultsData = {
  totalLearners: number
  startedCount: number
  completedCount: number
  avgScore: number | null
  lastActivityDate: string | null
  /** 30 entries, one per day, ascending date order */
  dailyActivity: Array<{ date: string; count: number }>
  courseRows: CourseResultRow[]
  lessonRows: LessonResultRow[]
}

export default function ResultsTab({ results }: { results: ResultsData }) {
  const {
    totalLearners, startedCount, completedCount, avgScore,
    lastActivityDate, dailyActivity, courseRows, lessonRows,
  } = results

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const completionRate = startedCount > 0 ? Math.round((completedCount / startedCount) * 100) : null
  const maxActivity = Math.max(...dailyActivity.map(d => d.count), 1)

  return (
    <div>
      {/* Stat cards */}
      <div className={styles.resultsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total learners</div>
          <div className={styles.statValue}>{totalLearners}</div>
          <div className={styles.statSub}>across all content</div>
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

      {/* Courses section */}
      {courseRows.length > 0 && (
        <>
          <div className={styles.resultsSectionTitle}>Courses</div>
          <div className={styles.courseList}>
            {courseRows.map(course => {
              const isExpanded = expandedIds.has(course.id)
              const completionPct = course.enrolledCount > 0
                ? Math.round((course.completedCount / course.enrolledCount) * 100)
                : 0

              return (
                <div key={course.id} className={styles.courseItem}>
                  <button
                    className={styles.courseHeader}
                    onClick={() => toggleExpand(course.id)}
                    aria-expanded={isExpanded}
                  >
                    <span className={styles.expandIcon}>{isExpanded ? '−' : '+'}</span>
                    <div className={styles.courseInfo}>
                      <div className={styles.courseTitle}>{course.title}</div>
                      <div className={styles.courseMeta}>
                        {course.enrolledCount} enrolled · {course.totalLessons} lesson{course.totalLessons !== 1 ? 's' : ''}
                        {course.enrolledCount > 0 && ` · ${completionPct}% complete`}
                      </div>
                    </div>
                    {course.enrolledCount > 0 && (
                      <div className={styles.courseCompletionWrap}>
                        <div className={styles.courseMiniBar}>
                          <div className={styles.courseMiniBarFill} style={{ width: `${completionPct}%` }} />
                        </div>
                        <span className={styles.courseCompletionPct}>{completionPct}%</span>
                      </div>
                    )}
                    <Link
                      href={`/creator/courses/${course.id}/results`}
                      className={styles.courseViewLink}
                      onClick={e => e.stopPropagation()}
                    >
                      View results →
                    </Link>
                  </button>

                  {isExpanded && (
                    <div className={styles.learnerSubTable}>
                      {course.learners.length === 0 ? (
                        <p style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--ink-muted)' }}>
                          No learners enrolled yet.
                        </p>
                      ) : (
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
                              const progPct = course.totalLessons > 0
                                ? Math.round((learner.completedLessons / course.totalLessons) * 100)
                                : 0
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
                                    <div className={styles.learnerName}>{learner.name ?? learner.email}</div>
                                    {learner.name && <div className={styles.learnerEmail}>{learner.email}</div>}
                                  </td>
                                  <td>
                                    <div className={styles.progWrap}>
                                      <div className={styles.progBarBg}>
                                        <div
                                          className={styles.progBarFill}
                                          style={{
                                            width: `${progPct}%`,
                                            background: learner.status === 'completed'
                                              ? 'var(--color-teal, var(--accent))'
                                              : learner.status === 'in_progress'
                                                ? 'var(--color-amber, var(--amber))'
                                                : 'var(--border)',
                                          }}
                                        />
                                      </div>
                                      <span className={styles.progLabel}>
                                        {learner.completedLessons} / {course.totalLessons}
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
                                        <span className={styles.scorePct}>
                                          {Math.round(learner.avgScore * 100)}%
                                        </span>
                                      </div>
                                    ) : (
                                      <span style={{ color: 'var(--ink-muted)' }}>—</span>
                                    )}
                                  </td>
                                  <td><span className={pillClass}>{pillLabel}</span></td>
                                  <td style={{ color: 'var(--ink-muted)' }}>
                                    {learner.lastActivity
                                      ? new Date(learner.lastActivity).toLocaleDateString('en-US', { timeZone: 'UTC' })
                                      : '—'}
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
        </>
      )}

      {/* Standalone lessons table */}
      {lessonRows.length === 0 ? (
        <p className={styles.empty}>No standalone lessons published yet.</p>
      ) : (
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
                        <span style={{ color: 'var(--ink-muted)' }}>—</span>
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
```

- [ ] **Step 2: Verify tsc passes**

```bash
cd /Users/gpan/PRIMR/primr-app && npx tsc --noEmit
```

Expected: TypeScript will complain that `ResultsData.courseRows` is missing at the call site in `page.tsx`. That's expected — it'll be fixed in Task 3. If you see only that error (and no others in ResultsTab itself), proceed.

- [ ] **Step 3: Commit**

```bash
cd /Users/gpan/PRIMR/primr-app
git add app/creator/ResultsTab.tsx
git commit -m "feat(creator-results): add course expandable section and types to ResultsTab"
```

---

## Task 3: Update `page.tsx` — course queries, totalLearners, remove Progress link

**Files:**
- Modify: `app/creator/page.tsx`

**Context:** `page.tsx` is the server component that fetches all data. The `resultsData` block currently only handles standalone lessons. We're extending it to:
1. Fetch course enrollments and completion data
2. Fetch course lesson IDs (to include in aggregate stats)
3. Compute `totalLearners` as union of enrolled emails + lesson attempt emails
4. Build `courseRows` for each created course
5. Remove the `/creator/progress` nav link

The existing standalone lesson query already uses `isNull(chapterLessons.id)` so it correctly excludes course lessons — no change needed there.

- [ ] **Step 1: Add `users` to the schema import**

Find this line near the top of `app/creator/page.tsx`:

```ts
import {
  lessons, lessonInvitations, lessonAttempts,
  courses, courseSections, courseChapters, chapterLessons, courseEnrollments,
} from '@/db/schema'
```

Replace with:

```ts
import {
  users, lessons, lessonInvitations, lessonAttempts,
  courses, courseSections, courseChapters, chapterLessons, courseEnrollments,
} from '@/db/schema'
```

- [ ] **Step 2: Add `CourseResultRow` and `CourseLearnerRow` to the ResultsTab import**

Find:

```ts
import type { ResultsData } from './ResultsTab'
```

Replace with:

```ts
import type { ResultsData, CourseResultRow, CourseLearnerRow } from './ResultsTab'
```

- [ ] **Step 3: Update the `resultsData` block**

Find and replace the entire `resultsData` block (from `let resultsData: ResultsData | undefined` through the closing `}`):

```ts
  // ── Creator: results data ─────────────────────────────────────────────────
  let resultsData: ResultsData | undefined

  if (isCreator && (createdCourses.length > 0 || createdLessons.length > 0)) {
    const createdLessonIds = createdLessons.map(l => l.id)
    const courseIds = createdCourses.map(c => c.id)

    // ── Course enrollment rows ──
    const courseEnrollmentRows = courseIds.length > 0
      ? await db
          .select({
            courseId: courseEnrollments.courseId,
            email: courseEnrollments.email,
            userName: users.name,
          })
          .from(courseEnrollments)
          .leftJoin(users, sql`lower(${users.email}) = lower(${courseEnrollments.email})`)
          .where(inArray(courseEnrollments.courseId, courseIds))
      : [] as Array<{ courseId: string; email: string; userName: string | null }>

    // ── Course completion: per (courseId, learnerEmail) ──
    type CourseCompletionRow = {
      courseId: string; learnerEmail: string;
      completedCount: number; avgScore: number | null; lastActivity: string | null
    }
    const courseCompletionRows: CourseCompletionRow[] = courseIds.length > 0
      ? await db
          .select({
            courseId: courseSections.courseId,
            learnerEmail: sql<string>`lower(${users.email})`,
            completedCount: sql<number>`count(distinct ${lessonAttempts.lessonId})::int`,
            avgScore: sql<number | null>`avg(${lessonAttempts.score})`,
            lastActivity: sql<string | null>`max(coalesce(${lessonAttempts.completedAt}, ${lessonAttempts.startedAt}))::text`,
          })
          .from(lessonAttempts)
          .innerJoin(users, eq(users.id, lessonAttempts.userId))
          .innerJoin(chapterLessons, eq(chapterLessons.lessonId, lessonAttempts.lessonId))
          .innerJoin(courseChapters, eq(courseChapters.id, chapterLessons.chapterId))
          .innerJoin(courseSections, eq(courseSections.id, courseChapters.sectionId))
          .where(and(
            eq(lessonAttempts.status, 'completed'),
            inArray(courseSections.courseId, courseIds),
          ))
          .groupBy(courseSections.courseId, sql`lower(${users.email})`)
      : []

    // ── Course lesson IDs (for including in aggregate stats) ──
    const courseLessonRows = courseIds.length > 0
      ? await db
          .select({ lessonId: chapterLessons.lessonId })
          .from(chapterLessons)
          .innerJoin(courseChapters, eq(courseChapters.id, chapterLessons.chapterId))
          .innerJoin(courseSections, eq(courseSections.id, courseChapters.sectionId))
          .where(inArray(courseSections.courseId, courseIds))
      : [] as Array<{ lessonId: string }>

    const courseLessonIds = courseLessonRows.map(r => r.lessonId)
    const allLessonIds = [...createdLessonIds, ...courseLessonIds]

    // ── Per-lesson: invited counts (standalone only) ──
    const invitedRows = createdLessonIds.length > 0
      ? await db
          .select({
            lessonId: lessonInvitations.lessonId,
            count: sql<number>`count(*)::int`,
          })
          .from(lessonInvitations)
          .where(inArray(lessonInvitations.lessonId, createdLessonIds))
          .groupBy(lessonInvitations.lessonId)
      : [] as Array<{ lessonId: string; count: number }>

    const invitedMap = new Map(invitedRows.map(r => [r.lessonId, r.count]))

    // ── Per-lesson: attempt stats (standalone only) ──
    const attemptStatRows = createdLessonIds.length > 0
      ? await db
          .select({
            lessonId: lessonAttempts.lessonId,
            startedCount: sql<number>`count(distinct ${lessonAttempts.userId})::int`,
            completedCount: sql<number>`count(distinct case when ${lessonAttempts.status} = 'completed' then ${lessonAttempts.userId} end)::int`,
            avgScore: sql<number | null>`avg(case when ${lessonAttempts.status} = 'completed' and ${lessonAttempts.score} is not null then ${lessonAttempts.score} end)`,
          })
          .from(lessonAttempts)
          .where(inArray(lessonAttempts.lessonId, createdLessonIds))
          .groupBy(lessonAttempts.lessonId)
      : [] as Array<{ lessonId: string; startedCount: number; completedCount: number; avgScore: number | null }>

    const attemptStatMap = new Map(attemptStatRows.map(r => [r.lessonId, r]))

    const overallStarted = attemptStatRows.reduce((sum, r) => sum + r.startedCount, 0)
    const overallCompleted = attemptStatRows.reduce((sum, r) => sum + r.completedCount, 0)

    // ── Total learners: union of course enrollee emails + lesson attempt emails ──
    const lessonAttemptEmailRows = allLessonIds.length > 0
      ? await db
          .select({ email: sql<string>`lower(${users.email})` })
          .from(lessonAttempts)
          .innerJoin(users, eq(users.id, lessonAttempts.userId))
          .where(inArray(lessonAttempts.lessonId, allLessonIds))
          .groupBy(sql`lower(${users.email})`)
      : [] as Array<{ email: string }>

    const allLearnerEmails = new Set([
      ...courseEnrollmentRows.map(r => r.email.toLowerCase()),
      ...lessonAttemptEmailRows.map(r => r.email),
    ])
    const totalLearners = allLearnerEmails.size

    // ── Overall avg score + last activity (all lessons: standalone + course) ──
    const overallScoreRow = allLessonIds.length > 0
      ? await db
          .select({
            avgScore: sql<number | null>`avg(${lessonAttempts.score})`,
            lastActivity: sql<string | null>`max(${lessonAttempts.completedAt})::text`,
          })
          .from(lessonAttempts)
          .where(and(
            inArray(lessonAttempts.lessonId, allLessonIds),
            eq(lessonAttempts.status, 'completed'),
          ))
      : [{ avgScore: null, lastActivity: null }]

    // ── Daily activity (all lessons: standalone + course) ──
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const dailyRows = allLessonIds.length > 0
      ? await db
          .select({
            date: sql<string>`date(${lessonAttempts.completedAt})::text`,
            count: sql<number>`count(*)::int`,
          })
          .from(lessonAttempts)
          .where(and(
            inArray(lessonAttempts.lessonId, allLessonIds),
            eq(lessonAttempts.status, 'completed'),
            gte(lessonAttempts.completedAt, thirtyDaysAgo),
          ))
          .groupBy(sql`date(${lessonAttempts.completedAt})`)
      : [] as Array<{ date: string; count: number }>

    // ── Build courseRows ──
    const courseRows: CourseResultRow[] = createdCourses.map(course => {
      const enrollees = courseEnrollmentRows.filter(e => e.courseId === course.id)
      const completionMap = new Map(
        courseCompletionRows
          .filter(c => c.courseId === course.id)
          .map(c => [c.learnerEmail, c])
      )

      const learners: CourseLearnerRow[] = enrollees.map(e => {
        const completion = completionMap.get(e.email.toLowerCase())
        const completedLessons = completion?.completedCount ?? 0
        const totalLessons = course.lessonCount
        const status: CourseLearnerRow['status'] =
          totalLessons > 0 && completedLessons >= totalLessons
            ? 'completed'
            : completedLessons > 0
              ? 'in_progress'
              : 'not_started'
        return {
          email: e.email,
          name: e.userName,
          completedLessons,
          totalLessons,
          avgScore: completion?.avgScore ?? null,
          status,
          lastActivity: completion?.lastActivity ?? null,
        }
      }).sort((a, b) => {
        const order = { completed: 0, in_progress: 1, not_started: 2 }
        if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status]
        if (a.status === 'completed' && b.status === 'completed') {
          return (b.avgScore ?? 0) - (a.avgScore ?? 0)
        }
        return 0
      })

      const completedCount = learners.filter(l => l.status === 'completed').length

      return {
        id: course.id,
        title: course.title,
        totalLessons: course.lessonCount,
        enrolledCount: enrollees.length,
        completedCount,
        learners,
      }
    })

    resultsData = {
      totalLearners,
      startedCount: overallStarted,
      completedCount: overallCompleted,
      avgScore: overallScoreRow[0]?.avgScore ?? null,
      lastActivityDate: overallScoreRow[0]?.lastActivity ?? null,
      dailyActivity: fillDailyActivity(dailyRows, 30),
      courseRows,
      lessonRows: createdLessons.map(l => {
        const stat = attemptStatMap.get(l.id)
        return {
          id: l.id,
          title: l.title,
          invitedCount: invitedMap.get(l.id) ?? 0,
          startedCount: stat?.startedCount ?? 0,
          completedCount: stat?.completedCount ?? 0,
          avgScore: stat?.avgScore ?? null,
        }
      }),
    }
  }
```

- [ ] **Step 4: Remove the Progress nav link**

Find and remove this line in the JSX:

```tsx
              <Link href="/creator/progress" className={styles.newCourseBtn}>Progress</Link>
```

- [ ] **Step 5: Verify tsc passes**

```bash
cd /Users/gpan/PRIMR/primr-app && npx tsc --noEmit
```

Expected: no output (exit 0).

- [ ] **Step 6: Commit**

```bash
cd /Users/gpan/PRIMR/primr-app
git add app/creator/page.tsx
git commit -m "feat(creator-results): add course queries and totalLearners dedup to results data"
```

---

## Task 4: Course drilldown page

**Files:**
- Create: `app/creator/courses/[id]/results/page.tsx`
- Create: `app/creator/courses/[id]/results/page.module.css`

**Context:** Mirrors the existing lesson drilldown at `app/creator/lessons/[id]/results/page.tsx`. Access control: creator-only, 404 otherwise. Shows 4 stat cards, a learner roster with lesson progress, and a per-lesson breakdown in curriculum order.

- [ ] **Step 1: Create the CSS module**

Create `app/creator/courses/[id]/results/page.module.css` with this content:

```css
.main {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
  font-family: 'DM Sans', system-ui, sans-serif;
}

.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 1.25rem;
  margin-bottom: 1.25rem;
  border-bottom: 1.5px solid var(--border);
}

.wordmark {
  font-family: 'DM Serif Display', Georgia, serif;
  font-size: 20px;
  color: var(--ink);
  text-decoration: none;
}

.backLink {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 500;
  color: var(--accent);
  text-decoration: none;
  margin-bottom: 1rem;
}

.backLink:hover { opacity: 0.75; }

.pageTitle {
  font-family: 'DM Serif Display', Georgia, serif;
  font-size: 22px;
  color: var(--ink);
  margin-bottom: 4px;
}

.pageMeta {
  font-size: 13px;
  color: var(--ink-muted);
  margin-bottom: 1.5rem;
}

.statStrip {
  display: flex;
  gap: 10px;
  margin-bottom: 1.5rem;
}

.statCard {
  flex: 1;
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: 10px;
  padding: 12px 16px;
}

.statLabel {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ink-muted);
  margin-bottom: 3px;
}

.statValue {
  font-size: 22px;
  font-weight: 700;
  color: var(--ink);
  line-height: 1;
}

.statSub {
  font-size: 12px;
  color: var(--ink-muted);
  margin-top: 2px;
}

.section {
  margin-bottom: 2rem;
}

.sectionTitle {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
  margin-bottom: 0.75rem;
}

.dataTable {
  width: 100%;
  border-collapse: collapse;
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
}

.dataTable thead th {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ink-muted);
  text-align: left;
  padding: 10px 14px;
  border-bottom: 1.5px solid var(--border);
  background: var(--surface-alt);
}

.dataTable tbody td {
  font-size: 13px;
  color: var(--ink);
  padding: 11px 14px;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}

.dataTable tbody tr:last-child td { border-bottom: none; }
.dataTable tbody tr:hover td { background: var(--surface-alt); }

.learnerName { font-weight: 500; }
.learnerEmail { font-size: 11px; color: var(--ink-muted); }

.progWrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.progBarBg {
  width: 80px;
  height: 6px;
  background: var(--surface-alt);
  border: 1px solid var(--border);
  border-radius: 3px;
  overflow: hidden;
}

.progBarFill {
  height: 100%;
  border-radius: 3px;
}

.progLabel {
  font-size: 12px;
  color: var(--ink-muted);
}

.scoreBarWrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.scoreBarTrack {
  flex: 1;
  height: 6px;
  background: var(--surface-alt);
  border: 1px solid var(--border);
  border-radius: 3px;
  overflow: hidden;
  min-width: 60px;
}

.scoreBarFill {
  height: 100%;
  border-radius: 3px;
  background: var(--accent);
}

.scorePct {
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-soft);
  min-width: 32px;
  text-align: right;
}

.completedPill {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 20px;
  background: var(--teal-soft);
  color: var(--teal);
}

.inProgressPill {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 20px;
  background: var(--amber-soft);
  color: var(--amber);
}

.notStartedPill {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 20px;
  background: var(--surface-alt);
  color: var(--ink-muted);
  border: 1px solid var(--border);
}

.muted { color: var(--ink-muted); }

/* Lesson breakdown */
.lessonList {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.lessonRow {
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: 10px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 14px;
}

.lessonNum {
  font-size: 11px;
  font-weight: 700;
  color: var(--ink-muted);
  width: 20px;
  flex-shrink: 0;
}

.lessonInfo {
  flex: 1;
  min-width: 0;
}

.lessonTitle {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lessonSubtitle {
  font-size: 11px;
  color: var(--ink-muted);
  margin-top: 2px;
}

.lessonBarWrap {
  flex-shrink: 0;
  width: 120px;
}

.lessonBarBg {
  height: 6px;
  background: var(--surface-alt);
  border: 1px solid var(--border);
  border-radius: 3px;
  overflow: hidden;
}

.lessonBarFillHigh { height: 100%; border-radius: 3px; background: var(--color-teal, var(--accent)); }
.lessonBarFillMid  { height: 100%; border-radius: 3px; background: var(--color-amber, #d97706); }
.lessonBarFillLow  { height: 100%; border-radius: 3px; background: var(--color-coral, #e05a44); }

.lessonBarLabel {
  font-size: 11px;
  color: var(--ink-muted);
  margin-top: 3px;
  text-align: right;
}

.lessonPctHigh {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-teal, var(--accent));
  flex-shrink: 0;
  width: 44px;
  text-align: right;
}

.lessonPctMid {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-amber, #d97706);
  flex-shrink: 0;
  width: 44px;
  text-align: right;
}

.lessonPctLow {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-coral, #e05a44);
  flex-shrink: 0;
  width: 44px;
  text-align: right;
}

.lessonPctLabel {
  font-size: 11px;
  color: var(--ink-muted);
}
```

- [ ] **Step 2: Create the page RSC**

Create `app/creator/courses/[id]/results/page.tsx` with this content:

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/db'
import {
  courses, courseSections, courseChapters, chapterLessons,
  courseEnrollments, lessonAttempts, lessons, users,
} from '@/db/schema'
import { eq, and, sql, inArray } from 'drizzle-orm'
import { getSession } from '@/session'
import { UserMenu } from '../../../../components/UserMenu'
import styles from './page.module.css'

export const dynamic = 'force-dynamic'

const PASS_THRESHOLD = 0.70

export default async function CourseResultsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getSession()
  if (!session?.user?.id) notFound()

  // Access control: fetch course and verify creator
  const course = await db.query.courses.findFirst({
    where: eq(courses.id, id),
  })
  if (!course || course.createdBy !== session.user.id) notFound()

  // Lessons in curriculum order
  const courseLessonRows = await db
    .select({
      lessonId: chapterLessons.lessonId,
      title: lessons.title,
      sectionPosition: courseSections.position,
      chapterPosition: courseChapters.position,
      lessonPosition: chapterLessons.position,
    })
    .from(chapterLessons)
    .innerJoin(lessons, eq(lessons.id, chapterLessons.lessonId))
    .innerJoin(courseChapters, eq(courseChapters.id, chapterLessons.chapterId))
    .innerJoin(courseSections, eq(courseSections.id, courseChapters.sectionId))
    .where(eq(courseSections.courseId, id))
    .orderBy(courseSections.position, courseChapters.position, chapterLessons.position)

  const totalLessons = courseLessonRows.length
  const courseLessonIds = courseLessonRows.map(r => r.lessonId)

  // All enrolled learners
  const enrollmentRows = await db
    .select({
      email: courseEnrollments.email,
      userName: users.name,
    })
    .from(courseEnrollments)
    .leftJoin(users, sql`lower(${users.email}) = lower(${courseEnrollments.email})`)
    .where(eq(courseEnrollments.courseId, id))

  const enrolledCount = enrollmentRows.length
  const enrolledEmailSet = new Set(enrollmentRows.map(e => e.email.toLowerCase()))

  // Per-learner completion within this course
  type LearnerCompletion = {
    learnerEmail: string
    completedCount: number
    avgScore: number | null
    lastActivity: string | null
  }
  const completionRows: LearnerCompletion[] = courseLessonIds.length > 0
    ? await db
        .select({
          learnerEmail: sql<string>`lower(${users.email})`,
          completedCount: sql<number>`count(distinct ${lessonAttempts.lessonId})::int`,
          avgScore: sql<number | null>`avg(${lessonAttempts.score})`,
          lastActivity: sql<string | null>`max(coalesce(${lessonAttempts.completedAt}, ${lessonAttempts.startedAt}))::text`,
        })
        .from(lessonAttempts)
        .innerJoin(users, eq(users.id, lessonAttempts.userId))
        .where(and(
          eq(lessonAttempts.status, 'completed'),
          inArray(lessonAttempts.lessonId, courseLessonIds),
        ))
        .groupBy(sql`lower(${users.email})`)
    : []

  // Filter to enrolled learners only
  const completionMap = new Map(
    completionRows
      .filter(c => enrolledEmailSet.has(c.learnerEmail))
      .map(c => [c.learnerEmail, c])
  )

  // Build learner roster
  const roster = enrollmentRows.map(e => {
    const completion = completionMap.get(e.email.toLowerCase())
    const completedLessons = completion?.completedCount ?? 0
    const status: 'completed' | 'in_progress' | 'not_started' =
      totalLessons > 0 && completedLessons >= totalLessons
        ? 'completed'
        : completedLessons > 0
          ? 'in_progress'
          : 'not_started'
    return {
      email: e.email,
      name: e.userName,
      completedLessons,
      avgScore: completion?.avgScore ?? null,
      status,
      lastActivity: completion?.lastActivity ?? null,
    }
  }).sort((a, b) => {
    const order = { completed: 0, in_progress: 1, not_started: 2 }
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status]
    if (a.status === 'completed' && b.status === 'completed') {
      return (b.avgScore ?? 0) - (a.avgScore ?? 0)
    }
    return 0
  })

  // Aggregate stats
  const completedLearners = roster.filter(l => l.status === 'completed')
  const completedCount = completedLearners.length
  const completionRate = enrolledCount > 0 ? Math.round((completedCount / enrolledCount) * 100) : null

  const completedScores = completedLearners.map(l => l.avgScore).filter((s): s is number => s != null)
  const avgScore = completedScores.length > 0
    ? completedScores.reduce((a, b) => a + b, 0) / completedScores.length
    : null

  const passCount = completedScores.filter(s => s >= PASS_THRESHOLD).length
  const passRate = completedScores.length > 0 ? passCount / completedScores.length : null

  // Per-lesson completion breakdown (only enrolled learners)
  type LessonCompletionRow = { lessonId: string; completedCount: number }
  const lessonCompletionRows: LessonCompletionRow[] = courseLessonIds.length > 0
    ? await db
        .select({
          lessonId: lessonAttempts.lessonId,
          completedCount: sql<number>`count(distinct ${lessonAttempts.userId})::int`,
        })
        .from(lessonAttempts)
        .innerJoin(users, eq(users.id, lessonAttempts.userId))
        .innerJoin(
          courseEnrollments,
          and(
            eq(courseEnrollments.courseId, id),
            sql`lower(${courseEnrollments.email}) = lower(${users.email})`,
          )
        )
        .where(and(
          inArray(lessonAttempts.lessonId, courseLessonIds),
          eq(lessonAttempts.status, 'completed'),
        ))
        .groupBy(lessonAttempts.lessonId)
    : []

  const lessonCompletionMap = new Map(lessonCompletionRows.map(r => [r.lessonId, r.completedCount]))

  const metaParts = [
    'Course',
    `${totalLessons} lesson${totalLessons !== 1 ? 's' : ''}`,
    `${enrolledCount} enrolled`,
  ].join(' · ')

  return (
    <main className={styles.main}>
      <nav className={styles.nav}>
        <Link href="/" className={styles.wordmark}>Primr</Link>
        <UserMenu
          userName={session.user.name}
          userEmail={session.user.email}
          role={session.user.productRole}
          internalRole={session.user.internalRole}
          internalUrl={process.env.PRIMR_INTERNAL_URL ?? 'http://localhost:3004'}
        />
      </nav>

      <Link href="/creator" className={styles.backLink}>← Back to results</Link>

      <h1 className={styles.pageTitle}>{course.title}</h1>
      <p className={styles.pageMeta}>{metaParts}</p>

      {/* Stat strip */}
      <div className={styles.statStrip}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Enrolled</div>
          <div className={styles.statValue}>{enrolledCount}</div>
          <div className={styles.statSub}>learners</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Completed</div>
          <div className={styles.statValue}>{completedCount}</div>
          <div className={styles.statSub}>
            {completionRate != null ? `${completionRate}% completion` : 'no learners yet'}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Avg score</div>
          <div className={styles.statValue}>{avgScore != null ? `${Math.round(avgScore * 100)}%` : '—'}</div>
          <div className={styles.statSub}>completed learners only</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Pass rate</div>
          <div className={styles.statValue}>{passRate != null ? `${Math.round(passRate * 100)}%` : '—'}</div>
          <div className={styles.statSub}>≥ {Math.round(PASS_THRESHOLD * 100)}% avg = pass</div>
        </div>
      </div>

      {/* Learner roster */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Learner roster</div>
        {roster.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--ink-muted)' }}>No learners enrolled yet.</p>
        ) : (
          <table className={styles.dataTable}>
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
              {roster.map(learner => {
                const progPct = totalLessons > 0
                  ? Math.round((learner.completedLessons / totalLessons) * 100)
                  : 0
                const pillClass = learner.status === 'completed'
                  ? styles.completedPill
                  : learner.status === 'in_progress'
                    ? styles.inProgressPill
                    : styles.notStartedPill
                const pillLabel = learner.status === 'completed'
                  ? 'Completed'
                  : learner.status === 'in_progress'
                    ? 'In progress'
                    : 'Not started'
                const barColor = learner.status === 'completed'
                  ? 'var(--color-teal, var(--accent))'
                  : learner.status === 'in_progress'
                    ? 'var(--color-amber, #d97706)'
                    : 'var(--border)'

                return (
                  <tr key={learner.email}>
                    <td>
                      <div className={styles.learnerName}>{learner.name ?? learner.email}</div>
                      {learner.name && <div className={styles.learnerEmail}>{learner.email}</div>}
                    </td>
                    <td>
                      <div className={styles.progWrap}>
                        <div className={styles.progBarBg}>
                          <div
                            className={styles.progBarFill}
                            style={{ width: `${progPct}%`, background: barColor }}
                          />
                        </div>
                        <span className={styles.progLabel}>
                          {learner.completedLessons} / {totalLessons}
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
                          <span className={styles.scorePct}>
                            {Math.round(learner.avgScore * 100)}%
                          </span>
                        </div>
                      ) : (
                        <span className={styles.muted}>—</span>
                      )}
                    </td>
                    <td><span className={pillClass}>{pillLabel}</span></td>
                    <td className={styles.muted}>
                      {learner.lastActivity
                        ? new Date(learner.lastActivity).toLocaleDateString('en-US', { timeZone: 'UTC' })
                        : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Per-lesson breakdown */}
      {courseLessonRows.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            Lesson completion
            <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--ink-muted)', marginLeft: '6px' }}>
              (% of enrolled learners who completed each lesson)
            </span>
          </div>
          <div className={styles.lessonList}>
            {courseLessonRows.map((lesson, i) => {
              const completedCount = lessonCompletionMap.get(lesson.lessonId) ?? 0
              const pct = enrolledCount > 0 ? Math.round((completedCount / enrolledCount) * 100) : 0
              const pctClass = pct >= 80
                ? styles.lessonPctHigh
                : pct >= 50
                  ? styles.lessonPctMid
                  : styles.lessonPctLow
              const barFillClass = pct >= 80
                ? styles.lessonBarFillHigh
                : pct >= 50
                  ? styles.lessonBarFillMid
                  : styles.lessonBarFillLow

              return (
                <div key={lesson.lessonId} className={styles.lessonRow}>
                  <div className={styles.lessonNum}>{i + 1}</div>
                  <div className={styles.lessonInfo}>
                    <div className={styles.lessonTitle}>{lesson.title}</div>
                    <div className={styles.lessonSubtitle}>{completedCount} / {enrolledCount} completed</div>
                  </div>
                  <div className={styles.lessonBarWrap}>
                    <div className={styles.lessonBarBg}>
                      <div className={barFillClass} style={{ width: `${pct}%` }} />
                    </div>
                    <div className={styles.lessonBarLabel}>{pct}% completion</div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <div className={pctClass}>{pct}%</div>
                    <div className={styles.lessonPctLabel}>completed</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 3: Verify tsc passes**

```bash
cd /Users/gpan/PRIMR/primr-app && npx tsc --noEmit
```

Expected: no output (exit 0).

- [ ] **Step 4: Commit**

```bash
cd /Users/gpan/PRIMR/primr-app
git add app/creator/courses/[id]/results/page.tsx app/creator/courses/[id]/results/page.module.css
git commit -m "feat(creator-results): add course drilldown page with learner roster and lesson breakdown"
```

---

## Task 5: Delete `/creator/progress`

**Files:**
- Delete: `app/creator/progress/page.tsx`
- Delete: `app/creator/progress/ProgressDashboard.tsx`
- Delete: `app/creator/progress/ProgressDashboard.module.css`

- [ ] **Step 1: Delete the files**

```bash
cd /Users/gpan/PRIMR/primr-app
rm app/creator/progress/page.tsx
rm app/creator/progress/ProgressDashboard.tsx
rm app/creator/progress/ProgressDashboard.module.css
```

- [ ] **Step 2: Verify tsc passes**

```bash
cd /Users/gpan/PRIMR/primr-app && npx tsc --noEmit
```

Expected: no output (exit 0). If you see errors about missing imports, check that Step 4 of Task 3 removed the Progress nav link from `page.tsx`.

- [ ] **Step 3: Commit**

```bash
cd /Users/gpan/PRIMR/primr-app
git add -A app/creator/progress/
git commit -m "chore(creator-results): delete /creator/progress page now superseded by Results tab"
```
