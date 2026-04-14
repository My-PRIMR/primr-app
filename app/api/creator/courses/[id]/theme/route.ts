import { NextResponse } from 'next/server'
import { getSession } from '@/session'
import { db } from '@/db'
import { courses, users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { validateThemeId, canUseTheme, requiredTier, type UserPlan } from '@/lib/themes'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const course = await db.query.courses.findFirst({
    where: eq(courses.id, id),
  })
  if (!course) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (course.createdBy !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await req.json()) as { theme?: string }
  const themeId = validateThemeId(body.theme)
  if (!themeId) {
    return NextResponse.json({ error: 'invalid_theme' }, { status: 400 })
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  })
  const plan = (user?.plan ?? 'free') as UserPlan

  if (!canUseTheme(themeId, plan)) {
    return NextResponse.json(
      { error: 'upgrade_required', requiredTier: requiredTier(themeId) },
      { status: 403 },
    )
  }

  await db
    .update(courses)
    .set({ theme: themeId, updatedAt: new Date() })
    .where(eq(courses.id, id))

  return NextResponse.json({ id, theme: themeId })
}
