import manifest from '@primr/tokens/themes.json'

type ManifestTheme = {
  id: string
  name: string
  tier: 'free' | 'pro' | 'enterprise'
  tagline: string
  description: string
  swatches: string[]
  recommendedFor?: string[]
}

type ManifestFile = { themes: ManifestTheme[] }

const typedManifest = manifest as ManifestFile

export const THEMES: ManifestTheme[] = typedManifest.themes
export const KNOWN_THEME_IDS: string[] = THEMES.map((t) => t.id)
export const DEFAULT_THEME = 'primr'

export type ThemeTier = 'free' | 'pro' | 'enterprise'
export type UserPlan = 'free' | 'teacher' | 'pro' | 'enterprise'

export function validateThemeId(id: string | null | undefined): string | null {
  if (!id) return null
  return KNOWN_THEME_IDS.includes(id) ? id : null
}

export function requiredTier(id: string): ThemeTier {
  const t = THEMES.find((t) => t.id === id)
  if (!t) throw new Error(`Unknown theme: ${id}`)
  return t.tier
}

const THEME_TIER_RANK: Record<ThemeTier, number> = {
  free: 0,
  pro: 1,
  enterprise: 2,
}

const PLAN_RANK: Record<UserPlan, number> = {
  free: 0,
  teacher: 1, // teacher plan unlocks pro-tier themes
  pro: 1,
  enterprise: 2,
}

export function canUseTheme(themeId: string, plan: UserPlan): boolean {
  const tier = requiredTier(themeId)
  return PLAN_RANK[plan] >= THEME_TIER_RANK[tier]
}
