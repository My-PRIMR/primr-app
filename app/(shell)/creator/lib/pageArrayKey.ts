/**
 * Maps block types that have internal page navigation to the prop key
 * that holds their page array. Used by LessonBlockEditor and BlockEditPanel
 * to sync activePage state with the correct array in the edit panel.
 */
export const PAGE_ARRAY_KEY: Record<string, string> = {
  'step-navigator': 'steps',
  'flashcard':      'cards',
  'quiz':           'questions',
}
