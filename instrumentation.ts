/**
 * Next.js instrumentation — runs once on server startup.
 * Used to recover courses left in 'generating' status after a crash or restart.
 *
 * Recovery runs asynchronously in the background so it doesn't block app
 * startup. Any errors are logged but don't prevent the server from serving.
 */
export async function register() {
  // Only run on the Node.js server, not during build or edge runtime
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // Fire-and-forget: import and run recovery without awaiting so the server
  // can start serving requests immediately.
  import('@/lib/course-recovery')
    .then(({ recoverStuckCourses }) => recoverStuckCourses())
    .catch(err => console.error('[instrumentation] course recovery failed:', err))
}
