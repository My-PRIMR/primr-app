import { notFound } from 'next/navigation'
import { db } from '@/db'
import { lessons } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/session'
import EditClient from './EditClient'

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [lesson, session] = await Promise.all([
    db.query.lessons.findFirst({ where: eq(lessons.id, id) }),
    getSession(),
  ])

  if (!lesson) notFound()

  return (
    <EditClient
      lessonId={lesson.id}
      manifest={lesson.manifest}
      publishedAt={lesson.publishedAt?.toISOString() ?? null}
      plan={session?.user.plan ?? 'free'}
      internalRole={session?.user.internalRole ?? null}
    />
  )
}
