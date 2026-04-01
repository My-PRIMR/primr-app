# Learner→Creator Feedback System

**Date:** 2026-04-01
**Status:** Approved
**Scope:** `primr-app` (DB, API, analytics) + `primr-components` (LessonRenderer flag button)

---

## Problem

Creators have quantitative data (scores, completion rates, block performance) but no qualitative signal. When learners drop off or score poorly, creators can't tell *why*. A built-in feedback loop — embedded in the lesson experience, tied to specific blocks — closes this gap without requiring learners to leave the lesson or fill out a separate form.

---

## Approach

**Hybrid feedback model:** per-block flagging during the lesson + a 1–5 star rating at the end.

- Learners flag individual blocks they found unclear, with optional free-text explanation
- Learners rate the overall lesson (1–5 stars) on a prompt shown between lesson completion and the completion confirmation
- All feedback is **anonymous** — no learner identity is ever shown to creators
- Feedback surfaces in the existing creator results pages; no new routes needed

---

## Architecture

### Packages touched

| Package | Change |
|---|---|
| `primr-components` | Add `onBlockFlag` prop + flag button + inline flag form to `LessonRenderer` |
| `primr-app` | New DB table, API route, feedback screen in `LessonPlayer`, analytics additions |

---

## Data Model

### New table: `lessonFeedback`

```ts
lessonFeedback {
  id          : uuid       PK, default gen_random_uuid()
  lessonId    : uuid       FK → lessons (cascade delete)
  attemptId   : uuid       FK → lessonAttempts (cascade delete)
  rating      : smallint   nullable (1–5; null when learner skips rating)
  comment     : text       nullable (end-of-lesson free text)
  blockFlags  : jsonb      Array<{ blockId: string; comment: string }>
  submittedAt : timestamp  default now()
}
```

**Design notes:**
- No `userId` — anonymous by design. `attemptId` enables deduplication (one row per attempt) without exposing identity to creators.
- `blockFlags` is JSONB (not a separate table) — flags are always read/written as a unit with the parent feedback row; no join benefit to normalizing.
- `rating` is nullable so learners who flag blocks but skip the end-of-lesson prompt still produce a useful record.

---

## `primr-components` — `LessonRenderer` Changes

### New prop

```ts
onBlockFlag?: (blockId: string, comment: string) => void
```

Optional. When absent, no flag UI renders.

### Flag button placement

A small "Flag this section" button in the lesson footer, to the left of the Back button. Shown only when `onBlockFlag` is provided **and** `extractBlockText(currentBlock)` returns a non-empty string (same guard as the TTS button — silent block types like `media`, `code-runner`, simulators get no flag button).

### Interaction flow

1. Learner clicks flag → an inline form expands below the footer (no modal, lesson stays in place):
   - Textarea: "What was unclear?" (optional)
   - Submit button + Cancel button
2. Submit → `onBlockFlag(currentBlock.id, comment)` fires → form collapses → flag icon shows a ✓ indicator
3. Cancel → form collapses, nothing fires
4. Navigating to a new block collapses any open flag form without submitting
5. A block can only be flagged once per session; the ✓ indicator persists

### No DB writes in the component

`LessonRenderer` only calls `onBlockFlag`. All persistence is handled by `primr-app`.

---

## `primr-app` — LessonPlayer Changes

### Block flag accumulation

`LessonPlayer` passes `onBlockFlag` to `LessonRenderer`. Flags are accumulated in local state:

```ts
const [pendingFlags, setPendingFlags] = useState<Array<{ blockId: string; comment: string }>>([])
```

Each `onBlockFlag` call appends to `pendingFlags`. No API call is made per flag — all flags are written together when the feedback row is submitted.

### Feedback screen (new state: `'feedback'`)

`LessonPlayer` has an internal state machine: `'learning' → 'feedback' → 'complete'`.

When `onLessonComplete` fires:
1. Attempt is patched to `completed` immediately (completion is never gated on feedback)
2. State transitions to `'feedback'` — a feedback screen is shown overlaid on the lesson

**Feedback screen contents:**
- Heading: "Before you go — how was this lesson?"
- 5-star rating widget (tap to select)
- Optional textarea: "Anything else to share?" (shown always, not only on low rating)
- "Submit" button + "Skip" link

Both Submit and Skip write a `lessonFeedback` row (Skip writes `rating: null`, empty comment). After either action, state transitions to `'complete'` and the normal completion UI shows.

The feedback screen never re-appears on subsequent visits (deduplication: one `lessonFeedback` row per `attemptId`).

---

## `primr-app` — API Route

### `POST /api/lessons/[id]/feedback`

**Auth:** Learner must be authenticated and have access to the lesson.

**Body:**
```ts
{
  attemptId: string
  rating?: number        // 1–5, omitted if skipped
  comment?: string
  blockFlags: Array<{ blockId: string; comment: string }>
}
```

**Validation:**
- `attemptId` must belong to the authenticated user and to this lesson
- `rating` must be 1–5 if present
- One feedback row per `attemptId` (upsert or 409 on duplicate)

**Response:** `{ id: string }` (feedback row id)

---

## `primr-app` — Creator Analytics

### `/creator/lessons/[id]/results` — two additions

**1. Feedback summary bar** (top of page, alongside existing aggregate stats)
- Average star rating: "★ 4.2 · 14 ratings"
- Rating distribution: small horizontal bar chart (5 rows, one per star level)
- Hidden if no feedback exists yet

**2. Block flags panel** (below existing block performance table)
- Lists only blocks that received at least one flag, sorted by flag count descending
- Per block: block title, flag count, then each comment as a bullet
- Block titles are resolved from `lessons.manifest.blocks` by matching `blockId` — the analytics query loads the manifest alongside feedback rows
- Hidden if no flags exist yet

### `/creator` Results tab — one addition

- Star rating column in the per-lesson table (next to existing avg score column)
- Shows "★ 4.2" or "—" if no feedback yet

---

## Out of Scope (v1)

- Per-question flagging (flag a specific quiz question vs the whole block)
- Creator responses to feedback
- AI-generated rewrite suggestions from feedback (future payoff — schema is compatible)
- Email notifications to creators when feedback arrives
- Feedback on course-level (lesson-level only for now)
