import { db } from '@/db'
import { internalUsageLog } from '@/db/schema'
import { modelById, DAILY_CAPS } from './models'
import { eq, and, gte, sql } from 'drizzle-orm'

export async function checkCap(userId: string, modelId: string): Promise<{ allowed: boolean; remaining: number | null }> {
  const model = modelById(modelId)
  if (!model) return { allowed: false, remaining: null }

  const cap = DAILY_CAPS[model.costCategory]
  if (cap === null) return { allowed: true, remaining: null }  // LOW: never blocked

  const midnightUtc = new Date()
  midnightUtc.setUTCHours(0, 0, 0, 0)

  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(internalUsageLog)
    .where(
      and(
        eq(internalUsageLog.userId, userId),
        eq(internalUsageLog.costCategory, model.costCategory),
        gte(internalUsageLog.createdAt, midnightUtc),
      )
    )

  const used = rows[0]?.count ?? 0
  const remaining = cap - used
  return { allowed: remaining > 0, remaining }
}

export async function logUsage(
  userId: string,
  eventType: 'standalone_lesson' | 'course',
  modelId: string,
): Promise<void> {
  const model = modelById(modelId)
  if (!model) return

  await db.insert(internalUsageLog).values({
    userId,
    eventType,
    modelId,
    costCategory: model.costCategory,
  })
}
