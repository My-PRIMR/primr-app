import { notFound } from 'next/navigation'
import { db } from '@/db'
import { lessons } from '@/db/schema'
import { eq } from 'drizzle-orm'
import EditClient from './EditClient'

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const lesson = await db.query.lessons.findFirst({
    where: eq(lessons.id, id),
  })

  if (!lesson) notFound()

  return <EditClient lessonId={lesson.id} manifest={lesson.manifest} />
}
