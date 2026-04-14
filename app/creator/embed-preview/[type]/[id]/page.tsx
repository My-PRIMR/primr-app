import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/session'
import { db } from '@/db'
import { lessons, courses, users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { validateThemeId, DEFAULT_THEME, type UserPlan } from '@/lib/themes'
import EmbedPreviewClient from './EmbedPreviewClient'

export default async function EmbedPreviewPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>
}) {
  const { type, id } = await params
  if (type !== 'lesson' && type !== 'course') notFound()

  const session = await getSession()
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/creator/embed-preview/${type}/${id}`)
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(id)) notFound()

  let title = ''
  let savedTheme = DEFAULT_THEME

  if (type === 'lesson') {
    const [row] = await db.select().from(lessons).where(eq(lessons.id, id)).limit(1)
    if (!row) notFound()
    if (row.createdBy !== session.user.id) notFound()
    title = row.title
    savedTheme = validateThemeId(row.theme) ?? DEFAULT_THEME
  } else {
    const [row] = await db.select().from(courses).where(eq(courses.id, id)).limit(1)
    if (!row) notFound()
    if (row.createdBy !== session.user.id) notFound()
    title = row.title
    savedTheme = validateThemeId(row.theme) ?? DEFAULT_THEME
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, session.user.id) })
  const plan = (user?.plan ?? 'free') as UserPlan

  return (
    <EmbedPreviewClient
      type={type}
      id={id}
      title={title}
      savedTheme={savedTheme}
      userPlan={plan}
    />
  )
}
