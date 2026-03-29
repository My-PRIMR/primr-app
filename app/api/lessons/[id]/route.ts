import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { lessons } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/session'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [lesson] = await db.select().from(lessons).where(eq(lessons.id, id)).limit(1)
  if (!lesson) return NextResponse.json({ error: 'lesson not found' }, { status: 404 })
  return NextResponse.json({
    id: lesson.id,
    title: lesson.title,
    slug: lesson.slug,
    manifest: lesson.manifest,
    generationStatus: lesson.generationStatus,
    sourceVideoUrl: lesson.sourceVideoUrl,
    publishedAt: lesson.publishedAt,
    examEnforced: lesson.examEnforced,
    createdAt: lesson.createdAt,
    updatedAt: lesson.updatedAt,
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { manifest, examEnforced } = body

  if (!manifest && examEnforced === undefined) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
  }

  const [existing] = await db.select().from(lessons).where(eq(lessons.id, id)).limit(1)
  if (!existing) {
    return NextResponse.json({ error: 'lesson not found' }, { status: 404 })
  }
  if (existing.createdBy !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateFields: Record<string, any> = { updatedAt: new Date() }
  if (manifest) { updateFields.manifest = manifest; updateFields.title = manifest.title }
  if (examEnforced !== undefined) updateFields.examEnforced = examEnforced

  const [updated] = await db.update(lessons)
    .set(updateFields)
    .where(eq(lessons.id, id))
    .returning()

  if (!updated) {
    return NextResponse.json({ error: 'lesson not found' }, { status: 404 })
  }

  return NextResponse.json({ id: updated.id })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const [lesson] = await db.select().from(lessons).where(eq(lessons.id, id)).limit(1)
  if (!lesson) return NextResponse.json({ error: 'lesson not found' }, { status: 404 })
  if (lesson.createdBy !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await db.delete(lessons).where(eq(lessons.id, id))
  return NextResponse.json({ ok: true })
}
