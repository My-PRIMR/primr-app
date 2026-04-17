import { db } from '@/db'
import { promptOverrides } from '@/db/schema'
import { eq } from 'drizzle-orm'

type Stage = 'toc' | 'outline' | 'lesson_gen'

/**
 * Resolve a prompt template for the given stage. Checks the prompt_overrides
 * table first (live override from the playground); falls back to the
 * file-based template if no override exists.
 *
 * No cache — the ~1ms DB lookup is negligible vs. the 10-30s AI call.
 */
export async function resolvePromptTemplate(
  stage: Stage,
  fallback: string
): Promise<string> {
  try {
    const row = await db.query.promptOverrides.findFirst({
      where: eq(promptOverrides.stage, stage),
    })
    return row?.template ?? fallback
  } catch (err) {
    // DB unreachable (cold start, connection pool exhausted) — degrade gracefully
    console.error(`[prompt-resolver] Failed to query prompt_overrides for stage=${stage}:`, err)
    return fallback
  }
}
