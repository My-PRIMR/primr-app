export const MODELS = {
  // Anthropic
  haiku:  { id: 'claude-haiku-4-5-20251001', provider: 'anthropic' as const, costCategory: 'LOW',    label: 'Haiku',  minRole: 'staff' as const },
  sonnet: { id: 'claude-sonnet-4-6',         provider: 'anthropic' as const, costCategory: 'MEDIUM', label: 'Sonnet', minRole: 'staff' as const },
  opus:   { id: 'claude-opus-4-6',           provider: 'anthropic' as const, costCategory: 'HIGH',   label: 'Opus',   minRole: 'admin' as const },
  // Google
  flash:  { id: 'gemini-2.5-flash',          provider: 'google' as const,    costCategory: 'LOW',    label: 'Flash',  minRole: 'staff' as const },
  pro:    { id: 'gemini-2.5-pro',            provider: 'google' as const,    costCategory: 'MEDIUM', label: 'Pro',    minRole: 'staff' as const },
} as const

export type ModelKey = keyof typeof MODELS
export type CostCategory = 'LOW' | 'MEDIUM' | 'HIGH'

export const DAILY_CAPS: Record<CostCategory, number | null> = {
  LOW:    null,  // Haiku: never blocked
  MEDIUM: 25,    // Sonnet: 25 per day
  HIGH:   2,     // Opus: 2 per day (admin only)
}

export const DEFAULT_MODEL = process.env.AI_DEFAULT_MODEL ?? MODELS.haiku.id

// ── Runtime default model resolution ─────────────────────────────────────────
// The admin settings page (primr-internal) can override the default model at
// runtime by writing to app_settings.default_model. Readers call getDefaultModel()
// on generation paths; the result is cached in-process for 60s so we don't hit
// the DB on every call.

const DEFAULT_MODEL_CACHE_MS = 60_000
let cachedDefaultModel: { value: string; expiresAt: number } | null = null

/**
 * Invalidate the in-process default-model cache. Called by the admin writer
 * after a successful update; each app server instance that handles the write
 * will clear its own cache, and other instances pick up the change on next
 * TTL expiry.
 */
export function invalidateDefaultModelCache(): void {
  cachedDefaultModel = null
}

/**
 * Resolve the current global default model. Priority:
 *   1. app_settings.default_model (admin-configurable runtime override)
 *   2. AI_DEFAULT_MODEL env var
 *   3. Haiku (baked-in fallback)
 * Unknown IDs in the DB are ignored (logged, then fall through).
 */
export async function getDefaultModel(): Promise<string> {
  const now = Date.now()
  if (cachedDefaultModel && cachedDefaultModel.expiresAt > now) {
    return cachedDefaultModel.value
  }

  let resolved = DEFAULT_MODEL
  try {
    const { db } = await import('@/db')
    const { appSettings } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const row = await db.query.appSettings.findFirst({
      where: eq(appSettings.key, 'default_model'),
    })
    if (row?.value && modelById(row.value)) {
      resolved = row.value
    } else if (row?.value) {
      console.warn(`[getDefaultModel] app_settings.default_model="${row.value}" is not a known model; falling back`)
    }
  } catch (err) {
    console.error('[getDefaultModel] Failed to query app_settings; falling back to env/baked default:', err)
  }

  cachedDefaultModel = { value: resolved, expiresAt: now + DEFAULT_MODEL_CACHE_MS }
  return resolved
}

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

/** Validate model ID and check role permission. Returns the model entry or null if unauthorized. */
export function resolveModel(
  modelId: string | undefined,
  internalRole: string | null | undefined,
  productRole?: string | null | undefined
) {
  if (!modelId) return MODELS.haiku  // default
  const model = modelById(modelId)
  if (!model) return null  // unknown model
  // The default model (haiku) is always permitted — non-staff users receive it
  // without a model selector, but the request may still carry the default ID.
  if (model === MODELS.haiku) return model
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
