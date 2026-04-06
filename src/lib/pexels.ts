import type { LessonManifest } from '@primr/components'

interface PexelsPhoto {
  photographer: string
  src: { large: string }
}

interface PexelsSearchResponse {
  photos: PexelsPhoto[]
}

/**
 * Appended to the generation system prompt when includeImages is true.
 */
export const IMAGE_PROMPT_SNIPPET =
  '\n\nFor hero and narrative blocks that would benefit from a photograph, add a "pexelsQuery" field to props with a specific 2–4 word search term. For step-navigator blocks, add "pexelsQuery" to individual step objects (not the block-level props). Only add pexelsQuery when an image genuinely improves understanding — not every block needs one.'

/**
 * Fetches the best matching landscape photo from Pexels for a search query.
 * Returns null on any error or if no results found — never throws.
 */
export async function fetchPexelsPhoto(
  query: string,
  apiKey: string,
): Promise<{ src: string; alt: string } | null> {
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`
    const res = await fetch(url, { headers: { Authorization: apiKey } })
    if (!res.ok) return null
    const data = (await res.json()) as PexelsSearchResponse
    const photo = data.photos?.[0]
    if (!photo) return null
    return { src: photo.src.large, alt: query }
  } catch {
    return null
  }
}

/**
 * Walks a LessonManifest, resolves all pexelsQuery fields in parallel via
 * the Pexels API, writes image objects, and removes pexelsQuery fields.
 * If apiKey is empty or missing, returns immediately (no-op).
 * Never throws — per-query failures are silently swallowed.
 */
export async function enrichWithPexelsImages(
  manifest: LessonManifest,
  apiKey: string,
): Promise<void> {
  if (!apiKey) return

  type EnrichTarget =
    | { kind: 'block'; props: Record<string, unknown>; query: string }
    | { kind: 'step'; step: Record<string, unknown>; query: string }

  const targets: EnrichTarget[] = []

  for (const block of manifest.blocks) {
    const props = block.props as Record<string, unknown>
    if (
      (block.type === 'hero' || block.type === 'narrative') &&
      typeof props.pexelsQuery === 'string'
    ) {
      targets.push({ kind: 'block', props, query: props.pexelsQuery })
    }
    if (block.type === 'step-navigator' && Array.isArray(props.steps)) {
      for (const step of props.steps as Array<Record<string, unknown>>) {
        if (typeof step.pexelsQuery === 'string') {
          targets.push({ kind: 'step', step, query: step.pexelsQuery })
        }
      }
    }
  }

  if (targets.length === 0) return

  const results = await Promise.allSettled(
    targets.map(t => fetchPexelsPhoto(t.query, apiKey)),
  )

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i]
    const result = results[i]
    const photo = result.status === 'fulfilled' ? result.value : null

    if (target.kind === 'block') {
      if (photo && !target.props.image) target.props.image = { src: photo.src, alt: photo.alt }
      delete target.props.pexelsQuery
    } else {
      if (photo) target.step.image = { src: photo.src, alt: photo.alt, layout: 'beside' }
      delete target.step.pexelsQuery
    }
  }
}
