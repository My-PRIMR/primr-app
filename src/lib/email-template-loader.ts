const BASE_URL = () => process.env.PRIMR_APP_URL ?? 'http://localhost:3000'
const CACHE_CLEAR_INTERVAL_MS = 5 * 60 * 1000

const cache = new Map<string, string>()

// Periodically evict all cached templates so a redeployed app eventually picks up new versions.
const _interval = setInterval(() => cache.clear(), CACHE_CLEAR_INTERVAL_MS)
_interval.unref?.()

export async function loadTemplate(name: string): Promise<string> {
  const hit = cache.get(name)
  if (hit !== undefined) return hit

  const url = `${BASE_URL()}/email-templates/${name}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Email template "${name}" not found (${res.status} from ${url})`)
  const content = await res.text()
  cache.set(name, content)
  return content
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Replace {{key}} placeholders in a template string.
 *
 * - `vars`    — values are HTML-escaped before insertion (use for user-provided strings)
 * - `rawVars` — values are inserted verbatim (use for pre-built HTML fragments)
 */
export function render(
  template: string,
  vars: Record<string, string | number>,
  rawVars: Record<string, string> = {}
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (key in rawVars) return rawVars[key]
    if (key in vars) {
      const v = vars[key]
      return typeof v === 'number' ? String(v) : escapeHtml(v as string)
    }
    return match
  })
}
