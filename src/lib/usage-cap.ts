import { db } from '@/db'
import { internalUsageLog } from '@/db/schema'
import { modelById, MONTHLY_QUOTAS_BY_PLAN } from './models'
import type { PlanValue } from '@/plans'
import { eq, and, gte, sql } from 'drizzle-orm'

export type CapCheck = {
  allowed: boolean
  /** `null` = unlimited; `number` = per-month limit. */
  cap: number | null
  used: number
  /** First instant (UTC) of the next calendar month. */
  resetsAt: Date
}

function currentMonthStartUtc(): Date {
  const d = new Date()
  d.setUTCDate(1)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

function nextMonthStartUtc(): Date {
  const d = currentMonthStartUtc()
  d.setUTCMonth(d.getUTCMonth() + 1)
  return d
}

/**
 * Per-user monthly AI generation quota check, scoped by plan tier and model cost category.
 *
 * Internal staff/admin bypass quotas. Plans without an allowance for the model's cost
 * category are denied (defense in depth — the route should also gate at resolveModel).
 */
export async function checkMonthlyCap(
  userId: string,
  modelId: string,
  plan: PlanValue,
  internalRole: string | null | undefined,
): Promise<CapCheck> {
  const resetsAt = nextMonthStartUtc()

  if (internalRole === 'staff' || internalRole === 'admin') {
    return { allowed: true, cap: null, used: 0, resetsAt }
  }

  const model = modelById(modelId)
  if (!model) return { allowed: false, cap: 0, used: 0, resetsAt }

  const quota = MONTHLY_QUOTAS_BY_PLAN[plan] ?? {}
  const cap = quota[model.costCategory]

  if (cap === undefined) return { allowed: false, cap: 0, used: 0, resetsAt }
  if (cap === null) return { allowed: true, cap: null, used: 0, resetsAt }

  const monthStart = currentMonthStartUtc()
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(internalUsageLog)
    .where(
      and(
        eq(internalUsageLog.userId, userId),
        eq(internalUsageLog.costCategory, model.costCategory),
        gte(internalUsageLog.createdAt, monthStart),
      )
    )
  const used = rows[0]?.count ?? 0
  return { allowed: used < cap, cap, used, resetsAt }
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
