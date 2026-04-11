import { notFound } from 'next/navigation'
import Link from 'next/link'
import { and, eq, isNotNull } from 'drizzle-orm'
import { db } from '@/db'
import { users, creatorProfiles, lessons, courses } from '@/db/schema'
import { PriceBadge } from '../../components/PriceBadge'
import { SubscribeButton } from './SubscribeButton'
import styles from './page.module.css'

export const dynamic = 'force-dynamic'

// Match UUID v4-ish shape (any version). The route is structured so that this
// page only receives slugs that aren't known protected sub-paths (see
// `middleware.ts`), but we still validate to avoid accidental conflicts.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function CreatorProfilePage({
  params,
}: {
  params: Promise<{ creatorSlug: string }>
}) {
  const { creatorSlug } = await params

  // `users` has no slug/username column — look up by UUID only.
  if (!UUID_RE.test(creatorSlug)) notFound()

  const creator = await db.query.users.findFirst({
    where: eq(users.id, creatorSlug),
  })
  if (!creator) notFound()

  const profile = await db.query.creatorProfiles.findFirst({
    where: eq(creatorProfiles.userId, creator.id),
  })

  // Published lessons: `publishedAt IS NOT NULL` (per schema comment).
  // Exclude system content from public profiles.
  const creatorLessons = await db
    .select({
      id: lessons.id,
      title: lessons.title,
      priceCents: lessons.priceCents,
      isPaid: lessons.isPaid,
    })
    .from(lessons)
    .where(
      and(
        eq(lessons.createdBy, creator.id),
        eq(lessons.isSystem, false),
        isNotNull(lessons.publishedAt),
      ),
    )
    .orderBy(lessons.title)

  // Public courses: status='published' AND isPublic=true, excluding system content.
  const creatorCourses = await db
    .select({
      id: courses.id,
      title: courses.title,
      description: courses.description,
      priceCents: courses.priceCents,
      isPaid: courses.isPaid,
    })
    .from(courses)
    .where(
      and(
        eq(courses.createdBy, creator.id),
        eq(courses.isSystem, false),
        eq(courses.isPublic, true),
        eq(courses.status, 'published'),
      ),
    )
    .orderBy(courses.title)

  const displayName = creator.name ?? creator.email ?? 'Creator'
  const hasSubscription =
    profile?.subscriptionEnabled &&
    profile.subscriptionPriceCents != null &&
    profile.stripeOnboardingComplete

  return (
    <main className={styles.main}>
      <div className={styles.content}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>Creator</p>
          <h1 className={styles.title}>{displayName}</h1>
          {hasSubscription && (
            <div className={styles.subscribeWrap}>
              <SubscribeButton
                creatorId={creator.id}
                priceCents={profile!.subscriptionPriceCents!}
              />
              <p className={styles.subscribeNote}>
                Subscribers get access to every paid lesson and course from this creator.
              </p>
            </div>
          )}
        </header>

        {creatorCourses.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>Courses</h2>
            <ul className={styles.grid}>
              {creatorCourses.map((c) => (
                <li key={c.id} className={styles.card}>
                  <Link href={`/learn/course/${c.id}`} className={styles.cardLink}>
                    <span className={styles.cardTitle}>{c.title}</span>
                    {c.description && (
                      <span className={styles.cardDescription}>{c.description}</span>
                    )}
                  </Link>
                  <div className={styles.badgeRow}>
                    <PriceBadge priceCents={c.priceCents} isPaid={c.isPaid} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {creatorLessons.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>Lessons</h2>
            <ul className={styles.grid}>
              {creatorLessons.map((l) => (
                <li key={l.id} className={styles.card}>
                  <Link href={`/learn/${l.id}`} className={styles.cardLink}>
                    <span className={styles.cardTitle}>{l.title}</span>
                  </Link>
                  <div className={styles.badgeRow}>
                    <PriceBadge priceCents={l.priceCents} isPaid={l.isPaid} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {creatorCourses.length === 0 && creatorLessons.length === 0 && (
          <p className={styles.empty}>This creator hasn&apos;t published anything yet.</p>
        )}
      </div>
    </main>
  )
}
