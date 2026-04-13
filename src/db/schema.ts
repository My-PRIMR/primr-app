import { pgTable, pgEnum, text, jsonb, timestamp, uuid, real, integer, smallint, boolean, unique, uniqueIndex, index, check, type AnyPgColumn } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import type { LessonManifest } from '@primr/components'

// ── Enums ────────────────────────────────────────────────────────────────────
export const productRoleEnum = pgEnum('product_role', ['learner', 'creator', 'lnd_manager', 'org_admin'])
export const planEnum         = pgEnum('plan',         ['free', 'teacher', 'pro', 'enterprise'])
export const internalRoleEnum = pgEnum('internal_role', ['staff', 'admin'])
export const onboardingSegmentEnum = pgEnum('onboarding_segment', [
  'creator_free', 'creator_pro', 'creator_enterprise',
  'teacher', 'lnd_manager', 'org_admin',
])

// ── Organizations ────────────────────────────────────────────────────────────
export const organizations = pgTable('organizations', {
  id:        uuid('id').primaryKey().defaultRandom(),
  name:      text('name').notNull(),
  slug:      text('slug').notNull().unique(),
  ownerId:   uuid('owner_id').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
  seatLimit: integer('seat_limit').notNull().default(5),
  /** No inline FK: would create a circular reference with plan_subscriptions.organization_id. Enforced at the app layer. */
  planSubscriptionId: uuid('plan_subscription_id'),
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
  /** Set when an admin approves a teacher application. Source of truth for whether the user qualifies as a verified K-12 teacher. */
  teacherVerifiedAt: timestamp('teacher_verified_at'),
  /** Captured during teacher application; useful for support and analytics. Null for non-teachers. */
  schoolName: text('school_name'),
  organizationId: uuid('organization_id').references(() => organizations.id),
  onboardingDismissedAt: timestamp('onboarding_dismissed_at'),
  stripeCustomerId: text('stripe_customer_id'),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
  updatedAt:      timestamp('updated_at').notNull().defaultNow(),
  lastLoginAt:    timestamp('last_login_at'),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

// ── Creator Profiles ──────────────────────────────────────────────────────────
export const creatorProfiles = pgTable('creator_profiles', {
  userId:                   uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  stripeAccountId:          text('stripe_account_id'),
  stripeOnboardingComplete: boolean('stripe_onboarding_complete').notNull().default(false),
  subscriptionEnabled:      boolean('subscription_enabled').notNull().default(false),
  subscriptionPriceCents:   integer('subscription_price_cents'),
  revenueThresholdCents:    integer('revenue_threshold_cents').notNull().default(100000),
  lifetimeRevenueCents:     integer('lifetime_revenue_cents').notNull().default(0),
  createdAt:                timestamp('created_at').notNull().defaultNow(),
  updatedAt:                timestamp('updated_at').notNull().defaultNow(),
})

export type CreatorProfile = typeof creatorProfiles.$inferSelect
export type NewCreatorProfile = typeof creatorProfiles.$inferInsert

// ── Lessons ──────────────────────────────────────────────────────────────────
export const lessonGenerationStatusEnum = pgEnum('lesson_generation_status', ['pending', 'generating', 'done', 'failed', 'retrying'])

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
  /** Null = draft (only creator can access); set = published (accessible to invited/enrolled users) */
  publishedAt:      timestamp('published_at'),
  /** When true and the lesson has an exam block, only exam score counts toward the final score */
  examEnforced:     boolean('exam_enforced').notNull().default(true),
  /** When true, lesson is publicly accessible without authentication and renders without chrome */
  showcase:         boolean('showcase').notNull().default(false),
  /** When true, this lesson is system content: immutable, marked "System" in internal UI. Toggleable only by internal admins. */
  isSystem:         boolean('is_system').notNull().default(false),
  priceCents:       integer('price_cents'),
  isPaid:           boolean('is_paid').notNull().default(false),
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
  lessonId:    uuid('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }),
  status:      attemptStatusEnum('status').notNull().default('in_progress'),
  score:       real('score'),
  totalBlocks: integer('total_blocks').notNull(),
  scoredBlocks: integer('scored_blocks'),
  blockResults: jsonb('block_results').$type<Record<string, {
    status: string
    score?: number
    questions?: Array<{ index: number; chosenIndex: number; correct: boolean }>
  }>>(),
  startedAt:   timestamp('started_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
})

export type LessonAttempt = typeof lessonAttempts.$inferSelect
export type NewLessonAttempt = typeof lessonAttempts.$inferInsert

// ── Lesson Invitations ────────────────────────────────────────────────────
export const lessonInvitations = pgTable('lesson_invitations', {
  id:        uuid('id').primaryKey().defaultRandom(),
  lessonId:  uuid('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }),
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
  lessonId:  uuid('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }).unique(),
  token:     text('token').notNull().unique(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export type LessonInviteLink = typeof lessonInviteLinks.$inferSelect
export type NewLessonInviteLink = typeof lessonInviteLinks.$inferInsert

// ── Onboarding Playlists ──────────────────────────────────────────────────────
export const onboardingPlaylists = pgTable('onboarding_playlists', {
  id:           uuid('id').primaryKey().defaultRandom(),
  segment:      onboardingSegmentEnum('segment').notNull(),
  lessonId:     uuid('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }),
  displayOrder: integer('display_order').notNull(),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  unique('onboarding_playlists_segment_lesson').on(t.segment, t.lessonId),
  unique('onboarding_playlists_segment_order').on(t.segment, t.displayOrder),
])

export type OnboardingPlaylist = typeof onboardingPlaylists.$inferSelect
export type NewOnboardingPlaylist = typeof onboardingPlaylists.$inferInsert

// ── Courses ───────────────────────────────────────────────────────────────────
export const courseStatusEnum = pgEnum('course_status', ['draft', 'generating', 'ready', 'published'])

export const courses = pgTable('courses', {
  id:          uuid('id').primaryKey().defaultRandom(),
  title:       text('title').notNull(),
  slug:        text('slug').notNull().unique(),
  description: text('description'),
  isPublic:    boolean('is_public').notNull().default(false),
  status:      courseStatusEnum('status').notNull().default('draft'),
  /** When true, this course is system content: immutable, marked "System" in internal UI. Toggleable only by internal admins. Cascades to all contained lessons on toggle. */
  isSystem:    boolean('is_system').notNull().default(false),
  priceCents:  integer('price_cents'),
  isPaid:      boolean('is_paid').notNull().default(false),
  /** When true, this course is publicly accessible for embedding on external sites */
  embeddable:  boolean('embeddable').notNull().default(false),
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
export const generationStatusEnum = pgEnum('generation_status', ['pending', 'generating', 'done', 'failed', 'retrying'])

export const chapterLessons = pgTable('chapter_lessons', {
  id:               uuid('id').primaryKey().defaultRandom(),
  chapterId:        uuid('chapter_id').notNull().references(() => courseChapters.id, { onDelete: 'cascade' }),
  lessonId:         uuid('lesson_id').references(() => lessons.id, { onDelete: 'cascade' }),
  title:            text('title').notNull(),
  position:         integer('position').notNull(),
  generationStatus: generationStatusEnum('generation_status').notNull().default('pending'),
  isDisabled:       boolean('is_disabled').notNull().default(false),
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

// ── Embed Events ─────────────────────────────────────────────────────────────
export const embedEvents = pgTable('embed_events', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  lessonId:           uuid('lesson_id').references(() => lessons.id, { onDelete: 'cascade' }),
  courseId:            uuid('course_id').references(() => courses.id, { onDelete: 'cascade' }),
  eventType:          text('event_type').notNull(),
  embedOrigin:        text('embed_origin').notNull(),
  anonymousSessionId: text('anonymous_session_id').notNull(),
  userId:             uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  payload:            jsonb('payload').$type<Record<string, unknown>>(),
  createdAt:          timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('embed_events_lesson_idx').on(t.lessonId),
  index('embed_events_course_idx').on(t.courseId),
  index('embed_events_created_idx').on(t.createdAt),
])

export type EmbedEvent = typeof embedEvents.$inferSelect
export type NewEmbedEvent = typeof embedEvents.$inferInsert

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

// ── Login Log ─────────────────────────────────────────────────────────────────
export const loginLog = pgTable('login_log', {
  id:            uuid('id').primaryKey().defaultRandom(),
  userId:        uuid('user_id').references(() => users.id),
  email:         text('email').notNull(),
  success:       boolean('success').notNull(),
  failureReason: text('failure_reason'),
  ipAddress:     text('ip_address'),
  userAgent:     text('user_agent'),
  createdAt:     timestamp('created_at').notNull().defaultNow(),
})

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

// ── Teacher Applications ──────────────────────────────────────────────────────
export const teacherApplicationStatusEnum = pgEnum('teacher_application_status', ['pending', 'approved', 'rejected'])
export const teacherApplicationSourceEnum = pgEnum('teacher_application_source', ['in_app', 'marketing'])

export const teacherApplications = pgTable('teacher_applications', {
  id:               uuid('id').primaryKey().defaultRandom(),
  userId:           uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  source:           teacherApplicationSourceEnum('source').notNull().default('in_app'),
  schoolName:       text('school_name').notNull(),
  gradeLevel:       text('grade_level').notNull(),
  proofDocumentUrl: text('proof_document_url').notNull(),
  status:           teacherApplicationStatusEnum('status').notNull().default('pending'),
  submittedAt:      timestamp('submitted_at').notNull().defaultNow(),
  reviewedAt:       timestamp('reviewed_at'),
  /** Admin who reviewed. Intentionally NOT cascade-on-delete: we preserve the audit trail
   *  even if the reviewing admin's account is later removed. */
  reviewedBy:       uuid('reviewed_by').references(() => users.id),
  rejectionReason:  text('rejection_reason'),
}, (t) => [
  // At most one pending application per user. Historical (approved/rejected) rows are
  // unconstrained, so users can reapply after rejection. Enforced at the DB layer to
  // make the apply route's duplicate check race-free.
  uniqueIndex('teacher_applications_one_pending_per_user')
    .on(t.userId)
    .where(sql`status = 'pending'`),
])

export type TeacherApplication = typeof teacherApplications.$inferSelect
export type NewTeacherApplication = typeof teacherApplications.$inferInsert

// ── Plan Subscriptions ────────────────────────────────────────────────────────
export const planSubscriptionTierEnum = pgEnum('plan_subscription_tier', [
  'pro',
  'teams',
])

export const planSubscriptionPeriodEnum = pgEnum('plan_subscription_period', [
  'monthly',
  'annual',
])

export const planSubscriptionStatusEnum = pgEnum('plan_subscription_status', [
  'active',
  'past_due',
  'canceled',
  'incomplete',
])

export const teamInvitationStatusEnum = pgEnum('team_invitation_status', [
  'pending',
  'accepted',
  'revoked',
  'expired',
])

export const planSubscriptions = pgTable(
  'plan_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subscriberUserId: uuid('subscriber_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'cascade',
    }),
    tier: planSubscriptionTierEnum('tier').notNull(),
    billingPeriod: planSubscriptionPeriodEnum('billing_period').notNull(),
    stripeCustomerId: text('stripe_customer_id').notNull(),
    stripeSubscriptionId: text('stripe_subscription_id').notNull().unique(),
    status: planSubscriptionStatusEnum('status').notNull(),
    currentPeriodEnd: timestamp('current_period_end').notNull(),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('plan_subscriptions_subscriber_idx').on(t.subscriberUserId),
    index('plan_subscriptions_organization_idx').on(t.organizationId),
    index('plan_subscriptions_org_active_idx')
      .on(t.organizationId)
      .where(sql`status = 'active'`),
    // Enforces single-active-sub-per-tier. Under the MVP assumption that a user
    // belongs to at most one org, this is sufficient. If multi-org membership is
    // later introduced, this index must be extended to include organizationId.
    uniqueIndex('plan_subscriptions_one_active_per_user_tier')
      .on(t.subscriberUserId, t.tier)
      .where(sql`status = 'active'`),
  ],
)

export type PlanSubscription = typeof planSubscriptions.$inferSelect
export type NewPlanSubscription = typeof planSubscriptions.$inferInsert

// ── Team Invitations ──────────────────────────────────────────────────────────
export const teamInvitations = pgTable(
  'team_invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    // Intentionally set null, not cascade: if the inviting admin's account is
    // deleted, we preserve pending invites so the new org owner can still
    // complete the invite flow.
    invitedByUserId: uuid('invited_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    token: text('token').notNull().unique(),
    status: teamInvitationStatusEnum('status').notNull().default('pending'),
    expiresAt: timestamp('expires_at').notNull(),
    acceptedByUserId: uuid('accepted_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('team_invitations_one_pending_per_email_per_org')
      .on(t.organizationId, t.email)
      .where(sql`status = 'pending'`),
  ],
)

export type TeamInvitation = typeof teamInvitations.$inferSelect
export type NewTeamInvitation = typeof teamInvitations.$inferInsert

// ── Creator Subscriptions ────────────────────────────────────────────────────
export const subscriptionStatusEnum = pgEnum('subscription_status', ['active', 'canceled', 'past_due'])

export const subscriptions = pgTable('subscriptions', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  subscriberId:         uuid('subscriber_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  creatorId:            uuid('creator_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  stripeSubscriptionId: text('stripe_subscription_id').notNull().unique(),
  status:               subscriptionStatusEnum('status').notNull(),
  currentPeriodEnd:     timestamp('current_period_end').notNull(),
  createdAt:            timestamp('created_at').notNull().defaultNow(),
  updatedAt:            timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  // Composite index for common lookups like "does this learner have an active sub to this creator?"
  index('subscriptions_subscriber_creator_status_idx').on(t.subscriberId, t.creatorId, t.status),
  // A learner may have at most one active subscription per creator. Historical (canceled/past_due)
  // rows are unconstrained so a learner can re-subscribe after cancellation.
  uniqueIndex('subscriptions_one_active_per_pair_idx')
    .on(t.subscriberId, t.creatorId)
    .where(sql`status = 'active'`),
])

export type Subscription = typeof subscriptions.$inferSelect
export type NewSubscription = typeof subscriptions.$inferInsert

// ── Purchases ─────────────────────────────────────────────────────────────────
export const purchases = pgTable('purchases', {
  id:                    uuid('id').primaryKey().defaultRandom(),
  buyerId:               uuid('buyer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // Intentionally NOT cascade: preserve the purchase/financial audit trail even
  // if the underlying content is later deleted. Matches the precedent set by
  // teacherApplications.reviewedBy.
  lessonId:              uuid('lesson_id').references(() => lessons.id, { onDelete: 'set null' }),
  courseId:              uuid('course_id').references(() => courses.id, { onDelete: 'set null' }),
  stripePaymentIntentId: text('stripe_payment_intent_id').notNull().unique(),
  amountCents:           integer('amount_cents').notNull(),
  creatorRevenueCents:   integer('creator_revenue_cents').notNull(),
  primrFeeCents:         integer('primr_fee_cents').notNull(),
  createdAt:             timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('purchases_buyer_lesson_idx').on(t.buyerId, t.lessonId),
  index('purchases_buyer_course_idx').on(t.buyerId, t.courseId),
  // Exactly one of lesson_id / course_id must be set per purchase row.
  check('purchases_exactly_one_target', sql`(${t.lessonId} IS NULL) != (${t.courseId} IS NULL)`),
])

export type Purchase = typeof purchases.$inferSelect
export type NewPurchase = typeof purchases.$inferInsert
