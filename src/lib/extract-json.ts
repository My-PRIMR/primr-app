import { jsonrepair } from 'jsonrepair'

/**
 * Robustly extract a JSON object or array from an LLM response that may
 * include markdown code fences, preamble text, or trailing commentary.
 * Falls back to jsonrepair for malformed output (unescaped newlines, trailing
 * commas, unterminated strings, etc.).
 *
 * Strategy (in order):
 * 1. Extract the content of the first ```json ... ``` or ``` ... ``` block.
 * 2. Slice from the first `{` or `[` to the last matching `}` or `]`.
 * 3. Use the raw string as-is.
 * Each candidate is first tried with JSON.parse, then with jsonrepair.
 */
export function extractJSON(raw: string): string {
  const candidates: string[] = []

  // 1. Try to pull out a fenced code block (only ```json or bare ```, not ```css etc.)
  const fenceMatch = raw.match(/```(?:json)?[ \t]*\n([\s\S]*?)```/)
  if (fenceMatch) candidates.push(fenceMatch[1].trim())

  // 2. Find the outermost JSON object or array
  const objStart = raw.indexOf('{')
  const arrStart = raw.indexOf('[')

  let start = -1
  let endChar = ''
  if (objStart !== -1 && (arrStart === -1 || objStart < arrStart)) {
    start = objStart; endChar = '}'
  } else if (arrStart !== -1) {
    start = arrStart; endChar = ']'
  }

  if (start !== -1) {
    const end = raw.lastIndexOf(endChar)
    if (end > start) candidates.push(raw.slice(start, end + 1))
  }

  candidates.push(raw.trim())

  // Try each candidate with JSON.parse first, then jsonrepair
  for (const candidate of candidates) {
    try {
      JSON.parse(candidate)
      return candidate
    } catch {
      try {
        return jsonrepair(candidate)
      } catch {
        // try next candidate
      }
    }
  }

  // Last resort: return the raw string and let the caller's JSON.parse throw
  return raw.trim()
}
