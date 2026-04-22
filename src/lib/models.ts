import type { PlanValue } from '@/plans'

export const MODELS = {
  // Anthropic
  haiku:    { id: 'claude-haiku-4-5-20251001', provider: 'anthropic' as const, costCategory: 'LOW',    label: 'Haiku',      minRole: 'staff' as const },
  sonnet:   { id: 'claude-sonnet-4-6',         provider: 'anthropic' as const, costCategory: 'MEDIUM', label: 'Sonnet',     minRole: 'staff' as const },
  opus:     { id: 'claude-opus-4-6',           provider: 'anthropic' as const, costCategory: 'HIGH',   label: 'Opus',       minRole: 'admin' as const },
  // Google
  flash:    { id: 'gemini-2.5-flash',          provider: 'google' as const,    costCategory: 'LOW',    label: 'Flash',      minRole: 'staff' as const },
  pro:      { id: 'gemini-2.5-pro',            provider: 'google' as const,    costCategory: 'MEDIUM', label: 'Pro',        minRole: 'staff' as const },
  // OpenAI
  gpt5mini: { id: 'gpt-5-mini',                provider: 'openai' as const,    costCategory: 'LOW',    label: 'GPT-5 mini', minRole: 'staff' as const },
  gpt5:     { id: 'gpt-5',                     provider: 'openai' as const,    costCategory: 'MEDIUM', label: 'GPT-5',      minRole: 'staff' as const },
} as const

export type ModelKey = keyof typeof MODELS
export type CostCategory = 'LOW' | 'MEDIUM' | 'HIGH'

/**
 * Per-tier monthly AI generation quotas, keyed by cost category.
 * - `number` = hard cap; once reached, generation is rejected with 429 until next UTC month.
 * - `null`   = unlimited.
 * - missing  = no allowance for that cost category (denied at resolveModel before the cap is reached).
 *
 * Opus (HIGH) is intentionally absent from every plan; it remains admin-only and is gated by role,
 * not plan, in resolveModel.
 */
export type MonthlyQuota = Partial<Record<CostCategory, number | null>>

export const MONTHLY_QUOTAS_BY_PLAN: Record<PlanValue, MonthlyQuota> = {
  free:       { LOW: 10 },
  teacher:    { LOW: 100 },                  // K-12 Application Program
  pro:        { LOW: 200, MEDIUM: 25 },
  enterprise: { LOW: null, MEDIUM: null },   // Unlimited
}

export const DEFAULT_MODEL = process.env.AI_DEFAULT_MODEL ?? MODELS.haiku.id

function hasStaffModelAccess(internalRole: string | null | undefined, productRole: string | null | undefined) {
  return internalRole === 'staff' || internalRole === 'admin' || productRole === 'org_admin'
}

function hasAdminModelAccess(internalRole: string | null | undefined, productRole: string | null | undefined) {
  return internalRole === 'admin' || productRole === 'org_admin'
}

/** Returns the MODELS entry for a given model ID, or null if not found */
export function modelById(id: string) {
  return Object.values(MODELS).find(m => m.id === id) ?? null
}

/** Validate model ID and check role/plan permission. Returns the model entry or null if unauthorized. */
export function resolveModel(
  modelId: string | undefined,
  internalRole: string | null | undefined,
  productRole?: string | null | undefined,
  plan?: string | null | undefined,
) {
  if (!modelId) return MODELS.haiku  // default
  const model = modelById(modelId)
  if (!model) return null  // unknown model
  if (model === MODELS.haiku) return model
  // Pro and Enterprise can opt into MEDIUM-cost models (Sonnet, Gemini Pro 2.5).
  // Their per-month allowance is enforced separately by checkMonthlyCap.
  if (model.costCategory === 'MEDIUM' && (plan === 'pro' || plan === 'enterprise')) return model
  if (model.minRole === 'admin' && !hasAdminModelAccess(internalRole, productRole)) return null
  if (model.minRole === 'staff' && !hasStaffModelAccess(internalRole, productRole)) return null
  return model
}

export function canSelectModels(
  internalRole: string | null | undefined,
  productRole?: string | null | undefined
) {
  return hasStaffModelAccess(internalRole, productRole)
}

export function canSelectOpus(
  internalRole: string | null | undefined,
  productRole?: string | null | undefined
) {
  return hasAdminModelAccess(internalRole, productRole)
}

export function canUsePexels(
  plan: string | null | undefined,
  internalRole: string | null | undefined
): boolean {
  return plan === 'teacher' || plan === 'pro' || plan === 'enterprise' || internalRole != null
}

export function canUseRichIngest(
  plan: string | null | undefined,
  internalRole: string | null | undefined
): boolean {
  return plan === 'teacher' || plan === 'pro' || plan === 'enterprise' || internalRole != null
}

export function canAiEdit(
  plan: string | null | undefined,
  internalRole: string | null | undefined
): boolean {
  return plan === 'teacher' || plan === 'pro' || plan === 'enterprise' || internalRole != null
}

/** Per-learner progress tracking — Teacher and Pro-and-up tiers can see who's done what. */
export function canTrackLearners(
  plan: string | null | undefined,
  internalRole: string | null | undefined,
): boolean {
  return plan === 'teacher' || plan === 'pro' || plan === 'enterprise' || internalRole != null
}

/** Course creation — Pro, Enterprise, and Teacher tiers only. Free tier is lessons-only. */
export function canCreateCourses(
  plan: string | null | undefined,
  internalRole: string | null | undefined
): boolean {
  return plan === 'teacher' || plan === 'pro' || plan === 'enterprise' || internalRole != null
}

/** Lesson monetization (selling content). Excludes Teacher tier — non-commercial use only. */
export function canMonetize(plan: string | null | undefined): boolean {
  return plan === 'pro' || plan === 'enterprise'
}

/** Multi-admin / multi-teacher workspaces. Currently only Enterprise — paid Teams isn't a real plan in DB yet. */
export function canHaveMultipleAdmins(plan: string | null | undefined): boolean {
  return plan === 'enterprise'
}

/** Free-tier cap on published lessons. Paid tiers and internal staff are unlimited. */
export const FREE_PUBLISHED_LESSON_LIMIT = 5

/**
 * Returns true if the user is allowed to publish one more lesson.
 * `currentPublishedCount` must exclude the lesson currently being (re)published;
 * callers should skip this check entirely when re-publishing an already-published lesson.
 */
export function canPublishAnotherLesson(
  plan: string | null | undefined,
  internalRole: string | null | undefined,
  currentPublishedCount: number,
): boolean {
  if (internalRole != null) return true
  if (plan === 'teacher' || plan === 'pro' || plan === 'enterprise') return true
  return currentPublishedCount < FREE_PUBLISHED_LESSON_LIMIT
}
