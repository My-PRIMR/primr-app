import { db } from '@/db'
import {
  users, lessons, lessonInvitations, lessonAttempts,
  courses, courseSections, courseChapters, chapterLessons, courseEnrollments, lessonFeedback,
  onboardingPlaylists, creatorProfiles, purchases,
} from '@/db/schema'
import { desc, eq, and, sql, inArray, max, gte } from 'drizzle-orm'
import { resolveSegment } from '@/lib/onboarding'
import { fillDailyActivity } from '@/lib/results'
import type { ResultsData, CourseResultRow, CourseLearnerRow } from '../ResultsTab'
import type { OnboardingLesson } from '../OnboardingStrip'
import { mergeRevenueByItem } from './revenue'

export type CreatorContentData = {
  plan: string
  isCreator: boolean
  isMonetized: boolean
  createdCourses: {
    id: string; title: string; status: string; createdAt: string
    lessonCount: number; doneCount: number; priceCents: number | null; isPaid: boolean; embeddable: boolean
    revenueCents: number | undefined
  }[]
  createdLessons: {
    id: string; title: string; slug: string; createdAt: string; updatedAt: string
    publishedAt: string | null; examEnforced: boolean; showcase: boolean
    isStandalone: boolean; priceCents: number | null; isPaid: boolean
    revenueCents: number | undefined
  }[]
  resultsData?: ResultsData
  onboardingLessons: OnboardingLesson[]
}

export async function fetchCreatorContent(userId: string, email: string, role: string, plan: string): Promise<CreatorContentData> {
  const isCreator = role === 'creator' || role === 'lnd_manager' || role === 'org_admin'

  if (!isCreator) {
    return { plan, isCreator, isMonetized: false, createdCourses: [], createdLessons: [], onboardingLessons: [] }
  }

  // ── Courses ────────────────────────────────────────────────────────────────
  const createdCoursesRaw = await db
    .select({
      id: courses.id,
      title: courses.title,
      status: courses.status,
      createdAt: courses.createdAt,
      priceCents: courses.priceCents,
      isPaid: courses.isPaid,
      embeddable: courses.embeddable,
      lessonCount: sql<number>`count(${chapterLessons.id})::int`,
      doneCount: sql<number>`count(case when ${chapterLessons.generationStatus} = 'done' then 1 end)::int`,
    })
    .from(courses)
    .leftJoin(courseSections, eq(courseSections.courseId, courses.id))
    .leftJoin(courseChapters, eq(courseChapters.sectionId, courseSections.id))
    .leftJoin(chapterLessons, eq(chapterLessons.chapterId, courseChapters.id))
    .where(and(eq(courses.createdBy, userId), eq(courses.isSystem, false)))
    .groupBy(courses.id)
    .orderBy(desc(courses.createdAt))

  // ── Lessons ────────────────────────────────────────────────────────────────
  const createdLessonsRaw = await db.select({
    id: lessons.id,
    title: lessons.title,
    slug: lessons.slug,
    createdAt: lessons.createdAt,
    updatedAt: lessons.updatedAt,
    publishedAt: lessons.publishedAt,
    examEnforced: lessons.examEnforced,
    showcase: lessons.showcase,
    priceCents: lessons.priceCents,
    isPaid: lessons.isPaid,
  })
    .from(lessons)
    .where(and(eq(lessons.createdBy, userId), eq(lessons.isSystem, false)))
    .orderBy(desc(lessons.updatedAt))

  const inChapterIds = new Set<string>()
  if (createdLessonsRaw.length > 0) {
    const lessonIds = createdLessonsRaw.map(l => l.id)
    const inChapterRows = await db
      .selectDistinct({ lessonId: chapterLessons.lessonId })
      .from(chapterLessons)
      .innerJoin(courseChapters, eq(courseChapters.id, chapterLessons.chapterId))
      .innerJoin(courseSections, eq(courseSections.id, courseChapters.sectionId))
      .innerJoin(courses, eq(courses.id, courseSections.courseId))
      .where(inArray(chapterLessons.lessonId, lessonIds))
    for (const row of inChapterRows) {
      if (row.lessonId) inChapterIds.add(row.lessonId)
    }
  }

  const createdLessons = createdLessonsRaw.map(l => ({
    ...l,
    chapterLessonCount: inChapterIds.has(l.id) ? 1 : 0,
  }))

  // ── Revenue (per-item, monetized creators only) ───────────────────────────
  const monetProfile = await db
    .select({ complete: creatorProfiles.stripeOnboardingComplete })
    .from(creatorProfiles)
    .where(eq(creatorProfiles.userId, userId))
    .limit(1)
    .then(rows => rows[0])
  const isMonetized = !!monetProfile?.complete

  const lessonIdsForRevenue = createdLessons.map(l => l.id)
  const courseIdsForRevenue = createdCoursesRaw.map(c => c.id)

  let lessonRevenueMap = new Map<string, number>()
  let courseRevenueMap = new Map<string, number>()

  if (isMonetized && (lessonIdsForRevenue.length > 0 || courseIdsForRevenue.length > 0)) {
    const [lessonRevRows, courseRevRows] = await Promise.all([
      lessonIdsForRevenue.length > 0
        ? db
            .select({
              itemId: purchases.lessonId,
              revenueCents: sql<number>`coalesce(sum(${purchases.creatorRevenueCents}), 0)::int`,
            })
            .from(purchases)
            .where(inArray(purchases.lessonId, lessonIdsForRevenue))
            .groupBy(purchases.lessonId)
        : Promise.resolve([]),
      courseIdsForRevenue.length > 0
        ? db
            .select({
              itemId: purchases.courseId,
              revenueCents: sql<number>`coalesce(sum(${purchases.creatorRevenueCents}), 0)::int`,
            })
            .from(purchases)
            .where(inArray(purchases.courseId, courseIdsForRevenue))
            .groupBy(purchases.courseId)
        : Promise.resolve([]),
    ])
    lessonRevenueMap = mergeRevenueByItem(lessonIdsForRevenue, lessonRevRows)
    courseRevenueMap = mergeRevenueByItem(courseIdsForRevenue, courseRevRows)
  }

  // ── Results ────────────────────────────────────────────────────────────────
  let resultsData: ResultsData | undefined

  if (createdLessons.length > 0 || createdCoursesRaw.length > 0) {
    const standaloneLessons = createdLessons.filter(l => l.chapterLessonCount === 0)
    const createdLessonIds = standaloneLessons.map(l => l.id)
    const courseIds = createdCoursesRaw.map(c => c.id)

    let courseLessonIds: string[] = []
    if (courseIds.length > 0) {
      const courseLessonRows = await db
        .select({ lessonId: chapterLessons.lessonId })
        .from(chapterLessons)
        .innerJoin(courseChapters, eq(courseChapters.id, chapterLessons.chapterId))
        .innerJoin(courseSections, eq(courseSections.id, courseChapters.sectionId))
        .where(inArray(courseSections.courseId, courseIds))
      courseLessonIds = courseLessonRows.map(r => r.lessonId).filter((id): id is string => id !== null)
    }

    const allLessonIds = [...createdLessonIds, ...courseLessonIds]

    let invitedRows: { lessonId: string; count: number }[] = []
    if (createdLessonIds.length > 0) {
      invitedRows = await db
        .select({ lessonId: lessonInvitations.lessonId, count: sql<number>`count(*)::int` })
        .from(lessonInvitations)
        .where(inArray(lessonInvitations.lessonId, createdLessonIds))
        .groupBy(lessonInvitations.lessonId)
    }
    const invitedMap = new Map(invitedRows.map(r => [r.lessonId, r.count]))

    let attemptStatRows: { lessonId: string; startedCount: number; completedCount: number; avgScore: number | null }[] = []
    if (createdLessonIds.length > 0) {
      attemptStatRows = await db
        .select({
          lessonId: lessonAttempts.lessonId,
          startedCount: sql<number>`count(distinct ${lessonAttempts.userId})::int`,
          completedCount: sql<number>`count(distinct case when ${lessonAttempts.status} = 'completed' then ${lessonAttempts.userId} end)::int`,
          avgScore: sql<number | null>`avg(case when ${lessonAttempts.status} = 'completed' and ${lessonAttempts.score} is not null then ${lessonAttempts.score} end)`,
        })
        .from(lessonAttempts)
        .where(inArray(lessonAttempts.lessonId, createdLessonIds))
        .groupBy(lessonAttempts.lessonId)
    }
    const attemptStatMap = new Map(attemptStatRows.map(r => [r.lessonId, r]))

    let ratingRows: { lessonId: string; avgRating: number | null }[] = []
    if (createdLessonIds.length > 0) {
      ratingRows = await db
        .select({ lessonId: lessonFeedback.lessonId, avgRating: sql<number | null>`avg(${lessonFeedback.rating})` })
        .from(lessonFeedback)
        .where(inArray(lessonFeedback.lessonId, createdLessonIds))
        .groupBy(lessonFeedback.lessonId)
    }
    const ratingMap = new Map(ratingRows.map(r => [r.lessonId, r.avgRating]))

    let overallStarted = 0
    let overallCompleted = 0
    if (allLessonIds.length > 0) {
      const overallAttemptStats = await db
        .select({
          startedCount: sql<number>`count(distinct ${lessonAttempts.userId})::int`,
          completedCount: sql<number>`count(distinct case when ${lessonAttempts.status} = 'completed' then ${lessonAttempts.userId} end)::int`,
        })
        .from(lessonAttempts)
        .where(inArray(lessonAttempts.lessonId, allLessonIds))
      overallStarted = overallAttemptStats[0]?.startedCount ?? 0
      overallCompleted = overallAttemptStats[0]?.completedCount ?? 0
    }

    let enrolledEmails: string[] = []
    let courseEnrollmentRows: { courseId: string; email: string; userName: string | null }[] = []
    if (courseIds.length > 0) {
      const rows = await db
        .select({ courseId: courseEnrollments.courseId, email: courseEnrollments.email, userName: users.name })
        .from(courseEnrollments)
        .leftJoin(users, sql`lower(${users.email}) = lower(${courseEnrollments.email})`)
        .where(inArray(courseEnrollments.courseId, courseIds))
      courseEnrollmentRows = rows
      enrolledEmails = rows.map(r => r.email.toLowerCase())
    }

    let courseCompletionRows: { courseId: string; learnerEmail: string; completedCount: number; avgScore: number | null; lastActivity: string | null }[] = []
    if (courseIds.length > 0) {
      courseCompletionRows = await db
        .select({
          courseId: courseSections.courseId,
          learnerEmail: sql<string>`lower(${users.email})`,
          completedCount: sql<number>`count(distinct ${lessonAttempts.lessonId})::int`,
          avgScore: sql<number | null>`avg(${lessonAttempts.score})`,
          lastActivity: sql<string | null>`to_char(max(${lessonAttempts.completedAt}) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`,
        })
        .from(lessonAttempts)
        .innerJoin(users, eq(users.id, lessonAttempts.userId))
        .innerJoin(chapterLessons, eq(chapterLessons.lessonId, lessonAttempts.lessonId))
        .innerJoin(courseChapters, eq(courseChapters.id, chapterLessons.chapterId))
        .innerJoin(courseSections, eq(courseSections.id, courseChapters.sectionId))
        .where(and(eq(lessonAttempts.status, 'completed'), inArray(courseSections.courseId, courseIds)))
        .groupBy(courseSections.courseId, sql`lower(${users.email})`)
    }

    const courseRows: CourseResultRow[] = createdCoursesRaw.map(course => {
      const enrollees = courseEnrollmentRows.filter(e => e.courseId === course.id)
      const completionMap = new Map(courseCompletionRows.filter(c => c.courseId === course.id).map(c => [c.learnerEmail, c]))
      const totalLessons = Number(course.lessonCount)
      const learners: CourseLearnerRow[] = enrollees.map(e => {
        const completion = completionMap.get(e.email.toLowerCase())
        const completedLessons = completion?.completedCount ?? 0
        const status: CourseLearnerRow['status'] =
          completedLessons >= totalLessons && totalLessons > 0 ? 'completed' : completedLessons > 0 ? 'in_progress' : 'not_started'
        return { email: e.email, name: e.userName, completedLessons, totalLessons, avgScore: completion?.avgScore ?? null, status, lastActivity: completion?.lastActivity ?? null }
      })
      learners.sort((a, b) => {
        const statusOrder = { completed: 0, in_progress: 1, not_started: 2 }
        if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status]
        if (a.status === 'completed') return (b.avgScore ?? 0) - (a.avgScore ?? 0)
        return 0
      })
      return { id: course.id, title: course.title, totalLessons, enrolledCount: enrollees.length, completedCount: learners.filter(l => l.status === 'completed').length, learners }
    })

    let lessonAttemptEmails: string[] = []
    if (allLessonIds.length > 0) {
      const emailRows = await db
        .select({ email: sql<string>`lower(${users.email})` })
        .from(lessonAttempts)
        .innerJoin(users, eq(users.id, lessonAttempts.userId))
        .where(inArray(lessonAttempts.lessonId, allLessonIds))
        .groupBy(users.email)
      lessonAttemptEmails = emailRows.map(r => r.email)
    }
    const totalLearners = new Set([...enrolledEmails, ...lessonAttemptEmails]).size

    const overallScoreRow = await db
      .select({ avgScore: sql<number | null>`avg(${lessonAttempts.score})`, lastActivity: sql<string | null>`to_char(max(${lessonAttempts.completedAt}) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')` })
      .from(lessonAttempts)
      .where(and(allLessonIds.length > 0 ? inArray(lessonAttempts.lessonId, allLessonIds) : sql`false`, eq(lessonAttempts.status, 'completed')))

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const dailyRows = await db
      .select({ date: sql<string>`date(${lessonAttempts.completedAt})::text`, count: sql<number>`count(*)::int` })
      .from(lessonAttempts)
      .where(and(allLessonIds.length > 0 ? inArray(lessonAttempts.lessonId, allLessonIds) : sql`false`, eq(lessonAttempts.status, 'completed'), gte(lessonAttempts.completedAt, thirtyDaysAgo)))
      .groupBy(sql`date(${lessonAttempts.completedAt})`)

    resultsData = {
      totalLearners, startedCount: overallStarted, completedCount: overallCompleted,
      avgScore: overallScoreRow[0]?.avgScore ?? null, lastActivityDate: overallScoreRow[0]?.lastActivity ?? null,
      dailyActivity: fillDailyActivity(dailyRows, 30),
      lessonRows: standaloneLessons.map(l => {
        const stat = attemptStatMap.get(l.id)
        return { id: l.id, title: l.title, invitedCount: invitedMap.get(l.id) ?? 0, startedCount: stat?.startedCount ?? 0, completedCount: stat?.completedCount ?? 0, avgScore: stat?.avgScore ?? null, avgRating: ratingMap.get(l.id) ?? null }
      }),
      courseRows,
    }
  }

  // ── Onboarding ─────────────────────────────────────────────────────────────
  const userRow = await db
    .select({ onboardingDismissedAt: users.onboardingDismissedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
    .then(rows => rows[0])

  const onboardingDismissedAt = userRow?.onboardingDismissedAt ?? null
  const segment = resolveSegment(role, plan)
  let onboardingLessons: OnboardingLesson[] = []

  if (segment && !onboardingDismissedAt) {
    const playlistRows = await db
      .select({ lessonId: onboardingPlaylists.lessonId, displayOrder: onboardingPlaylists.displayOrder })
      .from(onboardingPlaylists)
      .where(eq(onboardingPlaylists.segment, segment))
      .orderBy(onboardingPlaylists.displayOrder)

    if (playlistRows.length > 0) {
      const playlistLessonIds = playlistRows.map(r => r.lessonId)
      const [lessonRows, attemptRows] = await Promise.all([
        db.select({ id: lessons.id, title: lessons.title, slug: lessons.slug }).from(lessons).where(inArray(lessons.id, playlistLessonIds)),
        db.select({ lessonId: lessonAttempts.lessonId, status: lessonAttempts.status }).from(lessonAttempts).where(and(eq(lessonAttempts.userId, userId), inArray(lessonAttempts.lessonId, playlistLessonIds))).orderBy(lessonAttempts.startedAt),
      ])
      const attemptStatusMap = new Map<string, 'completed' | 'in_progress'>()
      for (const a of attemptRows) {
        if (attemptStatusMap.get(a.lessonId) !== 'completed') {
          attemptStatusMap.set(a.lessonId, a.status as 'completed' | 'in_progress')
        }
      }
      const lessonMap = new Map(lessonRows.map(l => [l.id, l]))
      onboardingLessons = playlistRows
        .map(r => { const lesson = lessonMap.get(r.lessonId); if (!lesson) return null; return { id: lesson.id, title: lesson.title, slug: lesson.slug, displayOrder: r.displayOrder, status: (attemptStatusMap.get(lesson.id) ?? 'not_started') as OnboardingLesson['status'] } })
        .filter((x): x is OnboardingLesson => x !== null)
    }
  }

  return {
    plan, isCreator, isMonetized,
    createdCourses: createdCoursesRaw.map(c => ({
      id: c.id, title: c.title, status: c.status, createdAt: c.createdAt.toISOString(),
      lessonCount: c.lessonCount, doneCount: c.doneCount, priceCents: c.priceCents, isPaid: c.isPaid, embeddable: c.embeddable,
      revenueCents: isMonetized ? (courseRevenueMap.get(c.id) ?? 0) : undefined,
    })),
    createdLessons: createdLessons.map(l => ({
      id: l.id, title: l.title, slug: l.slug, createdAt: l.createdAt.toISOString(), updatedAt: l.updatedAt.toISOString(),
      publishedAt: l.publishedAt?.toISOString() ?? null, examEnforced: l.examEnforced, showcase: l.showcase,
      isStandalone: l.chapterLessonCount === 0, priceCents: l.priceCents, isPaid: l.isPaid,
      revenueCents: isMonetized ? (lessonRevenueMap.get(l.id) ?? 0) : undefined,
    })),
    resultsData,
    onboardingLessons,
  }
}
