import { notFound } from 'next/navigation'
import { db } from '@/db'
import { lessons } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/session'
import { canAccessLesson } from '@/lib/lesson-access'
import LessonPlayer from './LessonPlayer'
import LearnHeader from '../LearnHeader'

export default async function LearnPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ embed?: string }> }) {
  const { id } = await params
  const { embed } = await searchParams
  const isEmbed = embed === 'true'

  const lesson = await db.query.lessons.findFirst({
    where: eq(lessons.id, id),
  })

  if (!lesson) notFound()

  const session = await getSession()
  if (!session?.user?.id || !session.user.email) notFound()

  const hasAccess = await canAccessLesson(id, session.user.id, session.user.email, session.user.internalRole)
  if (!hasAccess) {
    return (
      <main style={{ padding: '4rem', textAlign: 'center' }}>
        <h1>Access Denied</h1>
        <p>You do not have permission to view this lesson.</p>
      </main>
    )
  }

  const adminMode =
    session.user.productRole === 'administrator' ||
    session.user.internalRole != null ||
    lesson.createdBy === session.user.id

  return (
    <>
      {!isEmbed && <LearnHeader userName={session.user.name} userEmail={session.user.email} role={session.user.productRole} internalRole={session.user.internalRole} />}
      <LessonPlayer lessonId={lesson.id} manifest={lesson.manifest} adminMode={adminMode} examEnforced={lesson.examEnforced} isEmbed={isEmbed} />
    </>
  )
}
