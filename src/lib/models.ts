export const MODELS = {
  haiku:  { id: 'claude-haiku-4-5-20251001', costCategory: 'LOW',    label: 'Haiku',  minRole: 'staff' as const },
  sonnet: { id: 'claude-sonnet-4-6',          costCategory: 'MEDIUM', label: 'Sonnet', minRole: 'staff' as const },
  opus:   { id: 'claude-opus-4-6',            costCategory: 'HIGH',   label: 'Opus',   minRole: 'admin' as const },
} as const

export type ModelKey = keyof typeof MODELS
export type CostCategory = 'LOW' | 'MEDIUM' | 'HIGH'

export const DAILY_CAPS: Record<CostCategory, number | null> = {
  LOW:    null,  // Haiku: never blocked
  MEDIUM: 25,    // Sonnet: 25 per day
  HIGH:   2,     // Opus: 2 per day (admin only)
}

export const DEFAULT_MODEL = MODELS.haiku.id

/** Returns the MODELS entry for a given model ID, or null if not found */
export function modelById(id: string) {
  return Object.values(MODELS).find(m => m.id === id) ?? null
}

/** Validate model ID and check role permission. Returns the model entry or null if unauthorized. */
export function resolveModel(modelId: string | undefined, internalRole: string | null | undefined) {
  if (!modelId) return MODELS.haiku  // default
  const model = modelById(modelId)
  if (!model) return null  // unknown model
  if (model.minRole === 'admin' && internalRole !== 'admin') return null
  if ((model.minRole === 'staff') && internalRole !== 'staff' && internalRole !== 'admin') return null
  return model
}
