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
  // ── Phase 1 — Foundation ────────────────────────────────────────────────────
  {
    type: 'hotspot-image',
    isInteractive: true,
    schema: `hotspot-image:
  imageUrl: string (required) — URL of the diagram or photo
  imageAlt?: string — alt text
  hotspots: Array<{ id: string, label: string, description?: string, x: number, y: number }> — x/y are percentages (0–100) of image dimensions
  badge?: string
  title?: string`,
  },
  {
    type: 'decision-tree',
    isInteractive: true,
    schema: `decision-tree:
  rootId: string (required) — ID of the first node to display
  nodes: Array<{ id: string, prompt: string, description?: string, choices?: Array<{ label: string, nextId: string }> }> — nodes with no choices are terminal outcomes
  badge?: string
  title?: string`,
  },
  {
    type: 'sort-rank',
    isInteractive: true,
    schema: `sort-rank:
  items: Array<{ id: string, label: string, correctPosition: number }> — correctPosition is 0-based index in the correct order
  prompt?: string — instruction text
  badge?: string
  title?: string`,
  },
  {
    type: 'code-runner',
    isInteractive: true,
    schema: `code-runner:
  language?: "javascript" | "python" — default "javascript"
  starterCode?: string — initial code in the editor
  instructions?: string — text shown above the editor
  badge?: string
  title?: string`,
  },
  {
    type: 'equation-renderer',
    isInteractive: false,
    schema: `equation-renderer:
  equations: Array<{ latex: string, label?: string, explanation?: string, displayMode?: boolean }> — latex is a LaTeX expression string
  badge?: string
  title?: string`,
  },
  {
    type: 'graph-plotter',
    isInteractive: false,
    schema: `graph-plotter:
  functions: Array<{ expression: string, label?: string, color?: string }> — expression uses x as variable, supports sin/cos/sqrt/etc.
  xMin?: number — default -10
  xMax?: number — default 10
  yMin?: number — default -10
  yMax?: number — default 10
  badge?: string
  title?: string`,
  },
  // ── Phase 2 — STEM expansion ────────────────────────────────────────────────
  {
    type: 'reaction-balancer',
    isInteractive: true,
    schema: `reaction-balancer:
  reactants: Array<{ id: string, formula: string, name?: string }> — left-side species, formula like "H2O"
  products: Array<{ id: string, formula: string, name?: string }> — right-side species
  badge?: string
  title?: string`,
  },
  {
    type: 'anatomy-labeler',
    isInteractive: true,
    schema: `anatomy-labeler:
  imageUrl: string (required) — URL of the anatomical diagram
  imageAlt?: string
  regions: Array<{ id: string, label: string, x: number, y: number }> — x/y as percentages (0–100)
  badge?: string
  title?: string`,
  },
  {
    type: 'circuit-builder',
    isInteractive: true,
    schema: `circuit-builder:
  availableComponents: Array<{ type: string, label?: string }> — types: "battery", "resistor", "led", "bulb", "switch", "wire"
  badge?: string
  title?: string`,
  },
  {
    type: 'chart-builder',
    isInteractive: true,
    schema: `chart-builder:
  data: Array<{ label: string, value: number, color?: string }> — initial data points
  chartType?: "bar" | "line" | "pie" — default "bar"
  badge?: string
  title?: string`,
  },
  {
    type: 'clickable-map',
    isInteractive: true,
    schema: `clickable-map:
  imageUrl: string (required) — URL of the map image
  imageAlt?: string
  regions: Array<{ id: string, label: string, description?: string, x: number, y: number, width?: number, height?: number }> — x/y/width/height as percentages (0–100)
  mode?: "explore" | "identify" — default "explore"
  badge?: string
  title?: string`,
  },
  // ── Phase 3 — Professional & Creative ──────────────────────────────────────
  {
    type: 'sql-sandbox',
    isInteractive: true,
    schema: `sql-sandbox:
  tables: Array<{ name: string, columns: Array<{ name: string, type: string }>, rows: Array<Record<string, string|number|null>> }>
  starterQuery?: string — initial SQL shown in editor
  badge?: string
  title?: string`,
  },
  {
    type: 'audio-pronunciation',
    isInteractive: true,
    schema: `audio-pronunciation:
  words: Array<{ word: string, ipa?: string, translation?: string, example?: string, audioUrl?: string }>
  language?: string — BCP-47 tag e.g. "en-US", "es-ES", "fr-FR" — default "en-US"
  badge?: string
  title?: string`,
  },
  {
    type: 'financial-calculator',
    isInteractive: false,
    schema: `financial-calculator:
  mode?: "compound" | "loan" | "roi" — default "compound"
  defaultPrincipal?: number
  defaultRate?: number — annual rate as percent, e.g. 7 for 7%
  defaultYears?: number
  defaultCompoundFreq?: number — default 12
  defaultLoanAmount?: number
  defaultLoanRate?: number
  defaultLoanTermMonths?: number
  defaultInvestment?: number
  defaultGain?: number
  badge?: string
  title?: string`,
  },
  {
    type: 'statute-annotator',
    isInteractive: true,
    schema: `statute-annotator:
  text: string (required) — the full document or clause text to annotate
  tags?: Array<{ id: string, label: string, color: string }> — annotation categories, defaults to: Obligation/Exception/Definition/Right/Penalty
  badge?: string
  title?: string`,
  },
  {
    type: 'physics-simulator',
    isInteractive: false,
    schema: `physics-simulator:
  simulation?: "projectile" | "pendulum" | "spring" — default "projectile"
  badge?: string
  title?: string`,
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
