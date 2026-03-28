import type { LessonManifest, BlockConfig } from '@primr/components'

export type BlockType = 'hero' | 'narrative' | 'step-navigator' | 'quiz' | 'flashcard' | 'fill-in-the-blank' | 'media'

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

/** An asset extracted from a source document during ingestion */
export interface DocumentAsset {
  /** 'image' = uploaded to Cloudinary; 'video' = YouTube URL; 'link' = other hyperlink */
  type: 'image' | 'video' | 'link'
  url: string
  /** 1-based page number where the asset was found */
  page: number
}

/** Lesson wizard is now 3 steps: 1=form, 2=loading, 3=editor */
export type WizardStep = 1 | 2 | 3

export interface WizardState {
  step: WizardStep
  // Step 1 inputs
  title: string
  topic: string
  audience: string
  level: 'beginner' | 'intermediate' | 'advanced'
  scope: string
  videoUrl: string
  structureSource: 'document' | 'video'
  documentText: string
  documentName: string
  documentAssets: DocumentAsset[]
  extractImages: boolean
  decodeQr: boolean
  // Result
  lessonId: string | null
  manifest: LessonManifest | null
  // UI state
  status: 'idle' | 'loading' | 'error'
  error: string
}

export type WizardAction =
  | { type: 'SET_FIELD'; field: keyof WizardState; value: unknown }
  | { type: 'SET_STEP'; step: WizardStep }
  | { type: 'SET_MANIFEST'; manifest: LessonManifest; lessonId: string }
  | { type: 'UPDATE_BLOCK'; index: number; block: BlockConfig }
  | { type: 'SET_STATUS'; status: WizardState['status']; error?: string }

export { type LessonManifest, type BlockConfig }
