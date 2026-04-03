/**
 * Single source of truth for Primr lesson block types.
 *
 * isInteractive: true  — block gates progress or requires learner action (quiz, fill-in-the-blank, flashcard)
 * isInteractive: false — block is purely presentational, no gating (hero, narrative, step-navigator, media)
 *
 * Used to build AI generation prompts and to derive the allowed block list
 * for informational-only (passive) lessons.
 *
 * To add a new block: add an entry to RAW_DEFINITIONS. The schema string
 * for AI prompt injection is built automatically from the typed PropDef structure.
 */

// ── Schema types ──────────────────────────────────────────────────────────────

/** Definition of a single prop for use in AI generation prompts. */
export interface PropDef {
  /** TypeScript-style type string, e.g. "string", "number", "Array<{ id: string, label: string }>" */
  type: string
  /** Whether the prop must be present. Renders as "(required)" in the schema string. */
  required?: boolean
  /** Human-readable description injected into the AI prompt. */
  description?: string
  /** Default value, rendered as "— default: value". */
  default?: string
}

/** Full definition of a block type, used to build the AI schema string and derived type lists. */
export interface BlockSchemaDef {
  type: string
  isInteractive: boolean
  props: Record<string, PropDef>
  /** Block-level notes appended after props, e.g. "IMPORTANT: Each answer must be 1-2 words only." */
  notes?: string[]
}

/** Compiled block definition — schema string ready for AI prompt injection. */
export interface BlockDef {
  type: string
  isInteractive: boolean
  schema: string
}

// ── Schema builder ─────────────────────────────────────────────────────────────

function buildSchema({ type, props, notes }: BlockSchemaDef): string {
  const lines = Object.entries(props).map(([name, p]) => {
    const opt = p.required ? '' : '?'
    const req = p.required ? ' (required)' : ''
    const desc = p.description ? ` — ${p.description}` : ''
    const dflt = p.default !== undefined ? ` — default: ${p.default}` : ''
    return `  ${name}${opt}: ${p.type}${req}${desc}${dflt}`
  })
  const noteLines = (notes ?? []).map(n => `  ${n}`)
  return [type + ':', ...lines, ...noteLines].join('\n')
}

// ── Common props ──────────────────────────────────────────────────────────────

/** badge and title appear on most blocks. Spread into props where applicable. */
const common: Record<string, PropDef> = {
  badge: { type: 'string' },
  title: { type: 'string' },
}

// ── Block definitions ─────────────────────────────────────────────────────────

const RAW_DEFINITIONS: BlockSchemaDef[] = [
  {
    type: 'hero',
    isInteractive: false,
    props: {
      title:   { type: 'string', required: true, description: 'large serif title' },
      tagline: { type: 'string', description: 'one sentence' },
      meta:    { type: "Array<{ label: string, icon?: 'clock' | 'level' | 'tag' }>" },
      cta:     { type: 'string', description: 'CTA button label', default: '"Start lesson"' },
    },
  },
  {
    type: 'narrative',
    isInteractive: false,
    props: {
      body:    { type: 'string', required: true, description: 'markdown text, comprehensive enough that learners can answer all follow-up interactive blocks from it alone' },
      title:   { type: 'string', description: 'serif heading' },
      eyebrow: { type: 'string', description: 'small uppercase label' },
      image:   { type: '{ src: string, alt?: string, caption?: string }', description: 'optional image rendered between title and body' },
    },
  },
  {
    type: 'step-navigator',
    isInteractive: false,
    props: {
      steps: { type: 'Array<{ title: string, body: string, hint?: string }>', required: true },
      badge: { type: 'string', description: 'e.g. "Step walkthrough"' },
      title: { type: 'string' },
    },
  },
  {
    type: 'media',
    isInteractive: false,
    props: {
      url:        { type: 'string', required: true, description: 'YouTube or Vimeo URL' },
      title:      { type: 'string', description: 'heading above the video' },
      badge:      { type: 'string', description: 'small label', default: '"Video"' },
      caption:    { type: 'string', description: 'one-sentence description below the video' },
      startTime:  { type: 'number', description: 'start time in seconds' },
      endTime:    { type: 'number', description: 'end time in seconds' },
      completeOn: { type: '"mount" | "end"', description: '"end" requires the learner to mark as watched, "mount" auto-completes', default: '"end"' },
    },
  },
  {
    type: 'quiz',
    isInteractive: true,
    props: {
      questions: { type: 'Array<{ prompt: string, options: string[], correctIndex: number, explanation?: string }>', required: true },
      passScore: { type: 'number', description: '0 to 1' },
      ...common,
    },
  },
  {
    type: 'flashcard',
    isInteractive: true,
    props: {
      cards: { type: 'Array<{ front: string, back: string }>', required: true },
      ...common,
    },
  },
  {
    type: 'fill-in-the-blank',
    isInteractive: true,
    props: {
      prompt:  { type: 'string', required: true, description: 'text with {{blank}} placeholders' },
      answers: { type: 'Array<string | string[]>', required: true, description: 'one entry per blank, can be array of accepted answers' },
      hint:    { type: 'string' },
      ...common,
    },
    notes: ['IMPORTANT: Each answer must be 1-2 words only, no punctuation.'],
  },
  {
    type: 'exam',
    isInteractive: true,
    props: {
      questions: {
        type: 'Array<{ prompt: string, options: string[], correctIndex: number, explanation?: string }>',
        required: true,
        description: '5–12 comprehensive questions covering the full lesson. No immediate feedback — all revealed on submission.',
      },
      summary: { type: 'string', description: 'Brief 2–4 sentence recap of the lesson shown before questions begin' },
      ...common,
    },
    notes: [
      'IMPORTANT: Always place the exam block as the LAST block in the lesson.',
      'Questions should span the full lesson content, not just recent sections.',
      'Use 5–10 questions for short lessons, up to 12 for longer lessons.',
    ],
  },
  // ── Phase 1 — Foundation ────────────────────────────────────────────────────
  {
    type: 'hotspot-image',
    isInteractive: true,
    props: {
      imageUrl: { type: 'string', required: true, description: 'URL of the diagram or photo' },
      imageAlt: { type: 'string', description: 'alt text' },
      hotspots: { type: 'Array<{ id: string, label: string, description?: string, x: number, y: number }>', required: true, description: 'x/y are percentages (0–100) of image dimensions' },
      ...common,
    },
  },
  {
    type: 'decision-tree',
    isInteractive: true,
    props: {
      rootId: { type: 'string', required: true, description: 'ID of the first node to display' },
      nodes:  { type: 'Array<{ id: string, prompt: string, description?: string, choices?: Array<{ label: string, nextId: string }> }>', required: true, description: 'nodes with no choices are terminal outcomes' },
      ...common,
    },
  },
  {
    type: 'sort-rank',
    isInteractive: true,
    props: {
      items:  { type: 'Array<{ id: string, label: string, correctPosition: number }>', required: true, description: 'correctPosition is 0-based index in the correct order' },
      prompt: { type: 'string', description: 'instruction text' },
      ...common,
    },
  },
  {
    type: 'code-runner',
    isInteractive: true,
    props: {
      language:     { type: '"javascript" | "python"', default: '"javascript"' },
      starterCode:  { type: 'string', description: 'initial code in the editor' },
      instructions: { type: 'string', description: 'text shown above the editor' },
      ...common,
    },
  },
  {
    type: 'equation-renderer',
    isInteractive: false,
    props: {
      equations: { type: 'Array<{ latex: string, label?: string, explanation?: string, displayMode?: boolean }>', required: true, description: 'latex is a LaTeX expression string' },
      ...common,
    },
  },
  {
    type: 'graph-plotter',
    isInteractive: false,
    props: {
      functions: { type: 'Array<{ expression: string, label?: string, color?: string }>', required: true, description: 'expression uses x as variable, supports sin/cos/sqrt/etc.' },
      xMin:      { type: 'number', default: '-10' },
      xMax:      { type: 'number', default: '10' },
      yMin:      { type: 'number', default: '-10' },
      yMax:      { type: 'number', default: '10' },
      ...common,
    },
  },
  // ── Phase 2 — STEM expansion ────────────────────────────────────────────────
  {
    type: 'reaction-balancer',
    isInteractive: true,
    props: {
      reactants: { type: 'Array<{ id: string, formula: string, name?: string }>', required: true, description: 'left-side species, formula like "H2O"' },
      products:  { type: 'Array<{ id: string, formula: string, name?: string }>', required: true, description: 'right-side species' },
      ...common,
    },
  },
  {
    type: 'anatomy-labeler',
    isInteractive: true,
    props: {
      imageUrl: { type: 'string', required: true, description: 'URL of the anatomical diagram' },
      imageAlt: { type: 'string' },
      regions:  { type: 'Array<{ id: string, label: string, x: number, y: number }>', required: true, description: 'x/y as percentages (0–100)' },
      ...common,
    },
  },
  {
    type: 'circuit-builder',
    isInteractive: true,
    props: {
      availableComponents: { type: 'Array<{ type: string, label?: string }>', required: true, description: 'types: "battery", "resistor", "led", "bulb", "switch", "wire"' },
      ...common,
    },
  },
  {
    type: 'chart-builder',
    isInteractive: true,
    props: {
      data:      { type: 'Array<{ label: string, value: number, color?: string }>', required: true, description: 'initial data points' },
      chartType: { type: '"bar" | "line" | "pie"', default: '"bar"' },
      ...common,
    },
  },
  {
    type: 'clickable-map',
    isInteractive: true,
    props: {
      imageUrl: { type: 'string', required: true, description: 'URL of a real background image. Use empty string "" if no image is available — do NOT use placeholder.com, picsum, or any dummy URL.' },
      imageAlt: { type: 'string' },
      regions:  { type: 'Array<{ id: string, label: string, description?: string, x: number, y: number, width?: number, height?: number }>', required: true, description: 'x/y/width/height as percentages (0–100)' },
      mode:     { type: '"explore" | "identify"', default: '"explore"' },
      ...common,
    },
  },
  // ── Phase 3 — Professional & Creative ──────────────────────────────────────
  {
    type: 'sql-sandbox',
    isInteractive: true,
    props: {
      tables:       { type: 'Array<{ name: string, columns: Array<{ name: string, type: string }>, rows: Array<Record<string, string|number|null>> }>', required: true },
      starterQuery: { type: 'string', description: 'initial SQL shown in editor' },
      ...common,
    },
  },
  {
    type: 'audio-pronunciation',
    isInteractive: true,
    props: {
      words:    { type: 'Array<{ word: string, ipa?: string, translation?: string, example?: string, audioUrl?: string }>', required: true },
      language: { type: 'string', description: 'BCP-47 tag e.g. "en-US", "es-ES", "fr-FR"', default: '"en-US"' },
      ...common,
    },
  },
  {
    type: 'financial-calculator',
    isInteractive: false,
    props: {
      mode:                  { type: '"compound" | "loan" | "roi"', default: '"compound"' },
      defaultPrincipal:      { type: 'number' },
      defaultRate:           { type: 'number', description: 'annual rate as percent, e.g. 7 for 7%' },
      defaultYears:          { type: 'number' },
      defaultCompoundFreq:   { type: 'number', default: '12' },
      defaultLoanAmount:     { type: 'number' },
      defaultLoanRate:       { type: 'number' },
      defaultLoanTermMonths: { type: 'number' },
      defaultInvestment:     { type: 'number' },
      defaultGain:           { type: 'number' },
      ...common,
    },
  },
  {
    type: 'statute-annotator',
    isInteractive: true,
    props: {
      text: { type: 'string', required: true, description: 'the full document or clause text to annotate' },
      tags: { type: 'Array<{ id: string, label: string, color: string }>', description: 'annotation categories, defaults to: Obligation/Exception/Definition/Right/Penalty' },
      ...common,
    },
  },
  {
    type: 'physics-simulator',
    isInteractive: false,
    props: {
      simulation: { type: '"projectile" | "pendulum" | "spring"', default: '"projectile"' },
      ...common,
    },
  },
]

// ── Exports ───────────────────────────────────────────────────────────────────

export const BLOCK_DEFINITIONS: BlockDef[] = RAW_DEFINITIONS.map(def => ({
  type: def.type,
  isInteractive: def.isInteractive,
  schema: buildSchema(def),
}))

export const INFORMATIONAL_TYPES = BLOCK_DEFINITIONS
  .filter(b => !b.isInteractive)
  .map(b => b.type)

export const INTERACTIVE_TYPES = BLOCK_DEFINITIONS
  .filter(b => b.isInteractive)
  .map(b => b.type)

export const ALL_BLOCK_TYPES = BLOCK_DEFINITIONS.map(b => b.type)

/** Per-type schema string lookup — convenience map for single-block prompt injection. */
export const BLOCK_SCHEMA_MAP: Record<string, string> = Object.fromEntries(
  BLOCK_DEFINITIONS.map(b => [b.type, b.schema])
)

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
  