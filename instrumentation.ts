/**
 * Next.js instrumentation — runs once on server startup.
 * Used to recover courses left in 'generating' status after a crash or restart.
 */
export async function register() {
  // Only run on the Node.js server, not during build or edge runtime
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { recoverStuckCourses } = await import('@/lib/course-recovery')
    await recoverStuckCourses()
  }
}
