/**
 * Robustly extract a JSON object or array from an LLM response that may
 * include markdown code fences, preamble text, or trailing commentary.
 *
 * Strategy (in order):
 * 1. Extract the content of the first ```json ... ``` or ``` ... ``` block.
 * 2. Slice from the first `{` or `[` to the last matching `}` or `]`.
 * 3. Return the raw string as-is (let JSON.parse throw a useful error).
 */
export function extractJSON(raw: string): string {
  // 1. Try to pull out a fenced code block
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) return fenceMatch[1].trim()

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
    if (end > start) return raw.slice(start, end + 1)
  }

  return raw.trim()
}
