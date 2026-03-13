import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { lessons } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { manifest } = await req.json()

  if (!manifest) {
    return NextResponse.json({ error: 'manifest is required' }, { status: 400 })
  }

  const [updated] = await db.update(lessons)
    .set({ manifest, title: manifest.title, updatedAt: new Date() })
    .where(eq(lessons.id, id))
    .returning()

  if (!updated) {
    return NextResponse.json({ error: 'lesson not found' }, { status: 404 })
  }

  return NextResponse.json({ id: updated.id })
}
