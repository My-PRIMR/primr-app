# Creator Results — Course Tracking Merge Design Spec
**Date:** 2026-03-31
**Status:** Approved

## Overview

Merge the course-level learner tracking from `/creator/progress` into the existing Results tab on the creator dashboard. Add a course drilldown page mirroring the existing lesson drilldown. Delete `/creator/progress` once fully replaced.

---

## Scope

**In scope:**
- Add a Courses section (expandable rows) to the Results tab above the existing Standalone lessons section
- Add "View results →" link per course row linking to a new course drilldown page
- New course drilldown page at `/creator/courses/[id]/results`
- Update standalone lessons query to exclude lessons that belong to a course
- Update aggregate stat cards to count course learners
- Delete `app/creator/progress/` entirely (page, component, CSS)
- Remove the "Progress" nav link from `/creator/page.tsx`

**Out of scope:**
- Block-level performance breakdown for courses (courses don't have a single block list)
- CSV export
- Email notifications

---

## Architecture

Pure RSC, no new API routes. All data fetched server-side in page components. Consistent with existing `/creator` and `/creator/lessons/[id]/results` patterns.

---

## Routes

| Route | Change |
|---|---|
| `/creator` | Results tab gains course section |
| `/creator/courses/[id]/results` | New — course drilldown |
| `/creator/progress` | Deleted |

---

## Results Tab Changes (`/creator`)

### New `CourseResultRow` type

```ts
type CourseLearnerRow = {
  email: string
  name: string | null
  completedLessons: number
  totalLessons: number
  avgScore: number | null
  status: 'completed' | 'in_progress' | 'not_started'
  lastActivity: string | null
}

type CourseResultRow = {
  id: string
  title: string
  totalLessons: number
  enrolledCount: number
  completedCount: number   // learners who completed all lessons
  learners: CourseLearnerRow[]
}
```

`ResultsData` gains a `courseRows: CourseResultRow[]` field.

### Aggregate stat card updates

- **Total learners:** unique users across course enrollments + standalone lesson attempts, deduped by lowercased email
- **Completion rate, avg score, activity chart:** remain lesson-attempt-based (standalone + course lesson attempts combined)
- **Last activity:** max completedAt across all lesson attempts

### Courses section UI

Rendered above the Standalone lessons section. Each course row:
- Expand/collapse toggle (`+` / `−`)
- Course title
- `{enrolledCount} enrolled · {totalLessons} lessons`
- Completion rate percentage + mini progress bar
- "View results →" link to `/creator/courses/[id]/results`

Expanded learner sub-table columns:

| Column | Notes |
|---|---|
| Learner | Name + email |
| Progress | Bar + `X / Y lessons` |
| Avg score | Score bar + % (dash if no completed lessons) |
| Status | Completed / In progress / Not started pill |
| Last active | Date of most recent lesson completion or start |

Sort order: completed learners first (by avg score desc), then in-progress, then not started.

`status` is `'completed'` if `completedLessons >= totalLessons && totalLessons > 0`, `'in_progress'` if `completedLessons > 0`, else `'not_started'`.

### Standalone lessons section

- Section header renamed from "Results by lesson" to "Standalone lessons"
- Lessons query updated to exclude lessons belonging to any course (add `leftJoin(chapterLessons).where(isNull(chapterLessons.id))`)

### Data fetched in `page.tsx` (additions)

Same queries as `app/creator/progress/page.tsx`:
1. `createdCourses` — courses owned by creator, with lesson count via `chapterLessons`
2. `courseEnrollmentRows` — enrolled emails + joined user name per course
3. `courseCompletionRows` — per `(courseId, learnerEmail)`: completed lesson count, avg score, last activity (uses `lessonAttempts` joined through `chapterLessons → courseChapters → courseSections`)

Total learners stat: union of enrolled emails and lesson attempt user emails, deduped by lowercased email.

---

## Course Drilldown (`/creator/courses/[id]/results`)

Access control: creator-only. Return 404 if course not found or `course.createdBy !== session.user.id`.

### Data fetched

- Course metadata: title, status, total lesson count, enrolled count
- All enrolled learners from `courseEnrollments`, joined with `users` for name
- Per-learner completion: lessons completed (count of distinct completed `lessonAttempts` for lessons in this course), avg score, last activity
- Per-lesson breakdown: for each lesson in the course (in section/chapter order), count how many enrolled learners have a completed attempt

### Stat cards (4)

| Card | Value |
|---|---|
| Enrolled | Count from `courseEnrollments` |
| Completed | Count who finished all lessons + completion rate % |
| Avg score | Avg across learners who completed all lessons |
| Pass rate | % of completed learners with avg score ≥ 70% |

### Learner roster

| Column | Notes |
|---|---|
| Learner | Name + email |
| Progress | Bar + `X / Y lessons` |
| Avg score | Score bar + % (dash if no completed lessons) |
| Status | Completed / In progress / Not started pill |
| Last active | Date of most recent lesson completion or start |

Sort: completed (avg score desc) → in_progress → not_started.

### Per-lesson breakdown

One row per lesson in the course, in curriculum order (section → chapter → lesson position). Each row:
- Lesson number (1, 2, 3…)
- Lesson title
- Completion bar: `completedCount / enrolledCount`
- Percentage callout, color-coded: green ≥ 80%, amber ≥ 50%, coral < 50%

---

## Deletion of `/creator/progress`

Remove:
- `app/creator/progress/page.tsx`
- `app/creator/progress/ProgressDashboard.tsx`
- `app/creator/progress/ProgressDashboard.module.css`
- The `<Link href="/creator/progress">Progress</Link>` nav link from `app/creator/page.tsx`

---

## Files to Create / Modify

| File | Change |
|---|---|
| `app/creator/ResultsTab.tsx` | Add `courseRows` to `ResultsData`; add Courses expandable section; add "View results →" per course; rename lessons section header |
| `app/creator/CreatorDashboard.module.css` | Add styles for course rows, learner sub-table, expand toggle |
| `app/creator/page.tsx` | Add course queries; update lessons query (exclude course members); update total learners stat |
| `app/creator/courses/[id]/results/page.tsx` | New RSC — course drilldown |
| `app/creator/courses/[id]/results/page.module.css` | New CSS module |
| `app/creator/progress/page.tsx` | Delete |
| `app/creator/progress/ProgressDashboard.tsx` | Delete |
| `app/creator/progress/ProgressDashboard.module.css` | Delete |
