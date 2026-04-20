import { MODELS, canSelectModels, resolveModel, type CostCategory } from './models'
import type { ProviderKey } from './ai/providers'

const PROVIDER_LABELS: Record<ProviderKey, string> = {
  anthropic: 'Anthropic',
  google: 'Google',
  openai: 'OpenAI',
}

const COST_HINTS: Record<CostCategory, string> = {
  LOW: 'fast',
  MEDIUM: 'better',
  HIGH: 'best',
}

export interface ModelSelectOption {
  id: string
  label: string
}

export interface ModelSelectGroup {
  provider: ProviderKey
  providerLabel: string
  options: ModelSelectOption[]
}

/**
 * Groups MODELS by provider for rendering in a creator-side model selector.
 * Filters out entries the current user cannot select (per minRole + resolveModel).
 * Preserves MODELS insertion order within each provider group.
 */
export function modelSelectorGroups(
  internalRole: string | null | undefined,
  productRole: string | null | undefined,
): ModelSelectGroup[] {
  if (!canSelectModels(internalRole, productRole)) return []

  const byProvider = new Map<ProviderKey, ModelSelectOption[]>()

  for (const entry of Object.values(MODELS)) {
    if (resolveModel(entry.id, internalRole, productRole) === null) continue
    const options = byProvider.get(entry.provider) ?? []
    options.push({ id: entry.id, label: `${entry.label} (${COST_HINTS[entry.costCategory]})` })
    byProvider.set(entry.provider, options)
  }

  return Array.from(byProvider.entries()).map(([provider, options]) => ({
    provider,
    providerLabel: PROVIDER_LABELS[provider],
    options,
  }))
}
