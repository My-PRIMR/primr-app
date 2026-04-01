export type DailyActivity = { date: string; count: number }

/**
 * Merges sparse DB results (date + count) into a full N-day window, filling
 * missing days with 0. Returns entries in ascending date order.
 */
export function fillDailyActivity(
  sparse: Array<{ date: string; count: number }>,
  days: number,
): DailyActivity[] {
  const now = new Date()
  const sparseMap = new Map(sparse.map(r => [r.date, r.count]))
  const result: DailyActivity[] = []

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const date = d.toISOString().slice(0, 10)
    result.push({ date, count: sparseMap.get(date) ?? 0 })
  }

  return result
}

export type BlockPerf = {
  blockId: string
  blockType: string
  label: string
  responseCount: number
  /** Fraction 0–1 based on correct/incorrect status. Null if no status-based results. */
  pctCorrect: number | null
  /** Average score 0–1 for score-based blocks. Null if no score present. */
  avgScore: number | null
}

/**
 * Aggregates blockResults across attempts into per-block performance stats.
 * Only returns blocks that have at least one result entry.
 */
export function computeBlockPerformance(
  attempts: Array<{ blockResults: Record<string, { status: string; score?: number }> | null }>,
  blocks: Array<{ id: string; type: string; props: Record<string, unknown> }>,
): BlockPerf[] {
  const collected = new Map<string, Array<{ status: string; score?: number }>>()

  for (const attempt of attempts) {
    if (!attempt.blockResults) continue
    for (const [blockId, result] of Object.entries(attempt.blockResults)) {
      if (!collected.has(blockId)) collected.set(blockId, [])
      collected.get(blockId)!.push(result)
    }
  }

  return blocks
    .filter(b => collected.has(b.id))
    .map(b => {
      const results = collected.get(b.id)!
      const withStatus = results.filter(r => r.status === 'correct' || r.status === 'incorrect')
      const withScore = results.filter(r => r.score != null)
      return {
        blockId: b.id,
        blockType: b.type,
        label: (b.props.title as string | undefined) ?? b.type,
        responseCount: results.length,
        pctCorrect: withStatus.length > 0
          ? withStatus.filter(r => r.status === 'correct').length / withStatus.length
          : null,
        avgScore: withScore.length > 0
          ? withScore.reduce((sum, r) => sum + r.score!, 0) / withScore.length
          : null,
      }
    })
}
