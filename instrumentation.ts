/**
 * Next.js instrumentation — runs once on server startup.
 * Used to recover courses left in 'generating' status after a crash or restart.
 *
 * We await the module import (so Next.js correctly scopes the `postgres`
 * dependency to the Node runtime) but DO NOT await the recovery function
 * itself, so startup isn't blocked by the DB work.
 */
export async function register() {
  // Only run on the Node.js server, not during build or edge runtime
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { recoverStuckCourses } = await import('@/lib/course-recovery')
    // Fire-and-forget: don't block startup on recovery DB work
    recoverStuckCourses().catch(err =>
      console.error('[instrumentation] course recovery failed:', err),
    )
  }
}
