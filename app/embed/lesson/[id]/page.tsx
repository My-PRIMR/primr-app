import { notFound } from 'next/navigation'
import { db } from '@/db'
import { lessons } from '@/db/schema'
import { eq } from 'drizzle-orm'
import EmbedLessonClient from './EmbedLessonClient'

export default async function EmbedLessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ theme?: string }>
}) {
  const { id } = await params
  const { theme } = await searchParams

  const [lesson] = await db.select().from(lessons)
    .where(eq(lessons.id, id))
    .limit(1)

  if (!lesson || !lesson.showcase || !lesson.publishedAt) notFound()

  return (
    <EmbedLessonClient
      lessonId={lesson.id}
      manifest={lesson.manifest}
      initialTheme={theme === 'dark' ? 'dark' : theme === 'light' ? 'light' : undefined}
    />
  )
}
