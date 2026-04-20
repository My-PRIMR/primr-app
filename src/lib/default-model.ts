import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { appSettings } from '@/db/schema'
import { DEFAULT_MODEL, modelById } from '@/lib/models'

// Runtime default model resolution. The admin settings page (primr-internal)
// can override the default model at runtime by writing to
// app_settings.default_model. Readers call getDefaultModel() on generation
// paths; the result is cached in-process for 60s so we don't hit the DB on
// every call.
//
// This module is server-only. It's separated from lib/models.ts so that
// client components (wizards, model selectors) can still import the MODELS
// registry without dragging the postgres client into the browser bundle.

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
