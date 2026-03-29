import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { lessons } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Fetch lesson from database
  const [lesson] = await db.select().from(lessons).where(eq(lessons.id, id)).limit(1)

  // Only allow access if lesson exists and is marked for showcase
  if (!lesson || !lesson.showcase) {
    return NextResponse.json({ error: 'lesson not found or not in showcase mode' }, { status: 404 })
  }

  return NextResponse.json({
    lesson: {
      id: lesson.id,
      manifest: lesson.manifest,
    },
  })
}
