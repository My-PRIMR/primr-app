import { z } from 'zod'

// ── Block config ─────────────────────────────────────────────────────────────
// Props are intentionally loose (record of unknowns) because block types
// have wildly different prop shapes. The system prompt + BLOCK_SCHEMAS string
// tells the AI what props to generate; this schema validates structure only.

export const blockConfigSchema = z.object({
  id: z.string(),
  type: z.string(),
  props: z.record(z.string(), z.unknown()),
})

// ── Lesson manifest ──────────────────────────────────────────────────────────

export const lessonManifestSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  blocks: z.array(blockConfigSchema),
})

// ── Lesson outline ───────────────────────────────────────────────────────────

export const lessonOutlineSchema = z.object({
  title: z.string(),
  slug: z.string(),
  audience: z.string(),
  level: z.string(),
  blocks: z.array(z.object({
    id: z.string(),
    type: z.string(),
    summary: z.string(),
    itemCount: z.number().optional(),
  })),
})

// ── Course tree (from courses/parse) ─────────────────────────────────────────

const courseLessonSchema = z.object({
  title: z.string(),
  headingMarker: z.string(),
  videoChapterIndex: z.number().nullable().optional(),
  docMarker: z.string().nullable().optional(),
})

const courseChapterSchema = z.object({
  title: z.string(),
  lessons: z.array(courseLessonSchema),
})

const courseSectionSchema = z.object({
  title: z.string(),
  inferred: z.boolean(),
  chapters: z.array(courseChapterSchema),
})

export const courseTreeSchema = z.object({
  title: z.string(),
  description: z.string(),
  sections: z.array(courseSectionSchema),
})
