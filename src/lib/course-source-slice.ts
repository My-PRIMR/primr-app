/**
 * Shared helpers for slicing course source text.
 *
 * Used by:
 * - app/api/courses/parse/route.ts — production TOC extraction + per-lesson slicing
 * - primr-internal TOC playground (via mirror copy) — same pre-processing for scorable runs
 */

/**
 * Slice `fullText` from the first occurrence of `marker` up to (but not including)
 * `nextMarker`. If `nextMarker` is undefined or not found, returns from `marker`
 * to end of text. Cap at 8,000 chars for downstream prompt budget.
 * Returns empty string if `marker` is not found.
 */
export function sliceTextByMarker(fullText: string, marker: string, nextMarker: string | undefined): string {
  const startIdx = fullText.indexOf(marker)
  if (startIdx === -1) return ''
  const endIdx = nextMarker ? fullText.indexOf(nextMarker, startIdx + 1) : -1
  const chunk = endIdx === -1 ? fullText.slice(startIdx) : fullText.slice(startIdx, endIdx)
  return chunk.slice(0, 8000).trim()
}

/**
 * Locate the Table of Contents region in a document. Returns up to 30,000
 * chars from the TOC marker forward (enough for very long TOCs, small enough
 * to be a focused input for the model). Null if no marker found.
 *
 * When a TOC is present, sending only that section to the model (instead of
 * 200K chars of mixed TOC + content) dramatically improves structural
 * extraction accuracy.
 */
export function extractTocSection(text: string): string | null {
  // Case-insensitive match for "Table of Contents" or a bare "Contents" line
  const tocMatch = text.match(/(table of contents|^contents\s*$)/im)
  if (!tocMatch || tocMatch.index == null) return null
  const start = tocMatch.index
  return text.slice(start, start + 30000)
}
