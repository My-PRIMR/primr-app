import { notFound } from 'next/navigation'
import { db } from '@/db'
import { lessons, creatorProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/session'
import { canAccessLesson } from '@/lib/lesson-access'
import { hasAccessToLesson } from '@/access'
import { Paywall } from '../../components/Paywall'
import LessonPlayer from './LessonPlayer'
import LearnHeader from '../LearnHeader'

export default async function LearnPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ embed?: string }> }) {
  const { id } = await params
  const { embed } = await searchParams
  const isEmbed = embed === 'true'

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const lesson = await db.query.lessons.findFirst({
    where: UUID_RE.test(id) ? eq(lessons.id, id) : eq(lessons.slug, id),
  })

  if (!lesson) notFound()

  const session = await getSession()
  if (!session?.user?.id || !session.user.email) notFound()

  const hasAccess = await canAccessLesson(lesson.id, session.user.id, session.user.email, session.user.internalRole)
  if (!hasAccess) {
    return (
      <main style={{ padding: '4rem', textAlign: 'center' }}>
        <h1>Access Denied</h1>
        <p>You do not have permission to view this lesson.</p>
      </main>
    )
  }

  // Monetization gate: system lessons, free lessons, the creator, and
  // subscribers/purchasers always pass. Everyone else sees the paywall.
  const hasPaidAccess = await hasAccessToLesson(session.user.id, lesson.id)
  if (!hasPaidAccess) {
    const creatorProfile = lesson.createdBy
      ? await db.query.creatorProfiles.findFirst({
          where: eq(creatorProfiles.userId, lesson.createdBy),
        })
      : null
    const creatorSubPrice =
      creatorProfile?.subscriptionEnabled
        ? creatorProfile.subscriptionPriceCents
        : null
    return (
      <Paywall
        kind="lesson"
        id={lesson.id}
        title={lesson.title}
        priceCents={lesson.priceCents}
        creatorId={lesson.createdBy}
        creatorSubscriptionPriceCents={creatorSubPrice}
      />
    )
  }

  const adminMode =
    session.user.productRole === 'administrator' ||
    session.user.internalRole != null ||
    lesson.createdBy === session.user.id

  const dashboardUrl = isEmbed
    ? undefined
    : (session.user.productRole === 'creator' || session.user.productRole === 'lnd_manager' || session.user.productRole === 'org_admin')
      ? '/creator'
      : '/my-primr'

  return (
    <>
      {!isEmbed && <LearnHeader userName={session.user.name} userEmail={session.user.email} role={session.user.productRole} plan={session.user.plan} internalRole={session.user.internalRole} />}
      <LessonPlayer lessonId={lesson.id} manifest={lesson.manifest} adminMode={adminMode} examEnforced={lesson.examEnforced} isEmbed={isEmbed} dashboardUrl={dashboardUrl} />
    </>
  )
}
