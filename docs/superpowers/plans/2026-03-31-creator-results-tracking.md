# Creator Results Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give creators visibility into learner performance — a Results tab on the creator dashboard (aggregate stats, activity chart, per-lesson table) plus a per-lesson drilldown page (learner roster + block-by-block breakdown).

**Architecture:** Pure server-rendered (RSC) — no new API routes. Data fetched in `app/creator/page.tsx` (server component) and passed as props to the client `CreatorDashboard`. The per-lesson drilldown is a standalone RSC page. Utility functions for data transformation live in `src/lib/results.ts` and are unit-tested. This matches the pattern already used in `/my-primr`.

**Tech Stack:** Next.js 15 App Router, Drizzle ORM (PostgreSQL), TypeScript, CSS Modules. No new dependencies.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/results.ts` | Create | Pure utilities: `fillDailyActivity`, `computeBlockPerformance` |
| `src/lib/results.test.ts` | Create | Unit tests for the above |
| `app/creator/ResultsTab.tsx` | Create | Client component: renders stat cards, chart, per-lesson table |
| `app/creator/CreatorDashboard.tsx` | Modify | Add Results tab, rename Learning→My Learning, accept `results` prop |
| `app/creator/page.tsx` | Modify | Fetch `ResultsData` server-side, pass to `CreatorDashboard` |
| `app/creator/CreatorDashboard.module.css` | Modify | Add styles: stat cards, chart bars, score bars |
| `app/creator/lessons/[id]/results/page.tsx` | Create | RSC: per-lesson drilldown (learner roster + block breakdown) |
| `app/creator/lessons/[id]/results/page.module.css` | Create | Styles for the drilldown page |

---

## Task 1: Utility functions + tests

**Files:**
- Create: `src/lib/results.ts`
- Create: `src/lib/results.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/results.test.ts`:

```ts
import { fillDailyActivity, computeBlockPerformance } from './results'

// ── fillDailyActivity ────────────────────────────────────────────────────────

describe('fillDailyActivity', () => {
  it('returns N entries for N days', () => {
    const result = fillDailyActivity([], 7)
    expect(result).toHaveLength(7)
  })

  it('returns all zeros when no sparse data', () => {
    const result = fillDailyActivity([], 5)
    expect(result.every(r => r.count === 0)).toBe(true)
  })

  it('fills in counts from sparse data', () => {
    const today = new Date().toISOString().slice(0, 10)
    const result = fillDailyActivity([{ date: today, count: 3 }], 7)
    const todayEntry = result.find(r => r.date === today)
    expect(todayEntry?.count).toBe(3)
  })

  it('ignores sparse entries outside the window', () => {
    const result = fillDailyActivity([{ date: '2000-01-01', count: 99 }], 7)
    expect(result.every(r => r.count === 0)).toBe(true)
  })

  it('dates are in ascending order', () => {
    const result = fillDailyActivity([], 5)
    for (let i = 1; i < result.length; i++) {
      expect(result[i].date > result[i - 1].date).toBe(true)
    }
  })
})

// ── computeBlockPerformance ──────────────────────────────────────────────────

describe('computeBlockPerformance', () => {
  const blocks = [
    { id: 'b1', type: 'quiz', props: { title: 'Q1' } },
    { id: 'b2', type: 'exam', props: {} },
    { id: 'b3', type: 'narrative', props: {} },
  ]

  it('returns only blocks that have results', () => {
    const attempts = [
      { blockResults: { b1: { status: 'correct' } } },
    ]
    const result = computeBlockPerformance(attempts, blocks)
    expect(result).toHaveLength(1)
    expect(result[0].blockId).toBe('b1')
  })

  it('computes pctCorrect from status fields', () => {
    const attempts = [
      { blockResults: { b1: { status: 'correct' } } },
      { blockResults: { b1: { status: 'correct' } } },
      { blockResults: { b1: { status: 'incorrect' } } },
    ]
    const result = computeBlockPerformance(attempts, blocks)
    expect(result[0].pctCorrect).toBeCloseTo(2 / 3)
  })

  it('computes avgScore from score fields', () => {
    const attempts = [
      { blockResults: { b2: { status: 'completed', score: 0.8 } } },
      { blockResults: { b2: { status: 'completed', score: 0.6 } } },
    ]
    const result = computeBlockPerformance(attempts, blocks)
    expect(result[0].avgScore).toBeCloseTo(0.7)
  })

  it('uses block type as label when no title prop', () => {
    const attempts = [{ blockResults: { b2: { status: 'completed', score: 1 } } }]
    const result = computeBlockPerformance(attempts, blocks)
    expect(result[0].label).toBe('exam')
  })

  it('skips attempts with null blockResults', () => {
    const attempts = [
      { blockResults: null },
      { blockResults: { b1: { status: 'correct' } } },
    ]
    const result = computeBlockPerformance(attempts, blocks)
    expect(result[0].responseCount).toBe(1)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/gpan/PRIMR/primr-app && npx jest src/lib/results.test.ts --no-coverage
```

Expected: `Cannot find module './results'`

- [ ] **Step 3: Implement `src/lib/results.ts`**

```ts
export type DailyActivity = { date: string; count: number }

/**
 * Merges sparse DB results (date + count) into a full N-day window, filling
 * missing days with 0. Returns entries in ascending date order.
 */
export function fillDailyActivity(
  sparse: Array<{ date: string; count: number }>,
  days: number,
): DailyActivity[] {
  const now = new Date()
  const sparseMap = new Map(sparse.map(r => [r.date, r.count]))
  const result: DailyActivity[] = []

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const date = d.toISOString().slice(0, 10)
    result.push({ date, count: sparseMap.get(date) ?? 0 })
  }

  return result
}

export type BlockPerf = {
  blockId: string
  blockType: string
  label: string
  responseCount: number
  /** Fraction 0–1 based on correct/incorrect status. Null if no status-based results. */
  pctCorrect: number | null
  /** Average score 0–1 for score-based blocks. Null if no score present. */
  avgScore: number | null
}

/**
 * Aggregates blockResults across attempts into per-block performance stats.
 * Only returns blocks that have at least one result entry.
 */
export function computeBlockPerformance(
  attempts: Array<{ blockResults: Record<string, { status: string; score?: number }> | null }>,
  blocks: Array<{ id: string; type: string; props: Record<string, unknown> }>,
): BlockPerf[] {
  const collected = new Map<string, Array<{ status: string; score?: number }>>()

  for (const attempt of attempts) {
    if (!attempt.blockResults) continue
    for (const [blockId, result] of Object.entries(attempt.blockResults)) {
      if (!collected.has(blockId)) collected.set(blockId, [])
      collected.get(blockId)!.push(result)
    }
  }

  return blocks
    .filter(b => collected.has(b.id))
    .map(b => {
      const results = collected.get(b.id)!
      const withStatus = results.filter(r => r.status === 'correct' || r.status === 'incorrect')
      const withScore = results.filter(r => r.score != null)
      return {
        blockId: b.id,
        blockType: b.type,
        label: (b.props.title as string | undefined) ?? b.type,
        responseCount: results.length,
        pctCorrect: withStatus.length > 0
          ? withStatus.filter(r => r.status === 'correct').length / withStatus.length
          : null,
        avgScore: withScore.length > 0
          ? withScore.reduce((sum, r) => sum + r.score!, 0) / withScore.length
          : null,
      }
    })
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd /Users/gpan/PRIMR/primr-app && npx jest src/lib/results.test.ts --no-coverage
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/gpan/PRIMR/primr-app
git add src/lib/results.ts src/lib/results.test.ts
git commit -m "feat(results): add fillDailyActivity and computeBlockPerformance utilities"
```

---

## Task 2: Add CSS styles for results UI

**Files:**
- Modify: `app/creator/CreatorDashboard.module.css`

- [ ] **Step 1: Append results styles to the end of `CreatorDashboard.module.css`**

```css
/* ── Results tab ─────────────────────────────────────────────────────────── */
.resultsGrid {
  display: flex;
  gap: 10px;
  margin-bottom: 1.5rem;
}

.statCard {
  flex: 1;
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: 10px;
  padding: 14px 18px;
}

.statLabel {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ink-muted);
  margin-bottom: 4px;
}

.statValue {
  font-size: 26px;
  font-weight: 700;
  color: var(--ink);
  line-height: 1;
}

.statSub {
  font-size: 12px;
  color: var(--ink-muted);
  margin-top: 3px;
}

.activityChart {
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: 10px;
  padding: 16px 20px;
  margin-bottom: 1.5rem;
}

.activityChartTitle {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
  margin-bottom: 1rem;
}

.chartBars {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 72px;
}

.chartBarCol {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 1;
}

.chartBar {
  width: 100%;
  border-radius: 3px 3px 0 0;
  background: var(--accent-soft);
  border: 1.5px solid var(--accent);
  min-height: 2px;
  transition: background 120ms;
}

.chartBar:hover {
  background: var(--accent);
}

.chartBarLabel {
  font-size: 9px;
  color: var(--ink-muted);
}

.resultsSectionTitle {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
  margin-bottom: 0.75rem;
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
  background: var(--teal-soft, #e0f5f1);
  color: var(--teal, #0a7c6e);
}

.partialPill {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 20px;
  background: var(--amber-soft, #fef3c7);
  color: var(--amber, #d97706);
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
```

- [ ] **Step 2: Commit**

```bash
cd /Users/gpan/PRIMR/primr-app
git add app/creator/CreatorDashboard.module.css
git commit -m "feat(results): add CSS for results tab UI"
```

---

## Task 3: Build ResultsTab component

**Files:**
- Create: `app/creator/ResultsTab.tsx`

- [ ] **Step 1: Create `app/creator/ResultsTab.tsx`**

```tsx
'use client'

import Link from 'next/link'
import styles from './CreatorDashboard.module.css'

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
  lessonRows: LessonResultRow[]
}

export default function ResultsTab({ results }: { results: ResultsData }) {
  const { totalLearners, startedCount, completedCount, avgScore, lastActivityDate, dailyActivity, lessonRows } = results

  const completionRate = startedCount > 0 ? Math.round((completedCount / startedCount) * 100) : null
  const maxActivity = Math.max(...dailyActivity.map(d => d.count), 1)

  return (
    <div>
      {/* Stat cards */}
      <div className={styles.resultsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total learners</div>
          <div className={styles.statValue}>{totalLearners}</div>
          <div className={styles.statSub}>across all lessons</div>
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
            {lastActivityDate ? new Date(lastActivityDate).toLocaleDateString() : '—'}
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

      {/* Per-lesson table */}
      {lessonRows.length === 0 ? (
        <p className={styles.empty}>No lessons published yet.</p>
      ) : (
        <>
          <div className={styles.resultsSectionTitle}>Results by lesson</div>
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
                const completedFrac = row.invitedCount > 0 ? row.completedCount / row.invitedCount : 0
                const PillComponent = completedFrac >= 0.8
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
                      <span className={PillComponent}>
                        {row.completedCount} / {row.invitedCount}
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

- [ ] **Step 2: Commit**

```bash
cd /Users/gpan/PRIMR/primr-app
git add app/creator/ResultsTab.tsx
git commit -m "feat(results): add ResultsTab component"
```

---

## Task 4: Wire Results tab into CreatorDashboard

**Files:**
- Modify: `app/creator/CreatorDashboard.tsx`

- [ ] **Step 1: Update `CreatorDashboard.tsx`**

Make the following targeted changes to `app/creator/CreatorDashboard.tsx`:

**a) Add import at the top of the file (after existing imports):**
```tsx
import ResultsTab, { type ResultsData } from './ResultsTab'
```

**b) Change the `Tab` type (line ~10):**
```tsx
// Before:
type Tab = 'courses' | 'lessons' | 'learning'

// After:
type Tab = 'courses' | 'lessons' | 'results' | 'learning'
```

**c) Add `results` prop to the component signature:**
```tsx
// Before:
export default function CreatorDashboard({
  courses,
  lessons,
  learner,
}: {
  courses: CourseItem[]
  lessons: LessonItem[]
  learner?: LearnerData
}) {

// After:
export default function CreatorDashboard({
  courses,
  lessons,
  learner,
  results,
}: {
  courses: CourseItem[]
  lessons: LessonItem[]
  learner?: LearnerData
  results?: ResultsData
}) {
```

**d) Update the `allSelected` line to exclude 'results':**
```tsx
// Before:
const allSelected = tab !== 'learning' && items.length > 0 && selected.size === items.length

// After:
const allSelected = tab !== 'learning' && tab !== 'results' && items.length > 0 && selected.size === items.length
```

**e) In the tabs section, add the Results tab button and rename "Learning" → "My Learning". Find the tabs `<div className={styles.tabs}>` block and replace it:**

```tsx
<div className={styles.tabs}>
  <button
    className={`${styles.tab} ${tab === 'lessons' ? styles.tabActive : ''}`}
    onClick={() => setTab('lessons')}
  >
    Lessons
    {lessons.length > 0 && <span className={styles.tabBadge}>{lessons.length}</span>}
  </button>
  <button
    className={`${styles.tab} ${tab === 'courses' ? styles.tabActive : ''}`}
    onClick={() => setTab('courses')}
  >
    Courses
    {courses.length > 0 && <span className={styles.tabBadge}>{courses.length}</span>}
  </button>
  {results && (
    <button
      className={`${styles.tab} ${tab === 'results' ? styles.tabActive : ''}`}
      onClick={() => setTab('results')}
    >
      Results
    </button>
  )}
  {learner && (
    <button
      className={`${styles.tab} ${tab === 'learning' ? styles.tabActive : ''}`}
      onClick={() => setTab('learning')}
      title="Primr lessons I have taken"
    >
      My Learning
      {(learner.courses.length + learner.lessons.length + learner.history.length) > 0 && (
        <span className={styles.tabBadge}>
          {learner.courses.length + learner.lessons.length + learner.history.length}
        </span>
      )}
    </button>
  )}
</div>
```

**f) Add Results tab content rendering. Find the `{/* ── Learning tab ── */}` comment and add the Results tab block directly above it:**

```tsx
{/* ── Results tab ── */}
{tab === 'results' && results && (
  <ResultsTab results={results} />
)}

{/* ── Learning tab ── */}
{tab === 'learning' && learner && (
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/gpan/PRIMR/primr-app && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors (or only pre-existing errors unrelated to this change).

- [ ] **Step 3: Commit**

```bash
cd /Users/gpan/PRIMR/primr-app
git add app/creator/CreatorDashboard.tsx
git commit -m "feat(results): add Results tab and rename Learning to My Learning"
```

---

## Task 5: Fetch results data in page.tsx

**Files:**
- Modify: `app/creator/page.tsx`

- [ ] **Step 1: Add `fillDailyActivity` import to `app/creator/page.tsx`**

At the top of the file, add to the existing imports:
```tsx
import { fillDailyActivity } from '@/lib/results'
import type { ResultsData } from './ResultsTab'
```

Also add `gte` to the drizzle-orm imports (the file already imports from `drizzle-orm`):
```tsx
// Before (existing line):
import { desc, eq, and, sql, inArray, max, isNull } from 'drizzle-orm'

// After:
import { desc, eq, and, sql, inArray, max, isNull, gte } from 'drizzle-orm'
```

- [ ] **Step 2: Add results data queries inside `DashboardPage`**

Find the section `// ── Creator: standalone lessons (not attached to any course) ──` and, after the `createdLessons` query block, add:

```tsx
// ── Creator: results data ─────────────────────────────────────────────────
let resultsData: ResultsData | undefined

if (isCreator && createdLessons.length > 0) {
  const createdLessonIds = createdLessons.map(l => l.id)

  // Per-lesson: invited counts
  const invitedRows = await db
    .select({
      lessonId: lessonInvitations.lessonId,
      count: sql<number>`count(*)::int`,
    })
    .from(lessonInvitations)
    .where(inArray(lessonInvitations.lessonId, createdLessonIds))
    .groupBy(lessonInvitations.lessonId)

  const invitedMap = new Map(invitedRows.map(r => [r.lessonId, r.count]))

  // Per-lesson: attempt stats (distinct users)
  const attemptStatRows = await db
    .select({
      lessonId: lessonAttempts.lessonId,
      startedCount: sql<number>`count(distinct ${lessonAttempts.userId})::int`,
      completedCount: sql<number>`count(distinct case when ${lessonAttempts.status} = 'completed' then ${lessonAttempts.userId} end)::int`,
      avgScore: sql<number | null>`avg(case when ${lessonAttempts.status} = 'completed' and ${lessonAttempts.score} is not null then ${lessonAttempts.score} end)`,
    })
    .from(lessonAttempts)
    .where(inArray(lessonAttempts.lessonId, createdLessonIds))
    .groupBy(lessonAttempts.lessonId)

  const attemptStatMap = new Map(attemptStatRows.map(r => [r.lessonId, r]))

  // Aggregate totals
  const totalLearners = new Set(
    attemptStatRows.flatMap(() => []) // placeholder — computed below
  ).size

  // Distinct learner count across all lessons
  const totalLearnersRow = await db
    .select({ count: sql<number>`count(distinct ${lessonAttempts.userId})::int` })
    .from(lessonAttempts)
    .where(inArray(lessonAttempts.lessonId, createdLessonIds))

  const overallStarted = attemptStatRows.reduce((sum, r) => sum + r.startedCount, 0)
  const overallCompleted = attemptStatRows.reduce((sum, r) => sum + r.completedCount, 0)

  // Overall avg score across all completed attempts
  const overallScoreRow = await db
    .select({
      avgScore: sql<number | null>`avg(${lessonAttempts.score})`,
      lastActivity: sql<string | null>`max(${lessonAttempts.completedAt})::text`,
    })
    .from(lessonAttempts)
    .where(and(
      inArray(lessonAttempts.lessonId, createdLessonIds),
      eq(lessonAttempts.status, 'completed'),
    ))

  // Daily activity: completed attempts per day for last 30 days
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const dailyRows = await db
    .select({
      date: sql<string>`date(${lessonAttempts.completedAt})::text`,
      count: sql<number>`count(*)::int`,
    })
    .from(lessonAttempts)
    .where(and(
      inArray(lessonAttempts.lessonId, createdLessonIds),
      eq(lessonAttempts.status, 'completed'),
      gte(lessonAttempts.completedAt, thirtyDaysAgo),
    ))
    .groupBy(sql`date(${lessonAttempts.completedAt})`)

  resultsData = {
    totalLearners: totalLearnersRow[0]?.count ?? 0,
    startedCount: overallStarted,
    completedCount: overallCompleted,
    avgScore: overallScoreRow[0]?.avgScore ?? null,
    lastActivityDate: overallScoreRow[0]?.lastActivity ?? null,
    dailyActivity: fillDailyActivity(dailyRows, 30),
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

- [ ] **Step 3: Pass `results` prop to `CreatorDashboard`**

Find the `<CreatorDashboard` JSX and add the `results` prop:

```tsx
<CreatorDashboard
  courses={createdCourses.map(c => ({ ... }))}  // existing
  lessons={createdLessons.map(l => ({ ... }))}  // existing
  learner={{ ... }}                              // existing
  results={resultsData}
/>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/gpan/PRIMR/primr-app && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 5: Smoke test in the browser**

```bash
cd /Users/gpan/PRIMR/primr-app && npm run dev
```

Navigate to `http://localhost:3000/creator` as a creator account. Verify:
- "Results" tab appears between Courses and My Learning
- "Learning" tab is now labeled "My Learning" with a tooltip on hover
- Clicking Results shows the stat cards, chart, and per-lesson table

- [ ] **Step 6: Commit**

```bash
cd /Users/gpan/PRIMR/primr-app
git add app/creator/page.tsx
git commit -m "feat(results): fetch and pass results data to creator dashboard"
```

---

## Task 6: Per-lesson results drilldown page

**Files:**
- Create: `app/creator/lessons/[id]/results/page.tsx`
- Create: `app/creator/lessons/[id]/results/page.module.css`

- [ ] **Step 1: Create the CSS module**

Create `app/creator/lessons/[id]/results/page.module.css`:

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

.sectionSubtitle {
  font-size: 12px;
  font-weight: 400;
  color: var(--ink-muted);
  margin-left: 6px;
}

/* Data table */
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
.learnerEmail { font-size: 12px; color: var(--ink-muted); margin-top: 1px; }

.completedPill {
  display: inline-block;
  font-size: 11px; font-weight: 600;
  padding: 2px 8px; border-radius: 20px;
  background: var(--teal-soft, #e0f5f1);
  color: var(--teal, #0a7c6e);
}

.inProgressPill {
  display: inline-block;
  font-size: 11px; font-weight: 600;
  padding: 2px 8px; border-radius: 20px;
  background: var(--amber-soft, #fef3c7);
  color: var(--amber, #d97706);
}

.notStartedPill {
  display: inline-block;
  font-size: 11px; font-weight: 600;
  padding: 2px 8px; border-radius: 20px;
  background: var(--surface-alt);
  color: var(--ink-muted);
  border: 1px solid var(--border);
}

.scoreBarWrap { display: flex; align-items: center; gap: 8px; }
.scoreBarTrack {
  flex: 1; height: 6px;
  background: var(--surface-alt);
  border: 1px solid var(--border);
  border-radius: 3px; overflow: hidden;
  min-width: 60px;
}
.scoreBarFill { height: 100%; border-radius: 3px; background: var(--accent); }
.scorePct { font-size: 12px; font-weight: 600; color: var(--ink-soft); min-width: 32px; text-align: right; }

.muted { color: var(--ink-muted); }

/* Block breakdown */
.blockList { display: flex; flex-direction: column; gap: 8px; }

.blockRow {
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: 10px;
  padding: 14px 18px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.blockIcon {
  width: 32px; height: 32px;
  border-radius: 8px;
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 15px;
  background: var(--accent-soft);
}

.blockBody { flex: 1; min-width: 0; }
.blockName { font-size: 13px; font-weight: 600; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.blockType { font-size: 11px; color: var(--ink-muted); margin-top: 2px; }

.blockBarWrap { flex: 1; max-width: 160px; }
.blockBarTrack { height: 8px; background: var(--surface-alt); border: 1px solid var(--border); border-radius: 4px; overflow: hidden; }
.blockBarFill { height: 100%; border-radius: 4px; background: var(--accent); }
.blockBarFillLow { height: 100%; border-radius: 4px; background: var(--coral, #e05a44); }
.blockBarN { font-size: 11px; color: var(--ink-muted); margin-top: 4px; text-align: right; }

.blockStat { flex-shrink: 0; text-align: right; min-width: 52px; }
.blockPct { font-size: 18px; font-weight: 700; color: var(--teal, #0a7c6e); }
.blockPctLow { font-size: 18px; font-weight: 700; color: var(--coral, #e05a44); }
.blockPctLabel { font-size: 11px; color: var(--ink-muted); }
```

- [ ] **Step 2: Create `app/creator/lessons/[id]/results/page.tsx`**

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/db'
import { lessons, lessonAttempts, lessonInvitations, users } from '@/db/schema'
import { eq, desc, and, inArray } from 'drizzle-orm'
import { getSession } from '@/session'
import { computeBlockPerformance } from '@/lib/results'
import { UserMenu } from '../../../../components/UserMenu'
import styles from './page.module.css'

export const dynamic = 'force-dynamic'

const PASS_THRESHOLD = 0.70

export default async function LessonResultsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getSession()
  if (!session?.user?.id) notFound()

  const lesson = await db.query.lessons.findFirst({
    where: eq(lessons.id, id),
  })

  if (!lesson || lesson.createdBy !== session.user.id) notFound()

  // Invited emails
  const invitations = await db
    .select({ email: lessonInvitations.email })
    .from(lessonInvitations)
    .where(eq(lessonInvitations.lessonId, id))

  const invitedEmails = invitations.map(i => i.email.toLowerCase())

  // All attempts for this lesson, joined with user info
  const attemptRows = await db
    .select({
      userId: lessonAttempts.userId,
      email: users.email,
      name: users.name,
      status: lessonAttempts.status,
      score: lessonAttempts.score,
      blockResults: lessonAttempts.blockResults,
      startedAt: lessonAttempts.startedAt,
      completedAt: lessonAttempts.completedAt,
    })
    .from(lessonAttempts)
    .innerJoin(users, eq(users.id, lessonAttempts.userId))
    .where(eq(lessonAttempts.lessonId, id))
    .orderBy(desc(lessonAttempts.startedAt))

  // Build per-user summary (best completed attempt per user)
  const userMap = new Map<string, {
    userId: string
    email: string
    name: string | null
    attemptCount: number
    bestScore: number | null
    status: 'completed' | 'in_progress' | 'not_started'
    lastActiveAt: Date
  }>()

  for (const row of attemptRows) {
    const existing = userMap.get(row.userId)
    if (!existing) {
      userMap.set(row.userId, {
        userId: row.userId,
        email: row.email,
        name: row.name,
        attemptCount: 1,
        bestScore: row.status === 'completed' ? (row.score ?? null) : null,
        status: row.status === 'completed' ? 'completed' : 'in_progress',
        lastActiveAt: row.startedAt,
      })
    } else {
      existing.attemptCount++
      if (row.status === 'completed') {
        existing.status = 'completed'
        if (row.score != null && (existing.bestScore == null || row.score > existing.bestScore)) {
          existing.bestScore = row.score
        }
      }
      if (row.startedAt > existing.lastActiveAt) {
        existing.lastActiveAt = row.startedAt
      }
    }
  }

  // Users who were invited but never attempted
  const attemptedEmails = new Set([...userMap.values()].map(u => u.email.toLowerCase()))
  const notStartedEmails = invitedEmails.filter(e => !attemptedEmails.has(e))

  // Build roster (completed first by score desc, then in_progress, then not started)
  const rosterAttempted = [...userMap.values()].sort((a, b) => {
    if (a.status === 'completed' && b.status !== 'completed') return -1
    if (b.status === 'completed' && a.status !== 'completed') return 1
    if (a.status === 'completed' && b.status === 'completed') {
      return (b.bestScore ?? 0) - (a.bestScore ?? 0)
    }
    return 0
  })

  // Stats
  const startedCount = userMap.size
  const completedUsers = [...userMap.values()].filter(u => u.status === 'completed')
  const completedCount = completedUsers.length
  const completedScores = completedUsers.map(u => u.bestScore).filter((s): s is number => s != null)
  const avgScore = completedScores.length > 0
    ? completedScores.reduce((a, b) => a + b, 0) / completedScores.length
    : null
  const passCount = completedScores.filter(s => s >= PASS_THRESHOLD).length
  const passRate = completedScores.length > 0 ? passCount / completedScores.length : null

  // Block performance from completed attempts only
  const completedAttempts = attemptRows.filter(r => r.status === 'completed')
  const blockPerf = computeBlockPerformance(completedAttempts, lesson.manifest.blocks)

  const metaParts = [
    lesson.publishedAt ? 'Published' : 'Draft',
    lesson.examEnforced ? 'Exam enforced' : null,
    `${invitedEmails.length} invited`,
  ].filter(Boolean).join(' · ')

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

      <Link href="/creator" className={styles.backLink}>← Results</Link>

      <h1 className={styles.pageTitle}>{lesson.title}</h1>
      <p className={styles.pageMeta}>{metaParts}</p>

      {/* Stat strip */}
      <div className={styles.statStrip}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Started</div>
          <div className={styles.statValue}>{startedCount}</div>
          <div className={styles.statSub}>of {invitedEmails.length} invited</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Completed</div>
          <div className={styles.statValue}>{completedCount}</div>
          <div className={styles.statSub}>
            {startedCount > 0 ? `${Math.round((completedCount / startedCount) * 100)}% completion` : 'no attempts yet'}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Avg score</div>
          <div className={styles.statValue}>{avgScore != null ? `${Math.round(avgScore * 100)}%` : '—'}</div>
          <div className={styles.statSub}>completed attempts only</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Pass rate</div>
          <div className={styles.statValue}>{passRate != null ? `${Math.round(passRate * 100)}%` : '—'}</div>
          <div className={styles.statSub}>≥ {Math.round(PASS_THRESHOLD * 100)}% = pass</div>
        </div>
      </div>

      {/* Learner roster */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Learner roster</div>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>Learner</th>
              <th>Status</th>
              <th>Score</th>
              <th>Attempts</th>
              <th>Last active</th>
            </tr>
          </thead>
          <tbody>
            {rosterAttempted.map(u => (
              <tr key={u.userId}>
                <td>
                  <div className={styles.learnerName}>{u.name ?? u.email}</div>
                  {u.name && <div className={styles.learnerEmail}>{u.email}</div>}
                </td>
                <td>
                  <span className={u.status === 'completed' ? styles.completedPill : styles.inProgressPill}>
                    {u.status === 'completed' ? 'Completed' : 'In progress'}
                  </span>
                </td>
                <td>
                  {u.bestScore != null ? (
                    <div className={styles.scoreBarWrap}>
                      <div className={styles.scoreBarTrack}>
                        <div className={styles.scoreBarFill} style={{ width: `${Math.round(u.bestScore * 100)}%` }} />
                      </div>
                      <span className={styles.scorePct}>{Math.round(u.bestScore * 100)}%</span>
                    </div>
                  ) : (
                    <span className={styles.muted}>—</span>
                  )}
                </td>
                <td className={styles.muted}>{u.attemptCount}</td>
                <td className={styles.muted}>{u.lastActiveAt.toLocaleDateString()}</td>
              </tr>
            ))}
            {notStartedEmails.map(email => (
              <tr key={email}>
                <td>
                  <div className={styles.learnerName}>{email}</div>
                </td>
                <td><span className={styles.notStartedPill}>Not started</span></td>
                <td><span className={styles.muted}>—</span></td>
                <td className={styles.muted}>0</td>
                <td className={styles.muted}>—</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Block performance */}
      {blockPerf.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            Block performance
            <span className={styles.sectionSubtitle}>(scored blocks · completed attempts only)</span>
          </div>
          <div className={styles.blockList}>
            {blockPerf.map(block => {
              const displayPct = block.pctCorrect != null
                ? Math.round(block.pctCorrect * 100)
                : block.avgScore != null
                  ? Math.round(block.avgScore * 100)
                  : null

              const isLow = displayPct != null && displayPct < 75

              return (
                <div key={block.blockId} className={styles.blockRow}>
                  <div className={styles.blockIcon}>
                    {block.blockType === 'exam' ? '📝' : '🧠'}
                  </div>
                  <div className={styles.blockBody}>
                    <div className={styles.blockName}>{block.label}</div>
                    <div className={styles.blockType}>
                      {block.blockType} · {block.responseCount} response{block.responseCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className={styles.blockBarWrap}>
                    <div className={styles.blockBarTrack}>
                      {displayPct != null && (
                        <div
                          className={isLow ? styles.blockBarFillLow : styles.blockBarFill}
                          style={{ width: `${displayPct}%` }}
                        />
                      )}
                    </div>
                    <div className={styles.blockBarN}>
                      {block.pctCorrect != null ? `${displayPct}% correct` : block.avgScore != null ? `${displayPct}% avg` : '—'}
                    </div>
                  </div>
                  <div className={styles.blockStat}>
                    {displayPct != null ? (
                      <>
                        <div className={isLow ? styles.blockPctLow : styles.blockPct}>{displayPct}%</div>
                        <div className={styles.blockPctLabel}>{block.pctCorrect != null ? 'correct' : 'avg score'}</div>
                      </>
                    ) : (
                      <span className={styles.muted}>—</span>
                    )}
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

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/gpan/PRIMR/primr-app && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Smoke test the drilldown**

With the dev server running (`npm run dev`), navigate to `/creator` as a creator. Click "Results" tab, then "View results →" on any lesson with data. Verify:
- Page loads with correct lesson title and metadata
- Learner roster shows invited learners with correct status
- Block performance section appears if the lesson has scored blocks
- "Not started" rows appear for invited learners who haven't attempted

- [ ] **Step 5: Commit**

```bash
cd /Users/gpan/PRIMR/primr-app
git add app/creator/lessons/[id]/results/page.tsx app/creator/lessons/[id]/results/page.module.css
git commit -m "feat(results): add per-lesson drilldown page"
```

---

## Done

At this point the feature is complete:
- ✅ Results tab on creator dashboard (stat cards, activity chart, per-lesson table)
- ✅ "Learning" tab renamed to "My Learning" with tooltip
- ✅ Per-lesson drilldown at `/creator/lessons/[id]/results`
- ✅ Utility functions unit tested
