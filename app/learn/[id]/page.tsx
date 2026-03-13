import { notFound } from 'next/navigation'
import { db } from '@/db'
import { lessons } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { auth } from '@/auth'
import { canAccessLesson } from '@/lib/lesson-access'
import LessonPlayer from './LessonPlayer'

export default async function LearnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const lesson = await db.query.lessons.findFirst({
    where: eq(lessons.id, id),
  })

  if (!lesson) notFound()

  const session = await auth()
  if (!session?.user?.id || !session.user.email) notFound()

  const hasAccess = await canAccessLesson(id, session.user.id, session.user.email)
  if (!hasAccess) {
    return (
      <main style={{ padding: '4rem', textAlign: 'center' }}>
        <h1>Access Denied</h1>
        <p>You do not have permission to view this lesson.</p>
      </main>
    )
  }

  return <LessonPlayer lessonId={lesson.id} manifest={lesson.manifest} />
}
