# Learner→Creator Feedback System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a hybrid feedback loop — per-block flagging during lessons + end-of-lesson star rating — surfacing anonymized learner feedback to creators in their results pages.

**Architecture:** `primr-components` gains an optional `onBlockFlag` prop on `LessonRenderer` that renders a flag button + inline form in the lesson footer. `primr-app`'s `LessonPlayer` accumulates flags, shows a feedback rating overlay after lesson completion, then writes a single `lessonFeedback` row via a new API route. Creator analytics pages gain a feedback summary bar and block flags panel.

**Tech Stack:** Drizzle ORM + PostgreSQL (new `lesson_feedback` table), Next.js App Router API route, React useState/useCallback in LessonPlayer, Vitest + React Testing Library for `primr-components` tests.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `primr-app/src/db/schema.ts` | Modify | Add `lessonFeedback` table + types |
| `primr-app/app/api/lessons/[id]/feedback/route.ts` | Create | POST endpoint — validate + write feedback row |
| `primr-components/src/components/LessonRenderer/LessonRenderer.tsx` | Modify | `onBlockFlag` prop, flag button, inline form, flagged-set state |
| `primr-components/src/components/LessonRenderer/LessonRenderer.module.css` | Modify | `.flagBtn`, `.flagBtnDone`, `.flagForm`, `.flagFormActions`, `.flagFormTextarea` |
| `primr-components/src/components/LessonRenderer/LessonRenderer.flag.test.tsx` | Create | Tests for flag button and inline form |
| `primr-app/app/learn/[id]/LessonPlayer.tsx` | Modify | `pendingFlags` state, `phase` state machine, `onBlockFlag` handler, feedback overlay wiring |
| `primr-app/app/learn/[id]/FeedbackOverlay.tsx` | Create | Rating screen UI — star widget, comment textarea, submit/skip |
| `primr-app/app/learn/[id]/FeedbackOverlay.module.css` | Create | Overlay + star widget styles |
| `primr-app/app/creator/lessons/[id]/results/page.tsx` | Modify | Feedback summary bar + block flags panel |
| `primr-app/app/creator/page.tsx` | Modify | `ratingRows` query + `avgRating` in `lessonRows` |
| `primr-app/app/creator/ResultsTab.tsx` | Modify | `avgRating` on `LessonResultRow` + Rating column in standalone lessons table |

---

## Task 1: `lessonFeedback` DB Table

**Files:**
- Modify: `primr-app/src/db/schema.ts`

- [ ] **Step 1: Add `smallint` to the Drizzle import**

In `src/db/schema.ts`, line 1, change:
```ts
import { pgTable, pgEnum, text, jsonb, timestamp, uuid, real, integer, boolean, unique } from 'drizzle-orm/pg-core'
```
to:
```ts
import { pgTable, pgEnum, text, jsonb, timestamp, uuid, real, integer, smallint, boolean, unique } from 'drizzle-orm/pg-core'
```

- [ ] **Step 2: Append `lessonFeedback` table after `lessonInviteLinks`**

Add after `export type NewLessonInviteLink = typeof lessonInviteLinks.$inferInsert` (around line 107):

```ts
// ── Lesson Feedback ───────────────────────────────────────────────────────────
export const lessonFeedback = pgTable('lesson_feedback', {
  id:          uuid('id').primaryKey().defaultRandom(),
  lessonId:    uuid('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }),
  attemptId:   uuid('attempt_id').notNull().references(() => lessonAttempts.id, { onDelete: 'cascade' }).unique(),
  rating:      smallint('rating'),
  comment:     text('comment'),
  blockFlags:  jsonb('block_flags').$type<Array<{ blockId: string; comment: string }>>().notNull().default([]),
  submittedAt: timestamp('submitted_at').notNull().defaultNow(),
})

export type LessonFeedback = typeof lessonFeedback.$inferSelect
export type NewLessonFeedback = typeof lessonFeedback.$inferInsert
```

- [ ] **Step 3: Generate and apply the migration**

```bash
cd primr-app
npm run db:generate
npm run db:migrate
```

Expected: new migration file in `drizzle/` directory; migration applies cleanly.

- [ ] **Step 4: Commit**

```bash
cd primr-app
git add src/db/schema.ts drizzle/
git commit -m "feat: add lesson_feedback table to schema"
```

---

## Task 2: POST `/api/lessons/[id]/feedback` Route

**Files:**
- Create: `primr-app/app/api/lessons/[id]/feedback/route.ts`

- [ ] **Step 1: Create the route file**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { lessons, lessonAttempts, lessonFeedback } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { getSession } from '@/session'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: lessonId } = await params

  // Verify lesson exists and is accessible
  const lesson = await db.query.lessons.findFirst({
    where: eq(lessons.id, lessonId),
  })
  if (!lesson) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await req.json() as {
    attemptId: string
    rating?: number
    comment?: string
    blockFlags?: Array<{ blockId: string; comment: string }>
  }

  const { attemptId, rating, comment, blockFlags = [] } = body

  // Validate attemptId belongs to this user and this lesson
  const attempt = await db.query.lessonAttempts.findFirst({
    where: and(
      eq(lessonAttempts.id, attemptId),
      eq(lessonAttempts.userId, session.user.id),
      eq(lessonAttempts.lessonId, lessonId),
    ),
  })
  if (!attempt) {
    return NextResponse.json({ error: 'Invalid attempt' }, { status: 403 })
  }

  // Validate rating if provided
  if (rating !== undefined && (rating < 1 || rating > 5 || !Number.isInteger(rating))) {
    return NextResponse.json({ error: 'Rating must be 1–5' }, { status: 400 })
  }

  // Upsert: one feedback row per attempt (unique constraint on attemptId)
  try {
    const [row] = await db
      .insert(lessonFeedback)
      .values({
        lessonId,
        attemptId,
        rating: rating ?? null,
        comment: comment ?? null,
        blockFlags,
      })
      .onConflictDoNothing()
      .returning({ id: lessonFeedback.id })

    if (!row) {
      // Duplicate — already submitted
      return NextResponse.json({ error: 'Feedback already submitted' }, { status: 409 })
    }

    return NextResponse.json({ id: row.id })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd primr-app
git add "app/api/lessons/[id]/feedback/route.ts"
git commit -m "feat: add POST /api/lessons/[id]/feedback route"
```

---

## Task 3: LessonRenderer `onBlockFlag` Prop + Flag Button + Tests

**Files:**
- Modify: `primr-components/src/components/LessonRenderer/LessonRenderer.tsx`
- Modify: `primr-components/src/components/LessonRenderer/LessonRenderer.module.css`
- Create: `primr-components/src/components/LessonRenderer/LessonRenderer.flag.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/LessonRenderer/LessonRenderer.flag.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { LessonRenderer } from './LessonRenderer'
import type { LessonManifest } from '../../types'

const manifest: LessonManifest = {
  id: 'flag-test',
  title: 'Flag Test Lesson',
  slug: 'flag-test-lesson',
  blocks: [
    { id: 'b1', type: 'narrative', props: { title: 'Block One', body: 'Some text here.' } },
    { id: 'b2', type: 'narrative', props: { title: 'Block Two', body: 'More text.' } },
  ],
}

describe('LessonRenderer flag button', () => {
  it('does not show flag button when onBlockFlag is not provided', () => {
    render(<LessonRenderer manifest={manifest} />)
    expect(screen.queryByRole('button', { name: /flag this section/i })).not.toBeInTheDocument()
  })

  it('shows flag button when onBlockFlag is provided and block has text', () => {
    render(<LessonRenderer manifest={manifest} onBlockFlag={vi.fn()} />)
    expect(screen.getByRole('button', { name: /flag this section/i })).toBeInTheDocument()
  })

  it('does not show flag button for silent block types (media)', () => {
    const mediaManifest: LessonManifest = {
      ...manifest,
      blocks: [{ id: 'm1', type: 'media', props: { url: 'https://example.com/v.mp4' } }],
    }
    render(<LessonRenderer manifest={mediaManifest} onBlockFlag={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /flag this section/i })).not.toBeInTheDocument()
  })

  it('clicking flag button opens inline form', () => {
    render(<LessonRenderer manifest={manifest} onBlockFlag={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /flag this section/i }))
    expect(screen.getByRole('textbox', { name: /what was unclear/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('cancel closes the form without calling onBlockFlag', () => {
    const onBlockFlag = vi.fn()
    render(<LessonRenderer manifest={manifest} onBlockFlag={onBlockFlag} />)
    fireEvent.click(screen.getByRole('button', { name: /flag this section/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('textbox', { name: /what was unclear/i })).not.toBeInTheDocument()
    expect(onBlockFlag).not.toHaveBeenCalled()
  })

  it('submitting calls onBlockFlag with blockId and comment', () => {
    const onBlockFlag = vi.fn()
    render(<LessonRenderer manifest={manifest} onBlockFlag={onBlockFlag} />)
    fireEvent.click(screen.getByRole('button', { name: /flag this section/i }))
    fireEvent.change(screen.getByRole('textbox', { name: /what was unclear/i }), {
      target: { value: 'This confused me' },
    })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    expect(onBlockFlag).toHaveBeenCalledWith('b1', 'This confused me')
  })

  it('submitting closes the form and shows flagged indicator', () => {
    const onBlockFlag = vi.fn()
    render(<LessonRenderer manifest={manifest} onBlockFlag={onBlockFlag} />)
    fireEvent.click(screen.getByRole('button', { name: /flag this section/i }))
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    expect(screen.queryByRole('textbox', { name: /what was unclear/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /flagged/i })).toBeInTheDocument()
  })

  it('flagged block button is disabled (cannot flag twice)', () => {
    render(<LessonRenderer manifest={manifest} onBlockFlag={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /flag this section/i }))
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    expect(screen.getByRole('button', { name: /flagged/i })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd primr-components
npx vitest run src/components/LessonRenderer/LessonRenderer.flag.test.tsx
```

Expected: all 8 tests FAIL (flag button does not exist yet).

- [ ] **Step 3: Add `onBlockFlag` prop and flag state to `LessonRenderer.tsx`**

In `LessonRendererProps` interface (after `examEnforced?`), add:
```ts
/**
 * When provided, a "Flag this section" button appears in the lesson footer
 * for blocks with readable text. Called with the block's id and the learner's comment.
 */
onBlockFlag?: (blockId: string, comment: string) => void
```

In the function signature, destructure the new prop:
```ts
export function LessonRenderer({ manifest, preview = false, adminMode = false, mode, chrome, onLessonComplete, examEnforced = true, onBlockFlag }: LessonRendererProps) {
```

After the `// ── TTS ───` section (around line 303), add the flag state:
```ts
// ── Block flagging ────────────────────────────────────────────────────────────
const [flaggedBlocks, setFlaggedBlocks] = useState<Set<string>>(() => new Set())
const [flagFormOpen, setFlagFormOpen] = useState(false)
const [flagComment, setFlagComment] = useState('')

// Close flag form when navigating to a new block
useEffect(() => {
  setFlagFormOpen(false)
  setFlagComment('')
}, [currentIndex])

const handleFlagClick = useCallback(() => {
  setFlagFormOpen(true)
}, [])

const handleFlagSubmit = useCallback(() => {
  if (!currentBlock) return
  onBlockFlag?.(currentBlock.id, flagComment)
  setFlaggedBlocks(prev => new Set(prev).add(currentBlock.id))
  setFlagFormOpen(false)
  setFlagComment('')
}, [currentBlock, onBlockFlag, flagComment])
```

- [ ] **Step 4: Add flag button and inline form to the interactive mode footer**

Find the interactive mode footer (inside `!lessonDone && <div className={styles.footer}>`). Replace:
```tsx
{!lessonDone && (
  <div className={styles.footer}>
    {currentIndex > 0 && (
      <button className={styles.backBtn} onClick={handleBack} aria-label="Go to previous section">
        ← Back
      </button>
    )}
    <div className={styles.footerRight}>
```
with:
```tsx
{!lessonDone && (
  <>
    <div className={styles.footer}>
      {onBlockFlag && ttsText && (
        <button
          className={[styles.flagBtn, flaggedBlocks.has(currentBlock?.id ?? '') ? styles.flagBtnDone : ''].filter(Boolean).join(' ')}
          onClick={handleFlagClick}
          disabled={flaggedBlocks.has(currentBlock?.id ?? '')}
          aria-label={flaggedBlocks.has(currentBlock?.id ?? '') ? 'Section flagged' : 'Flag this section as unclear'}
        >
          {flaggedBlocks.has(currentBlock?.id ?? '') ? '✓ Flagged' : 'Flag this section'}
        </button>
      )}
      {currentIndex > 0 && (
        <button className={styles.backBtn} onClick={handleBack} aria-label="Go to previous section">
          ← Back
        </button>
      )}
      <div className={styles.footerRight}>
```

And close the outer fragment after the footer's closing `</div>`:

Replace (the closing of the `!lessonDone` block):
```tsx
            </div>
          )}
```
with:
```tsx
            </div>
    {flagFormOpen && (
      <div className={styles.flagForm}>
        <textarea
          className={styles.flagFormTextarea}
          aria-label="What was unclear?"
          placeholder="What was unclear? (optional)"
          value={flagComment}
          onChange={e => setFlagComment(e.target.value)}
          rows={3}
        />
        <div className={styles.flagFormActions}>
          <button className={styles.flagSubmitBtn} onClick={handleFlagSubmit}>Submit</button>
          <button className={styles.flagCancelBtn} onClick={() => { setFlagFormOpen(false); setFlagComment('') }}>Cancel</button>
        </div>
      </div>
    )}
  </>
)}
```

- [ ] **Step 5: Add CSS for flag button and form**

Append to `LessonRenderer.module.css`:

```css
/* ── Flag button ── */
.flagBtn {
  display: inline-flex; align-items: center;
  padding: 0 0.75rem; height: 32px;
  border: 0.5px solid var(--border-mid); border-radius: 6px;
  background: transparent; color: var(--ink-muted);
  font-size: 12px; cursor: pointer; flex-shrink: 0;
  transition: color 150ms, border-color 150ms;
}
.flagBtn:hover { color: var(--color-amber); border-color: var(--color-amber); }
.flagBtnDone {
  color: var(--color-teal); border-color: var(--color-teal);
  cursor: default;
}
.flagBtnDone:hover { color: var(--color-teal); border-color: var(--color-teal); }

/* ── Flag inline form ── */
.flagForm {
  padding: 0.75rem 1.5rem 1rem;
  border-top: 1px solid var(--border-mid);
  background: var(--surface-raised, #fafafa);
  display: flex; flex-direction: column; gap: 0.5rem;
}
.flagFormTextarea {
  width: 100%; resize: vertical;
  border: 0.5px solid var(--border-mid); border-radius: 6px;
  padding: 0.5rem 0.75rem;
  font-family: DM Sans, system-ui, sans-serif; font-size: 13px;
  background: var(--surface); color: var(--color-ink);
  box-sizing: border-box;
}
.flagFormTextarea:focus { outline: 2px solid var(--color-teal); outline-offset: 1px; }
.flagFormActions {
  display: flex; gap: 0.5rem;
}
.flagSubmitBtn {
  padding: 0.35rem 1rem; border-radius: 6px;
  background: var(--color-teal); color: #fff;
  border: none; font-size: 13px; cursor: pointer;
}
.flagSubmitBtn:hover { opacity: 0.9; }
.flagCancelBtn {
  padding: 0.35rem 0.75rem; border-radius: 6px;
  background: transparent; color: var(--ink-muted);
  border: 0.5px solid var(--border-mid); font-size: 13px; cursor: pointer;
}
.flagCancelBtn:hover { border-color: var(--color-ink); color: var(--color-ink); }
```

- [ ] **Step 6: Run tests to confirm they pass**

```bash
cd primr-components
npx vitest run src/components/LessonRenderer/LessonRenderer.flag.test.tsx
```

Expected: all 8 tests PASS.

- [ ] **Step 7: Typecheck**

```bash
cd primr-components
npm run typecheck
```

Expected: no errors.

- [ ] **Step 8: Run full test suite**

```bash
cd primr-components
npm test
```

Expected: existing tests still pass; 8 new flag tests pass.

- [ ] **Step 9: Commit**

```bash
cd primr-components
git add src/components/LessonRenderer/LessonRenderer.tsx \
        src/components/LessonRenderer/LessonRenderer.module.css \
        src/components/LessonRenderer/LessonRenderer.flag.test.tsx
git commit -m "feat: add onBlockFlag prop and inline flag form to LessonRenderer"
```

---

## Task 4: LessonPlayer Feedback Screen

**Files:**
- Modify: `primr-app/app/learn/[id]/LessonPlayer.tsx`
- Create: `primr-app/app/learn/[id]/FeedbackOverlay.tsx`
- Create: `primr-app/app/learn/[id]/FeedbackOverlay.module.css`

- [ ] **Step 1: Create `FeedbackOverlay.tsx`**

Create `app/learn/[id]/FeedbackOverlay.tsx`:

```tsx
'use client'

import { useState } from 'react'
import styles from './FeedbackOverlay.module.css'

interface FeedbackOverlayProps {
  onDone: (rating: number | null, comment: string) => void
}

export function FeedbackOverlay({ onDone }: FeedbackOverlayProps) {
  const [rating, setRating] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [hovered, setHovered] = useState<number | null>(null)

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <h2 className={styles.heading}>Before you go — how was this lesson?</h2>

        <div className={styles.stars} role="group" aria-label="Rate this lesson">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              type="button"
              className={[
                styles.star,
                (hovered ?? rating ?? 0) >= star ? styles.starActive : '',
              ].filter(Boolean).join(' ')}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(null)}
              aria-label={`${star} star${star !== 1 ? 's' : ''}`}
              aria-pressed={rating === star}
            >
              ★
            </button>
          ))}
        </div>

        <textarea
          className={styles.comment}
          placeholder="Anything else to share? (optional)"
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={3}
          aria-label="Additional comments"
        />

        <div className={styles.actions}>
          <button
            className={styles.submitBtn}
            onClick={() => onDone(rating, comment)}
          >
            Submit feedback
          </button>
          <button
            className={styles.skipBtn}
            onClick={() => onDone(null, '')}
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `FeedbackOverlay.module.css`**

Create `app/learn/[id]/FeedbackOverlay.module.css`:

```css
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 17, 23, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 1.5rem;
  animation: fadeIn 200ms ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.card {
  background: var(--surface, #fff);
  border-radius: 12px;
  padding: 2rem;
  max-width: 420px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
}

.heading {
  font-family: 'DM Serif Display', serif;
  font-size: 20px;
  font-weight: 400;
  color: var(--color-ink, #0f1117);
  margin: 0;
  line-height: 1.3;
}

.stars {
  display: flex;
  gap: 0.25rem;
}

.star {
  font-size: 28px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  color: var(--border-mid, #ddd);
  line-height: 1;
  transition: color 120ms, transform 80ms;
}

.star:hover {
  transform: scale(1.15);
}

.starActive {
  color: var(--color-amber, #e2a800);
}

.comment {
  width: 100%;
  border: 0.5px solid var(--border-mid, #ddd);
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  font-family: DM Sans, system-ui, sans-serif;
  font-size: 13px;
  resize: vertical;
  background: var(--surface, #fff);
  color: var(--color-ink, #0f1117);
  box-sizing: border-box;
}

.comment:focus {
  outline: 2px solid var(--color-teal, #2bbfa0);
  outline-offset: 1px;
}

.actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.submitBtn {
  padding: 0.5rem 1.25rem;
  border-radius: 6px;
  background: var(--color-teal, #2bbfa0);
  color: #fff;
  border: none;
  font-size: 14px;
  font-family: DM Sans, system-ui, sans-serif;
  cursor: pointer;
}

.submitBtn:hover { opacity: 0.9; }

.skipBtn {
  background: none;
  border: none;
  font-size: 13px;
  color: var(--ink-muted, #888);
  cursor: pointer;
  padding: 0.5rem 0;
  font-family: DM Sans, system-ui, sans-serif;
}

.skipBtn:hover { color: var(--color-ink, #0f1117); }
```

- [ ] **Step 3: Modify `LessonPlayer.tsx`**

Replace the entire file with:

```tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import '@primr/components/dist/style.css'
import { LessonRenderer } from '@primr/components'
import type { LessonManifest, LessonCompletePayload, LessonMode } from '@primr/components'
import { FeedbackOverlay } from './FeedbackOverlay'

export default function LessonPlayer({ lessonId, manifest, adminMode, examEnforced = true, hideHeader = false }: { lessonId: string; manifest: LessonManifest; adminMode?: boolean; examEnforced?: boolean; hideHeader?: boolean }) {
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<LessonMode>('interactive')
  const [phase, setPhase] = useState<'learning' | 'feedback' | 'complete'>('learning')
  const [pendingFlags, setPendingFlags] = useState<Array<{ blockId: string; comment: string }>>([])
  const submitted = useRef(false)
  const lastPayloadRef = useRef<LessonCompletePayload | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Start a new attempt on mount
  useEffect(() => {
    fetch(`/api/lessons/${lessonId}/attempts`, { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        if (data.attempt?.id) setAttemptId(data.attempt.id)
        else setError('Could not start lesson. Are you signed in?')
      })
      .catch(() => setError('Could not start lesson.'))
  }, [lessonId])

  const handleBlockFlag = useCallback((blockId: string, comment: string) => {
    setPendingFlags(prev => [...prev, { blockId, comment }])
  }, [])

  async function handleLessonComplete(payload: LessonCompletePayload) {
    if (!attemptId || submitted.current) return
    submitted.current = true
    lastPayloadRef.current = payload

    await fetch(`/api/attempts/${attemptId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        score: payload.score,
        scoredBlocks: payload.scoredBlocks,
        blockResults: payload.blockResults,
      }),
    })

    setPhase('feedback')
  }

  async function handleFeedbackDone(rating: number | null, comment: string) {
    if (attemptId) {
      await fetch(`/api/lessons/${lessonId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId,
          rating: rating ?? undefined,
          comment: comment || undefined,
          blockFlags: pendingFlags,
        }),
      })
    }
    setPhase('complete')
    window.parent.postMessage({ type: 'lesson-complete', score: lastPayloadRef.current?.score }, '*')
  }

  if (error) {
    return <div style={{ padding: '2rem', color: '#d94f4f' }}>{error}</div>
  }

  return (
    <div ref={contentRef} style={{ position: 'relative' }}>
      {adminMode && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0.5rem 1.5rem 0', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setMode(m => m === 'interactive' ? 'showcase' : 'interactive')}
            style={{
              fontSize: '11px',
              fontFamily: 'DM Sans, system-ui, sans-serif',
              padding: '0.25rem 0.65rem',
              border: '1px solid rgba(15,17,23,0.2)',
              borderRadius: '5px',
              background: mode === 'showcase' ? 'var(--accent, #7C8EF7)' : 'transparent',
              color: mode === 'showcase' ? '#fff' : 'inherit',
              cursor: 'pointer',
            }}
          >
            {mode === 'showcase' ? 'Showcase mode' : 'Interactive mode'}
          </button>
        </div>
      )}
      <LessonRenderer
        manifest={manifest}
        adminMode={adminMode}
        mode={mode}
        examEnforced={examEnforced}
        onLessonComplete={mode === 'interactive' ? handleLessonComplete : undefined}
        onBlockFlag={mode === 'interactive' && !adminMode ? handleBlockFlag : undefined}
      />
      {phase === 'feedback' && (
        <FeedbackOverlay onDone={handleFeedbackDone} />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Typecheck**

```bash
cd primr-app
npm run typecheck 2>/dev/null || npx tsc --noEmit
```

Expected: no errors on the modified files.

- [ ] **Step 5: Commit**

```bash
cd primr-app
git add "app/learn/[id]/LessonPlayer.tsx" \
        "app/learn/[id]/FeedbackOverlay.tsx" \
        "app/learn/[id]/FeedbackOverlay.module.css"
git commit -m "feat: add feedback overlay to LessonPlayer after lesson completion"
```

---

## Task 5: Creator Analytics

**Files:**
- Modify: `primr-app/app/creator/lessons/[id]/results/page.tsx`
- Modify: `primr-app/app/creator/page.tsx`
- Modify: `primr-app/app/creator/ResultsTab.tsx`

### Part A: Per-lesson results page

- [ ] **Step 1: Add feedback query and derivations to `results/page.tsx`**

Add `lessonFeedback` to the import at the top (line 4):
```ts
import { lessons, lessonAttempts, lessonInvitations, users, lessonFeedback } from '@/db/schema'
```

After the `blockPerf` computation (around line 120), add:

```ts
// Feedback data
const feedbackRows = await db
  .select()
  .from(lessonFeedback)
  .where(eq(lessonFeedback.lessonId, id))

const ratings = feedbackRows
  .map(r => r.rating)
  .filter((r): r is number => r != null)
const avgRating = ratings.length > 0
  ? ratings.reduce((a, b) => a + b, 0) / ratings.length
  : null
const ratingDist = [5, 4, 3, 2, 1].map(star => ({
  star,
  count: ratings.filter(r => r === star).length,
}))
const maxDistCount = Math.max(...ratingDist.map(r => r.count), 1)

// Block flags — aggregate across all feedback rows
const flagMap = new Map<string, { flagCount: number; comments: string[] }>()
for (const row of feedbackRows) {
  const flags = (row.blockFlags ?? []) as Array<{ blockId: string; comment: string }>
  for (const f of flags) {
    const existing = flagMap.get(f.blockId)
    if (!existing) {
      flagMap.set(f.blockId, { flagCount: 1, comments: f.comment ? [f.comment] : [] })
    } else {
      existing.flagCount++
      if (f.comment) existing.comments.push(f.comment)
    }
  }
}
const blockFlagsSorted = [...flagMap.entries()]
  .map(([blockId, data]) => ({ blockId, ...data }))
  .sort((a, b) => b.flagCount - a.flagCount)
const blockTitleMap = new Map(
  lesson.manifest.blocks.map(b => [b.id, (b.props as { title?: string }).title ?? b.type])
)
```

- [ ] **Step 2: Add feedback summary bar to the JSX**

After the closing `</div>` of the stat strip section (around line 170), add:

```tsx
{/* Feedback summary bar */}
{avgRating !== null && (
  <div className={styles.section}>
    <div className={styles.sectionTitle}>Learner feedback</div>
    <div className={styles.feedbackBar}>
      <div className={styles.feedbackRating}>
        <span className={styles.feedbackStar}>★</span>
        <span className={styles.feedbackRatingVal}>{avgRating.toFixed(1)}</span>
        <span className={styles.feedbackRatingCount}>
          · {ratings.length} rating{ratings.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className={styles.ratingDist}>
        {ratingDist.map(({ star, count }) => (
          <div key={star} className={styles.ratingDistRow}>
            <span className={styles.ratingDistLabel}>{star}★</span>
            <div className={styles.ratingDistTrack}>
              <div
                className={styles.ratingDistFill}
                style={{ width: `${(count / maxDistCount) * 100}%` }}
              />
            </div>
            <span className={styles.ratingDistCount}>{count}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 3: Add block flags panel to the JSX**

After the closing `)}` of the block performance section, add:

```tsx
{/* Block flags */}
{blockFlagsSorted.length > 0 && (
  <div className={styles.section}>
    <div className={styles.sectionTitle}>Flagged sections</div>
    <div className={styles.flagList}>
      {blockFlagsSorted.map(({ blockId, flagCount, comments }) => (
        <div key={blockId} className={styles.flagItem}>
          <div className={styles.flagItemHeader}>
            <span className={styles.flagBlockTitle}>
              {blockTitleMap.get(blockId) ?? blockId}
            </span>
            <span className={styles.flagCount}>
              {flagCount} flag{flagCount !== 1 ? 's' : ''}
            </span>
          </div>
          {comments.length > 0 && (
            <ul className={styles.flagComments}>
              {comments.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          )}
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 4: Add CSS to `results/page.module.css`**

Append to `app/creator/lessons/[id]/results/page.module.css`:

```css
/* ── Feedback bar ── */
.feedbackBar {
  display: flex;
  gap: 2rem;
  align-items: flex-start;
  flex-wrap: wrap;
}
.feedbackRating {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
  white-space: nowrap;
}
.feedbackStar {
  color: var(--color-amber, #e2a800);
  font-size: 20px;
}
.feedbackRatingVal {
  font-size: 22px;
  font-weight: 600;
  color: var(--color-ink);
}
.feedbackRatingCount {
  font-size: 13px;
  color: var(--ink-muted, #888);
}
.ratingDist {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 160px;
  max-width: 280px;
}
.ratingDistRow {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 12px;
}
.ratingDistLabel {
  width: 24px;
  text-align: right;
  color: var(--ink-muted, #888);
  flex-shrink: 0;
}
.ratingDistTrack {
  flex: 1;
  height: 6px;
  background: var(--border-mid, #e5e7eb);
  border-radius: 3px;
  overflow: hidden;
}
.ratingDistFill {
  height: 100%;
  background: var(--color-amber, #e2a800);
  border-radius: 3px;
  transition: width 300ms ease;
}
.ratingDistCount {
  width: 20px;
  text-align: right;
  color: var(--ink-muted, #888);
  flex-shrink: 0;
}

/* ── Flag list ── */
.flagList {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.flagItem {
  padding: 0.75rem 1rem;
  border: 0.5px solid var(--border-mid, #e5e7eb);
  border-radius: 8px;
}
.flagItemHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}
.flagBlockTitle {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-ink);
}
.flagCount {
  font-size: 12px;
  color: var(--ink-muted, #888);
  background: var(--surface-raised, #f5f5f5);
  padding: 2px 8px;
  border-radius: 999px;
}
.flagComments {
  margin: 0;
  padding-left: 1.25rem;
  font-size: 13px;
  color: var(--ink-muted, #888);
  line-height: 1.6;
}
```

### Part B: Creator dashboard (`app/creator/page.tsx`)

- [ ] **Step 5: Add `lessonFeedback` import to `app/creator/page.tsx`**

Find the db/schema import line (around line 10). Add `lessonFeedback` to it:
```ts
import { lessons, lessonAttempts, lessonInvitations, users, courses, courseSections, courseChapters, chapterLessons, courseEnrollments, lessonFeedback } from '@/db/schema'
```

- [ ] **Step 6: Add `ratingRows` query and `ratingMap` in `app/creator/page.tsx`**

After the `attemptStatRows` query and `attemptStatMap` assignment (around line 122), add:

```ts
// Per-lesson average rating
let ratingRows: { lessonId: string; avgRating: number | null }[] = []
if (createdLessonIds.length > 0) {
  ratingRows = await db
    .select({
      lessonId: lessonFeedback.lessonId,
      avgRating: sql<number | null>`avg(${lessonFeedback.rating})`,
    })
    .from(lessonFeedback)
    .where(inArray(lessonFeedback.lessonId, createdLessonIds))
    .groupBy(lessonFeedback.lessonId)
}
const ratingMap = new Map(ratingRows.map(r => [r.lessonId, r.avgRating]))
```

- [ ] **Step 7: Add `avgRating` to `lessonRows` mapping in `app/creator/page.tsx`**

Find the `lessonRows` mapping (around line 280). Change:
```ts
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
```
to:
```ts
lessonRows: createdLessons.map(l => {
  const stat = attemptStatMap.get(l.id)
  return {
    id: l.id,
    title: l.title,
    invitedCount: invitedMap.get(l.id) ?? 0,
    startedCount: stat?.startedCount ?? 0,
    completedCount: stat?.completedCount ?? 0,
    avgScore: stat?.avgScore ?? null,
    avgRating: ratingMap.get(l.id) ?? null,
  }
}),
```

### Part C: `ResultsTab.tsx`

- [ ] **Step 8: Add `avgRating` to `LessonResultRow` type**

In `app/creator/ResultsTab.tsx`, find `LessonResultRow` (line 7). Add `avgRating`:
```ts
export type LessonResultRow = {
  id: string
  title: string
  invitedCount: number
  startedCount: number
  completedCount: number
  avgScore: number | null
  avgRating: number | null
}
```

- [ ] **Step 9: Add Rating column header to standalone lessons table**

Find the `<thead>` of the standalone lessons table (around line 261). Change:
```tsx
<tr>
  <th>Lesson</th>
  <th className={styles.thMeta}>Invited</th>
  <th className={styles.thMeta}>Started</th>
  <th className={styles.thMeta}>Completed</th>
  <th className={styles.thMeta}>Avg score</th>
  <th className={styles.thActions}></th>
</tr>
```
to:
```tsx
<tr>
  <th>Lesson</th>
  <th className={styles.thMeta}>Invited</th>
  <th className={styles.thMeta}>Started</th>
  <th className={styles.thMeta}>Completed</th>
  <th className={styles.thMeta}>Avg score</th>
  <th className={styles.thMeta}>Rating</th>
  <th className={styles.thActions}></th>
</tr>
```

- [ ] **Step 10: Add Rating cell to each lesson row**

Find the lesson row `<tr>` in the `lessonRows.map()` (around line 283). After the `<td className={styles.tdMeta}>` containing the avgScore display, add:
```tsx
<td className={styles.tdMeta}>
  {row.avgRating != null ? (
    <span style={{ color: 'var(--color-amber, #e2a800)', fontWeight: 500 }}>
      ★ {row.avgRating.toFixed(1)}
    </span>
  ) : (
    <span style={{ color: 'var(--ink-muted, #888)' }}>—</span>
  )}
</td>
```

- [ ] **Step 11: Typecheck**

```bash
cd primr-app
npm run typecheck 2>/dev/null || npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 12: Commit**

```bash
cd primr-app
git add "app/creator/lessons/[id]/results/page.tsx" \
        "app/creator/lessons/[id]/results/page.module.css" \
        "app/creator/page.tsx" \
        "app/creator/ResultsTab.tsx"
git commit -m "feat: surface feedback ratings and block flags in creator analytics"
```

---

## Verification Checklist

1. `npm run db:generate` + `npm run db:migrate` succeeds (Task 1)
2. `primr-app` typechecks cleanly (Tasks 2, 4, 5)
3. `primr-components` tests: 8 new flag tests pass, existing tests unbroken (Task 3)
4. Manual flow: start a lesson → flag a block → submit → ✓ indicator appears; navigate to next block → form is gone (Task 3)
5. Manual flow: finish lesson → FeedbackOverlay appears → submit → overlay closes → LessonRenderer completion screen visible → POST to `/api/lessons/[id]/feedback` succeeds (Task 4)
6. Manual flow: skip feedback → overlay closes, `lesson-complete` postMessage fires (Task 4)
7. Creator results page: feedback bar and flags panel hidden when no feedback exists; visible and accurate after feedback is submitted (Task 5)
8. Creator dashboard: Rating column shows "★ 4.2" for lessons with feedback, "—" for others (Task 5)
