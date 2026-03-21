// ── Course tree types (used in wizard state and API responses) ────────────────

export interface CourseLesson {
  localId: string  // client-generated ID for tracking before DB write
  title: string
  sourceText?: string
  audience?: string
  level?: string
  focus?: string  // creator-specified scope/focus hint fed into generation
  // Video chapter metadata — present when the lesson maps to a specific video chapter
  videoUrl?: string
  videoStartTime?: number
  videoEndTime?: number
}

export interface CourseChapter {
  localId: string
  title: string
  lessons: CourseLesson[]
}

export interface CourseSection {
  localId: string
  title: string
  inferred: boolean  // true if synthesized by Claude (not in original doc)
  chapters: CourseChapter[]
}

export interface CourseTree {
  title: string
  description: string
  sections: CourseSection[]
}

// ── Parse API response ────────────────────────────────────────────────────────

export interface ParsedCourseTree {
  title: string
  description: string
  sections: Array<{
    title: string
    inferred: boolean
    chapters: Array<{
      title: string
      lessons: Array<{
        title: string
        headingMarker: string
      }>
    }>
  }>
}

// ── DB-backed types (from API responses) ─────────────────────────────────────

export type GenerationStatus = 'pending' | 'generating' | 'done' | 'failed'
export type CourseStatus = 'draft' | 'generating' | 'ready' | 'published'

export interface FlatLesson {
  chapterLessonId: string
  chapterId: string
  sectionTitle: string
  chapterTitle: string
  title: string
  position: number  // global flat position (0-indexed)
  generationStatus: GenerationStatus
  lessonId: string | null
}

export interface CourseStatusResponse {
  courseId: string
  courseStatus: CourseStatus
  lessons: FlatLesson[]
}

export interface FullCourseTree {
  id: string
  title: string
  slug: string
  description: string | null
  isPublic: boolean
  status: CourseStatus
  createdBy: string | null
  sections: Array<{
    id: string
    title: string
    inferred: boolean
    position: number
    chapters: Array<{
      id: string
      title: string
      position: number
      lessons: Array<{
        id: string
        title: string
        position: number
        generationStatus: GenerationStatus
        lessonId: string | null
        isDisabled: boolean
      }>
    }>
  }>
}
