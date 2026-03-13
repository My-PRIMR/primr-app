import { pgTable, pgEnum, text, jsonb, timestamp, uuid, real, integer, unique } from 'drizzle-orm/pg-core'
import type { LessonManifest } from '@primr/components'

// ── Enums ────────────────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum('user_role', ['learner', 'creator', 'administrator'])

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
  role:           userRoleEnum('role').notNull().default('learner'),
  organizationId: uuid('organization_id').references(() => organizations.id),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
  updatedAt:      timestamp('updated_at').notNull().defaultNow(),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

// ── Lessons ──────────────────────────────────────────────────────────────────
export const lessons = pgTable('lessons', {
  id:        uuid('id').primaryKey().defaultRandom(),
  slug:      text('slug').notNull().unique(),
  title:     text('title').notNull(),
  manifest:  jsonb('manifest').notNull().$type<LessonManifest>(),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
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
