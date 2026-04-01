# Creator Results Tracking — Design Spec
**Date:** 2026-03-31
**Status:** Approved

## Overview

Creators need visibility into how their learners are performing. This feature adds a **Results tab** to the creator dashboard (aggregate view across all lessons) and a **per-lesson results drilldown page** accessible from that tab.

---

## Scope

**In scope:**
- Results tab on the creator dashboard with aggregate stats, activity chart, and per-lesson summary table
- Per-lesson drilldown page with learner roster and block-by-block performance breakdown
- Rename the existing "Learning" tab to "My Learning" with a tooltip: "Primr lessons I have taken"

**Out of scope:**
- Learner-side progress improvements
- Email notifications / alerts for creators
- CSV export
- Course-level results (only standalone lesson results for now)

---

## Architecture

**Approach:** Pure server-rendered (Next.js RSC). All data fetching done at request time with Drizzle queries. No new API routes. Consistent with the existing `/my-primr` page pattern.

**No schema changes required.** All data derives from existing tables: `lessonAttempts`, `lessons`, `lessonInvitations`, `users`.

---

## Routes

| Route | Description |
|---|---|
| `/creator` | Existing — gains Results tab and "My Learning" rename |
| `/creator/lessons/[id]/results` | New — per-lesson drilldown |

---

## Results Tab (`/creator` — Results tab)

### Data fetched (server-side, scoped to `session.user.id` as creator)

- All lessons created by this user
- For each lesson: invited count (from `lessonInvitations`), started count, completed count, avg score (from `lessonAttempts`)
- Aggregate totals: total unique learners, overall completion rate, overall avg score, date of last attempt
- Activity over last 30 days: count of completed attempts per calendar day (for the bar chart)

### UI sections

**Summary stat cards (4):**
- Total learners (unique users who have started any attempt)
- Completion rate (completed attempts / started attempts)
- Avg score (across completed attempts with a non-null score)
- Last activity date

**Activity chart:**
- 30 bars, one per day, representing count of completed attempts
- Pure SVG/CSS — no charting library
- Heights normalized to the max-day value

**Results by lesson table:**

| Column | Notes |
|---|---|
| Lesson | Title |
| Invited | Count from `lessonInvitations` |
| Started | Count of attempts with any status |
| Completed | `X / Y` pill — green if ≥80% complete, amber otherwise |
| Avg score | Progress bar + percentage (dash if no completed attempts) |
| — | "View results →" link to drilldown |

---

## Per-Lesson Drilldown (`/creator/lessons/[id]/results`)

Access control: only the lesson creator can view this page. Return 404 if lesson not found or session user is not the creator.

### Data fetched

- Lesson metadata (title, publishedAt, examEnforced, invited count)
- All `lessonAttempts` for this lesson, joined with `users` for name/email
- Aggregate: started count, completed count, avg score, pass rate (completed attempts with score ≥ 0.70)
- Block performance: for each attempt's `blockResults` JSONB, aggregate per block ID — count responses and average score/correct rate

### UI sections

**Page header:** Lesson title, published status, exam enforced flag, invited count.

**Stat strip (4 cards):**
- Started (of N invited)
- Completed (X% completion rate)
- Avg score (completed attempts only)
- Pass rate (% of completed attempts scoring ≥ 70%)

**Learner roster table:**

| Column | Notes |
|---|---|
| Learner | Name + email |
| Status | Completed / In progress / Not started pill |
| Score | Progress bar + % (dash if not completed) |
| Attempts | Count of all attempts |
| Last active | Date of most recent `startedAt` |

Rows ordered: completed first (by score desc), then in-progress, then not started. Invited learners with zero attempts also appear (sourced from `lessonInvitations`).

**Block performance section:**
- Only scored blocks (quiz, exam) appear
- Each block row: block name/type, % correct bar, callout percentage
- Color: green if ≥ 75%, coral/red if < 75%
- Aggregated across all *completed* attempts (not in-progress)
- Block names sourced from `lesson.manifest.blocks`

### Pass rate threshold

Hardcoded at 70% for now. Not configurable per-lesson.

---

## "My Learning" Tab Rename

The existing "Learning" tab in `CreatorDashboard.tsx` is renamed to "My Learning". A `title` tooltip attribute is added: `"Primr lessons I have taken"`.

---

## Files to create / modify

| File | Change |
|---|---|
| `app/creator/CreatorDashboard.tsx` | Add Results tab UI (receives pre-fetched results as prop); rename "Learning" → "My Learning" with tooltip |
| `app/creator/page.tsx` | Fetch results data server-side; pass as `results` prop to `CreatorDashboard` |
| `app/creator/ResultsTab.tsx` | New client component — renders stat cards, chart, per-lesson table from the `results` prop |
| `app/creator/lessons/[id]/results/page.tsx` | New RSC — fetches and renders the per-lesson drilldown |
| `app/creator/CreatorDashboard.module.css` | New styles for results tab UI, chart bars, score bars, block breakdown rows |

**Note on ResultsTab:** Because `CreatorDashboard` is a client component, `ResultsTab` must also be a client component (or a plain function inside the client component). All data is fetched in the server page (`/creator/page.tsx`) and passed down as a prop — no client-side data fetching.
