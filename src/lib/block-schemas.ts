/**
 * Single source of truth for Primr lesson block types.
 *
 * isInteractive: true  — block gates progress or requires learner action (quiz, fill-in-the-blank, flashcard)
 * isInteractive: false — block is purely presentational, no gating (hero, narrative, step-navigator, media)
 *
 * Used to build AI generation prompts and to derive the allowed block list
 * for informational-only (passive) lessons.
 */

export interface BlockDef {
  type: string
  /** Whether the block gates progress or requires the learner to complete an action. */
  isInteractive: boolean
  /** Prop schema description injected into AI generation prompts. */
  schema: string
}

export const BLOCK_DEFINITIONS: BlockDef[] = [
  {
    type: 'hero',
    isInteractive: false,
    schema: `hero:
  title: string (required) — large serif title
  tagline?: string — one sentence
  meta?: Array<{ label: string, icon?: 'clock' | 'level' | 'tag' }>
  cta?: string — CTA button label (default: "Start lesson")`,
  },
  {
    type: 'narrative',
    isInteractive: false,
    schema: `narrative:
  body: string (required) — markdown text, comprehensive enough that learners can answer all follow-up interactive blocks from it alone
  title?: string — serif heading
  eyebrow?: string — small uppercase label`,
  },
  {
    type: 'step-navigator',
    isInteractive: false,
    schema: `step-navigator:
  steps: Array<{ title: string, body: string, hint?: string }>
  badge?: string — e.g. "Step walkthrough"
  title?: string`,
  },
  {
    type: 'media',
    isInteractive: false,
    schema: `media:
  url: string (required) — YouTube or Vimeo URL
  title?: string — heading above the video
  badge?: string — small label (default: "Video")
  caption?: string — one-sentence description below the video
  startTime?: number — start time in seconds
  endTime?: number — end time in seconds
  completeOn?: "mount" | "end" — "end" requires the learner to mark as watched (default), "mount" auto-completes`,
  },
  {
    type: 'quiz',
    isInteractive: true,
    schema: `quiz:
  questions: Array<{ prompt: string, options: string[], correctIndex: number, explanation?: string }>
  badge?: string
  title?: string
  passScore?: number — 0 to 1`,
  },
  {
    type: 'flashcard',
    isInteractive: true,
    schema: `flashcard:
  cards: Array<{ front: string, back: string }>
  badge?: string
  title?: string`,
  },
  {
    type: 'fill-in-the-blank',
    isInteractive: true,
    schema: `fill-in-the-blank:
  prompt: string — text with {{blank}} placeholders
  answers: Array<string | string[]> — one entry per blank, can be array of accepted answers
  badge?: string
  title?: string
  hint?: string
  IMPORTANT: Each answer must be 1-2 words only, no punctuation.`,
  },
]

// ── Derived constants ─────────────────────────────────────────────────────────

export const INFORMATIONAL_TYPES = BLOCK_DEFINITIONS
  .filter(b => !b.isInteractive)
  .map(b => b.type)

export const INTERACTIVE_TYPES = BLOCK_DEFINITIONS
  .filter(b => b.isInteractive)
  .map(b => b.type)

export const ALL_BLOCK_TYPES = BLOCK_DEFINITIONS.map(b => b.type)

/** Full prop schema string for injection into AI generation prompts. */
export const BLOCK_SCHEMAS = `Block prop schemas:\n\n${BLOCK_DEFINITIONS.map(b => b.schema).join('\n\n')}`

/**
 * System prompt addendum for informational-only (passive) lessons.
 * Derived from isInteractive metadata — no manual list maintenance required.
 */
export const PASSIVE_LESSON_OVERRIDE =
  `\n\nIMPORTANT: This is an informational-only lesson. ` +
  `Allowed block types: ${INFORMATIONAL_TYPES.join(', ')}. ` +
  `Forbidden block types: ${INTERACTIVE_TYPES.join(', ')} — all gate progress and require learner action. ` +
  `step-navigator is a slide-by-slide walkthrough with no gating or correct answers and must be used freely wherever sequential or step-based content fits. ` +
  `Do not avoid step-navigator — it is encouraged.`
