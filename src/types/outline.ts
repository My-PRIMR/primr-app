import type { LessonManifest, BlockConfig } from '@primr/components'

export type BlockType = 'hero' | 'narrative' | 'step-navigator' | 'quiz' | 'flashcard' | 'fill-in-the-blank'

export interface OutlineBlock {
  id: string
  type: BlockType
  summary: string
  itemCount?: number
}

export interface LessonOutline {
  title: string
  slug: string
  audience: string
  level: 'beginner' | 'intermediate' | 'advanced'
  blocks: OutlineBlock[]
}

export type WizardStep = 1 | 2 | 3 | 4 | 5

export interface WizardState {
  step: WizardStep
  // Step 1 inputs
  title: string
  topic: string
  audience: string
  level: 'beginner' | 'intermediate' | 'advanced'
  // Step 2-3 outline
  outline: LessonOutline | null
  // Step 4-5 result
  lessonId: string | null
  manifest: LessonManifest | null
  // UI state
  status: 'idle' | 'loading' | 'error'
  error: string
}

export type WizardAction =
  | { type: 'SET_FIELD'; field: keyof WizardState; value: unknown }
  | { type: 'SET_STEP'; step: WizardStep }
  | { type: 'SET_OUTLINE'; outline: LessonOutline }
  | { type: 'UPDATE_OUTLINE_BLOCKS'; blocks: OutlineBlock[] }
  | { type: 'SET_MANIFEST'; manifest: LessonManifest; lessonId: string }
  | { type: 'UPDATE_BLOCK'; index: number; block: BlockConfig }
  | { type: 'SET_STATUS'; status: WizardState['status']; error?: string }

export { type LessonManifest, type BlockConfig }
