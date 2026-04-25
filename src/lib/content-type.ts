export type ContentType = 'general' | 'stem_math' | 'stem_science' | 'language_arts'

export const CONTENT_TYPES: ContentType[] = ['general', 'stem_math', 'stem_science', 'language_arts']

export function isAcademicContentType(ct: ContentType): boolean {
  return ct === 'stem_math' || ct === 'stem_science' || ct === 'language_arts'
}

export const STEM_LESSON_GEN_OVERRIDE = `

IMPORTANT — Academic content mode: This lesson covers STEM or academic subject matter. Apply these additional rules:
- Verify all formulas, equations, and numerical values for correctness before including them.
- Use precise domain-specific terminology; do not paraphrase technical concepts with casual language.
- For mathematics content, include at least one worked example showing step-by-step reasoning.
- For science content, state the underlying principle or mechanism, not only the observable result.
- Quiz and exam questions must test conceptual understanding and application, not only factual recall.`

export const STEM_OUTLINE_OVERRIDE = `

IMPORTANT — Academic content mode: This lesson covers STEM or academic subject matter. Ensure:
- At least one block in the outline is dedicated to worked examples or step-by-step problem solving.
- The exam block tests quantitative reasoning or technical application, not only recall.`
