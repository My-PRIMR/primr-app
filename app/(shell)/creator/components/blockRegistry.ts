import type { BlockConfig } from '@primr/components'

export interface BlockRegistryEntry {
  type: BlockConfig['type']
  label: string
  icon: string
  description: string
  category: string
}

export const BLOCK_CATEGORIES: { id: string; label: string; cols: 2 | 3; proOnly?: true }[] = [
  { id: 'core',        label: 'Core',        cols: 3 },
  { id: 'interactive', label: 'Interactive',  cols: 3 },
  { id: 'coding',      label: 'Coding',       cols: 2, proOnly: true },
  { id: 'math',        label: 'Math',         cols: 2, proOnly: true },
  { id: 'science',     label: 'Science',      cols: 2, proOnly: true },
  { id: 'language',    label: 'Language',     cols: 2, proOnly: true },
]

export const BLOCK_REGISTRY: BlockRegistryEntry[] = [
  // Core
  { type: 'narrative',         label: 'Narrative',             icon: '¶',  description: 'Rich text with eyebrow, title, body, and optional image',       category: 'core' },
  { type: 'step-navigator',    label: 'Step Walkthrough',      icon: '→',  description: 'Multi-step guide with optional code annotation panels',          category: 'core' },
  { type: 'quiz',              label: 'Quiz',                  icon: '?',  description: 'Multiple-choice questions with answer explanations',             category: 'core' },
  { type: 'flashcard',         label: 'Flashcards',            icon: '◇',  description: 'Flip-card deck for term / definition review',                    category: 'core' },
  { type: 'fill-in-the-blank', label: 'Fill in the Blank',     icon: '⎵',  description: 'Cloze-style prompt with typed answers',                          category: 'core' },
  { type: 'media',             label: 'Video',                 icon: '▶',  description: 'Embed a YouTube video with optional caption',                    category: 'core' },
  { type: 'exam',              label: 'Exam',                  icon: '✎',  description: 'Scored assessment with configurable pass threshold',             category: 'core' },
  { type: 'hero',              label: 'Hero',                  icon: '◈',  description: 'Full-width title card to open a lesson',                         category: 'core' },
  { type: 'hero-new',          label: 'Hero (TOC)',            icon: '✨', description: 'Lesson hero with an auto-generated table of contents',          category: 'core' },
  // Interactive
  { type: 'hotspot-image',     label: 'Hotspot Image',         icon: '🖼', description: 'Click regions on an image to reveal labels or info',            category: 'interactive' },
  { type: 'decision-tree',     label: 'Decision Tree',         icon: '⑂',  description: 'Branching scenario with learner choices',                        category: 'interactive' },
  { type: 'sort-rank',         label: 'Sort & Rank',           icon: '⇅',  description: 'Drag items into the correct order',                              category: 'interactive' },
  { type: 'chart-builder',     label: 'Chart Builder',         icon: '📊', description: 'Interactive bar or line chart with editable data',              category: 'interactive' },
  { type: 'clickable-map',     label: 'Clickable Map',         icon: '🗺', description: 'Click regions on a map or diagram',                             category: 'interactive' },
  // Coding
  { type: 'code-runner',       label: 'Code Runner',           icon: '⌨',  description: 'Write and execute code in-browser with test cases',              category: 'coding' },
  { type: 'sql-sandbox',       label: 'SQL Sandbox',           icon: '🗄', description: 'Query an in-browser SQLite database',                           category: 'coding' },
  // Math
  { type: 'equation-renderer', label: 'Equation Renderer',     icon: '∑',  description: 'Render and explore LaTeX mathematical expressions',              category: 'math' },
  { type: 'graph-plotter',     label: 'Graph Plotter',         icon: '📈', description: 'Plot and interact with mathematical functions',                  category: 'math' },
  { type: 'financial-calculator', label: 'Financial Calculator', icon: '$', description: 'Compound interest, loan, and investment calculations',          category: 'math' },
  { type: 'physics-simulator', label: 'Physics Simulator',     icon: '⚙',  description: 'Simulate forces, motion, and collisions interactively',          category: 'math' },
  // Science
  { type: 'reaction-balancer', label: 'Reaction Balancer',     icon: '⚗',  description: 'Balance chemical equations by adjusting coefficients',           category: 'science' },
  { type: 'anatomy-labeler',   label: 'Anatomy Labeler',       icon: '🫁', description: 'Drag labels onto anatomical diagrams or images',                category: 'science' },
  { type: 'circuit-builder',   label: 'Circuit Builder',       icon: '⚡', description: 'Wire components and simulate voltage and current',               category: 'science' },
  // Language
  { type: 'audio-pronunciation', label: 'Audio Pronunciation', icon: '🔊', description: 'Listen to and practise word pronunciation',                     category: 'language' },
  { type: 'statute-annotator', label: 'Statute Annotator',     icon: '⚖',  description: 'Annotate legal text with highlights and notes',                  category: 'language' },
]
