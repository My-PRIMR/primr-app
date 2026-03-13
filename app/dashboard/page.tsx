import Link from 'next/link'
import { db } from '@/db'
import { lessons, lessonInvitations, lessonAttempts } from '@/db/schema'
import { desc, eq, and, sql } from 'drizzle-orm'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import styles from './page.module.css'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id || !session.user.email) redirect('/login')

  const role = (session.user as { role?: string }).role ?? 'learner'

  // Creator view: lessons they created
  const createdLessons = role === 'creator' || role === 'administrator'
    ? await db.select({
        id: lessons.id,
        title: lessons.title,
        slug: lessons.slug,
        createdAt: lessons.createdAt,
        updatedAt: lessons.updatedAt,
      }).from(lessons).where(eq(lessons.createdBy, session.user.id)).orderBy(desc(lessons.updatedAt))
    : []

  // Learner view: lessons they're invited to, with stats
  const email = session.user.email.toLowerCase()
  const invitedLessons = await db
    .select({
      id: lessons.id,
      title: lessons.title,
      slug: lessons.slug,
    })
    .from(lessonInvitations)
    .innerJoin(lessons, eq(lessonInvitations.lessonId, lessons.id))
    .where(eq(lessonInvitations.email, email))

  // Get attempt stats for invited lessons
  let statsMap = new Map<string, { attemptCount: number; bestScore: number | null; lastAttempt: string | null }>()
  if (invitedLessons.length > 0) {
    const lessonIds = invitedLessons.map(l => l.id)
    const stats = await db
      .select({
        lessonId: lessonAttempts.lessonId,
        attemptCount: sql<number>`count(*)::int`,
        bestScore: sql<number | null>`max(${lessonAttempts.score})`,
        lastAttempt: sql<string | null>`max(${lessonAttempts.completedAt})::text`,
      })
      .from(lessonAttempts)
      .where(and(
        eq(lessonAttempts.userId, session.user.id),
        sql`${lessonAttempts.lessonId} = ANY(${lessonIds})`,
      ))
      .groupBy(lessonAttempts.lessonId)
    statsMap = new Map(stats.map(s => [s.lessonId, s]))
  }

  const isCreator = role === 'creator' || role === 'administrator'

  return (
    <main className={styles.main}>
      <nav className={styles.nav}>
        <Link href="/" className={styles.wordmark}>Primr</Link>
        {isCreator && <Link href="/dashboard/new" className={styles.newBtn}>+ New lesson</Link>}
      </nav>

      <div className={styles.content}>
        {/* Creator section */}
        {isCreator && (
          <>
            <h1 className={styles.heading}>Your lessons</h1>
            {createdLessons.length === 0 ? (
              <p className={styles.empty}>No lessons yet. <Link href="/dashboard/new" className={styles.link}>Create your first one →</Link></p>
            ) : (
              <div className={styles.list}>
                {createdLessons.map(lesson => (
                  <div key={lesson.id} className={styles.card}>
                    <div className={styles.cardBody}>
                      <h2 className={styles.cardTitle}>{lesson.title}</h2>
                      <p className={styles.cardMeta}>
                        Created {lesson.createdAt.toLocaleDateString()} · Updated {lesson.updatedAt.toLocaleDateString()}
                      </p>
                    </div>
                    <div className={styles.cardActions}>
                      <Link href={`/dashboard/edit/${lesson.id}`} className={styles.editLink}>Edit</Link>
                      <Link href={`/dashboard/preview/${lesson.id}`} className={styles.previewLink}>Preview</Link>
                      <Link href={`/learn/${lesson.id}`} className={styles.previewLink}>Take lesson</Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Learner section */}
        {invitedLessons.length > 0 && (
          <>
            <h1 className={styles.heading} style={isCreator ? { marginTop: '2.5rem' } : undefined}>
              {isCreator ? 'Assigned to you' : 'Your lessons'}
            </h1>
            <div className={styles.list}>
              {invitedLessons.map(lesson => {
                const stat = statsMap.get(lesson.id)
                return (
                  <div key={lesson.id} className={styles.card}>
                    <div className={styles.cardBody}>
                      <h2 className={styles.cardTitle}>{lesson.title}</h2>
                      <p className={styles.cardMeta}>
                        {stat
                          ? `${stat.attemptCount} attempt${stat.attemptCount !== 1 ? 's' : ''}${stat.bestScore != null ? ` · Best: ${Math.round(stat.bestScore * 100)}%` : ''}${stat.lastAttempt ? ` · Last: ${new Date(stat.lastAttempt).toLocaleDateString()}` : ''}`
                          : 'Not started'}
                      </p>
                    </div>
                    <div className={styles.cardActions}>
                      <Link href={`/learn/${lesson.id}`} className={styles.editLink}>Take lesson</Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {!isCreator && invitedLessons.length === 0 && (
          <p className={styles.empty}>No lessons assigned to you yet.</p>
        )}
      </div>
    </main>
  )
}
