import { notFound } from 'next/navigation'
import { db } from '@/db'
import { lessons } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/session'
import { validateThemeId, DEFAULT_THEME } from '@/lib/themes'
import EmbedLessonClient from './EmbedLessonClient'

export default async function EmbedLessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ theme?: string; preview?: string }>
}) {
  const { id } = await params
  const { theme: themeQuery, preview } = await searchParams

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(id)) notFound()

  const [lesson] = await db.select().from(lessons)
    .where(eq(lessons.id, id))
    .limit(1)
  if (!lesson) notFound()

  if (preview === 'true') {
    const session = await getSession()
    if (!session?.user?.id || session.user.id !== lesson.createdBy) notFound()
  } else if (!lesson.showcase || !lesson.publishedAt) {
    notFound()
  }

  const resolvedTheme =
    validateThemeId(themeQuery) ?? validateThemeId(lesson.theme) ?? DEFAULT_THEME

  return (
    <EmbedLessonClient
      lessonId={lesson.id}
      manifest={lesson.manifest}
      theme={resolvedTheme}
    />
  )
}
