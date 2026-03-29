import { notFound } from 'next/navigation'
import { db } from '@/db'
import { lessons } from '@/db/schema'
import { eq } from 'drizzle-orm'
import LessonClient from './LessonClient'

export default async function PublicShowcaseLesson({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ showcase?: string }>
}) {
  const { id } = await params
  const { showcase } = await searchParams

  if (showcase !== 'true') notFound()

  const [lesson] = await db.select().from(lessons).where(eq(lessons.id, id)).limit(1)

  if (!lesson || !lesson.showcase) notFound()

  return <LessonClient manifest={lesson.manifest} />
}
