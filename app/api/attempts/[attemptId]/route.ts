import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/session'
import { db } from '@/db'
import { lessonAttempts } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

// PATCH — complete an attempt with results
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ attemptId: string }> }) {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { attemptId } = await params
  const body = await req.json()
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
