import { pgTable, pgEnum, text, jsonb, timestamp, uuid, real, integer, boolean, unique } from 'drizzle-orm/pg-core'
import type { LessonManifest } from '@primr/components'

// ── Enums ────────────────────────────────────────────────────────────────────
export const productRoleEnum = pgEnum('product_role', ['learner', 'creator', 'lnd_manager', 'org_admin'])
export const planEnum         = pgEnum('plan',         ['free', 'pro', 'enterprise'])
export const internalRoleEnum = pgEnum('internal_role', ['staff', 'admin'])

// ── Organizations ────────────────────────────────────────────────────────────
export const organizations = pgTable('organizations', {
  id:        uuid('id').primaryKey().defaultRandom(),
  name:      text('name').notNull(),
  slug:      text('slug').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export type Organization = typeof organizations.$inferSelect
export type NewOrganization = typeof organizations.$inferInsert

// ── Users ────────────────────────────────────────────────────────────────────
export const users = pgTable('users', {
  id:             uuid('id').primaryKey().defaultRandom(),
  email:          text('email').notNull().unique(),
  passwordHash:   text('password_hash'),
  name:           text('name'),
  productRole:  productRoleEnum('product_role').notNull().default('learner'),
  plan:         planEnum('plan').notNull().default('free'),
  internalRole: internalRoleEnum('internal_role'),
  organizationId: uuid('organization_id').references(() => organizations.id),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
  updatedAt:      timestamp('updated_at').notNull().defaultNow(),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

// ── Lessons ──────────────────────────────────────────────────────────────────
export const lessonGenerationStatusEnum = pgEnum('lesson_generation_status', ['pending', 'generating', 'done', 'failed'])

export const lessons = pgTable('lessons', {
  id:               uuid('id').primaryKey().defaultRandom(),
  slug:             text('slug').notNull().unique(),
  title:            text('title').notNull(),
  manifest:         jsonb('manifest').notNull().$type<LessonManifest>(),
  createdBy:        uuid('created_by').references(() => users.id),
  /** Set only for video-ingested lessons */
  sourceVideoUrl:   text('source_video_url'),
  /** Null for manually-created lessons; set for video-ingested lessons */
  generationStatus: lessonGenerationStatusEnum('generation_status'),
  createdAt:        timestamp('created_at').notNull().defaultNow(),
  updatedAt:        timestamp('updated_at').notNull().defaultNow(),
})

export type Lesson = typeof lessons.$inferSelect
export type NewLesson = typeof lessons.$inferInsert

// ── Lesson Attempts ──────────────────────────────────────────────────────────
export const attemptStatusEnum = pgEnum('attempt_status', ['in_progress', 'completed'])

export const lessonAttempts = pgTable('lesson_attempts', {
  id:          uuid('id').primaryKey().defaultRandom(),
  userId:      uuid('user_id').notNull().references(() => users.id),
  lessonId:    uuid('lesson_id').notNull().references(() => lessons.id),
  status:      attemptStatusEnum('status').notNull().default('in_progress'),
  score:       real('score'),
  totalBlocks: integer('total_blocks').notNull(),
  scoredBlocks: integer('scored_blocks'),
  blockResults: jsonb('block_results').$type<Record<string, { status: string; score?: number }>>(),
  startedAt:   timestamp('started_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
})

export type LessonAttempt = typeof lessonAttempts.$inferSelect
export type NewLessonAttempt = typeof lessonAttempts.$inferInsert

// ── Lesson Invitations ────────────────────────────────────────────────────
export const lessonInvitations = pgTable('lesson_invitations', {
  id:        uuid('id').primaryKey().defaultRandom(),
  lessonId:  uuid('lesson_id').notNull().references(() => lessons.id),
  email:     text('email').notNull(),
  invitedBy: uuid('invited_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  unique('lesson_invitations_lesson_email').on(t.lessonId, t.email),
])

export type LessonInvitation = typeof lessonInvitations.$inferSelect
export type NewLessonInvitation = typeof lessonInvitations.$inferInsert

// ── Lesson Invite Links ───────────────────────────────────────────────────
export const lessonInviteLinks = pgTable('lesson_invite_links', {
  id:        uuid('id').primaryKey().defaultRandom(),
  lessonId:  uuid('lesson_id').notNull().references(() => lessons.id).unique(),
  token:     text('token').notNull().unique(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export type LessonInviteLink = typeof lessonInviteLinks.$inferSelect
export type NewLessonInviteLink = typeof lessonInviteLinks.$inferInsert

// ── Courses ───────────────────────────────────────────────────────────────────
export const courseStatusEnum = pgEnum('course_status', ['draft', 'generating', 'ready', 'published'])

export const courses = pgTable('courses', {
  id:          uuid('id').primaryKey().defaultRandom(),
  title:       text('title').notNull(),
  slug:        text('slug').notNull().unique(),
  description: text('description'),
  isPublic:    boolean('is_public').notNull().default(false),
  status:      courseStatusEnum('status').notNull().default('draft'),
  createdBy:   uuid('created_by').references(() => users.id),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
  updatedAt:   timestamp('updated_at').notNull().defaultNow(),
})

export type Course = typeof courses.$inferSelect
export type NewCourse = typeof courses.$inferInsert

// ── Course Sections ───────────────────────────────────────────────────────────
export const courseSections = pgTable('course_sections', {
  id:        uuid('id').primaryKey().defaultRandom(),
  courseId:  uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  title:     text('title').notNull(),
  inferred:  boolean('inferred').notNull().default(false),
  position:  integer('position').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export type CourseSection = typeof courseSections.$inferSelect
export type NewCourseSection = typeof courseSections.$inferInsert

// ── Course Chapters ───────────────────────────────────────────────────────────
export const courseChapters = pgTable('course_chapters', {
  id:        uuid('id').primaryKey().defaultRandom(),
  sectionId: uuid('section_id').notNull().references(() => courseSections.id, { onDelete: 'cascade' }),
  title:     text('title').notNull(),
  position:  integer('position').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export type CourseChapter = typeof courseChapters.$inferSelect
export type NewCourseChapter = typeof courseChapters.$inferInsert

// ── Chapter Lessons ───────────────────────────────────────────────────────────
export const generationStatusEnum = pgEnum('generation_status', ['pending', 'generating', 'done', 'failed'])

export const chapterLessons = pgTable('chapter_lessons', {
  id:               uuid('id').primaryKey().defaultRandom(),
  chapterId:        uuid('chapter_id').notNull().references(() => courseChapters.id, { onDelete: 'cascade' }),
  lessonId:         uuid('lesson_id').references(() => lessons.id),
  title:            text('title').notNull(),
  position:         integer('position').notNull(),
  generationStatus: generationStatusEnum('generation_status').notNull().default('pending'),
  sourceText:       text('source_text'),
  audience:         text('audience'),
  level:            text('level'),
  createdAt:        timestamp('created_at').notNull().defaultNow(),
})

export type ChapterLesson = typeof chapterLessons.$inferSelect
export type NewChapterLesson = typeof chapterLessons.$inferInsert

// ── Course Enrollments ────────────────────────────────────────────────────────
export const courseEnrollments = pgTable('course_enrollments', {
  id:         uuid('id').primaryKey().defaultRandom(),
  courseId:   uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  email:      text('email').notNull(),
  enrolledBy: uuid('enrolled_by').notNull().references(() => users.id),
  createdAt:  timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  unique('course_enrollments_course_email').on(t.courseId, t.email),
])

export type CourseEnrollment = typeof courseEnrollments.$inferSelect
export type NewCourseEnrollment = typeof courseEnrollments.$inferInsert

// ── Course Invite Links ───────────────────────────────────────────────────────
export const courseInviteLinks = pgTable('course_invite_links', {
  id:        uuid('id').primaryKey().defaultRandom(),
  courseId:  uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }).unique(),
  token:     text('token').notNull().unique(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export type CourseInviteLink = typeof courseInviteLinks.$inferSelect
export type NewCourseInviteLink = typeof courseInviteLinks.$inferInsert

// ── Internal Usage Log ────────────────────────────────────────────────────────
export const internalUsageEventTypeEnum = pgEnum('internal_usage_event_type', ['standalone_lesson', 'course'])
export const internalUsageCostCategoryEnum = pgEnum('internal_usage_cost_category', ['LOW', 'MEDIUM', 'HIGH'])

export const internalUsageLog = pgTable('internal_usage_log', {
  id:           uuid('id').primaryKey().defaultRandom(),
  userId:       uuid('user_id').notNull().references(() => users.id),
  eventType:    internalUsageEventTypeEnum('event_type').notNull(),
  modelId:      text('model_id').notNull(),
  costCategory: internalUsageCostCategoryEnum('cost_category').notNull(),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
})

export type InternalUsageLog = typeof internalUsageLog.$inferSelect
export type NewInternalUsageLog = typeof internalUsageLog.$inferInsert
