import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/session'
import { db } from '@/db'
import { lessonAttempts } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ attemptId: string }> }) {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { attemptId } = await params
  const body = await req.json()

  // Partial mode: merge a single block's result without completing
  if (body.blockResult && typeof body.blockResult === 'object') {
    const { blockId } = body.blockResult
    if (typeof blockId !== 'string') {
      return NextResponse.json({ error: 'blockResult.blockId is required' }, { status: 400 })
    }

    const current = await db.query.lessonAttempts.findFirst({
      where: and(
        eq(lessonAttempts.id, attemptId),
        eq(lessonAttempts.userId, session.user.id),
      ),
    })
    if (!current) {
      return NextResponse.json({ error: 'Attempt not found' }, { status: 404 })
    }

    const merged = { ...(current.blockResults ?? {}), [blockId]: body.blockResult }

    const [updated] = await db
      .update(lessonAttempts)
      .set({ blockResults: merged })
      .where(and(
        eq(lessonAttempts.id, attemptId),
        eq(lessonAttempts.userId, session.user.id),
      ))
      .returning()

    return NextResponse.json({ attempt: updated })
  }

  // Full-payload mode: complete the attempt (existing behavior)
  const { score, scoredBlocks, blockResults } = body

  const [updated] = await db
    .update(lessonAttempts)
    .set({
      status: 'completed',
      score,
      scoredBlocks,
      blockResults,
      completedAt: new Date(),
    })
    .where(and(
      eq(lessonAttempts.id, attemptId),
      eq(lessonAttempts.userId, session.user.id),
    ))
    .returning()

  if (!updated) {
    return NextResponse.json({ error: 'Attempt not found' }, { status: 404 })
  }

  return NextResponse.json({ attempt: updated })
}
