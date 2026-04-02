export type DailyActivity = { date: string; count: number }

/**
 * Merges sparse DB results (date + count) into a full N-day window, filling
 * missing days with 0. Returns entries in ascending date order.
 */
export function fillDailyActivity(
  sparse: Array<{ date: string; count: number }>,
  days: number,
  now: Date = new Date(),
): DailyActivity[] {
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

export type QuestionStat = {
  index: number
  prompt: string
  options: string[]
  correctIndex: number
  totalAnswered: number
  correctCount: number
  /** How many learners chose each option (parallel to options array) */
  choiceCounts: number[]
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
  /** Per-question breakdown — present for quiz/exam blocks with question data */
  questionStats?: QuestionStat[]
}

/**
 * Aggregates blockResults across attempts into per-block performance stats.
 * Only returns blocks that have at least one result entry.
 *
 * Note: only `'correct'` and `'incorrect'` statuses count toward `pctCorrect`.
 * Other statuses (e.g. `'completed'`, `'skipped'`) contribute to `responseCount`
 * but are excluded from the correct/incorrect ratio.
 */
export function computeBlockPerformance(
  attempts: Array<{ blockResults: Record<string, { status: string; score?: number; questions?: Array<{ index: number; chosenIndex: number; correct: boolean }> }> | null }>,
  blocks: Array<{ id: string; type: string; props: Record<string, unknown> }>,
): BlockPerf[] {
  const collected = new Map<string, Array<{ status: string; score?: number; questions?: Array<{ index: number; chosenIndex: number; correct: boolean }> }>>()

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
      const manifestQuestions = (b.props as { questions?: Array<{ prompt: string; options: string[]; correctIndex: number }> } | null)?.questions
      let questionStats: QuestionStat[] | undefined
      if (manifestQuestions && manifestQuestions.length > 0) {
        const qs = manifestQuestions.map((q, qi) => {
          const choiceCounts = Array(q.options.length).fill(0) as number[]
          let totalAnswered = 0
          let correctCount = 0
          for (const r of results) {
            const qr = r.questions?.find(x => x.index === qi)
            if (!qr || qr.chosenIndex === -1) continue
            totalAnswered++
            if (qr.chosenIndex >= 0 && qr.chosenIndex < choiceCounts.length) choiceCounts[qr.chosenIndex]++
            if (qr.correct) correctCount++
          }
          return { index: qi, prompt: q.prompt, options: q.options, correctIndex: q.correctIndex, totalAnswered, correctCount, choiceCounts }
        }).filter(q => q.totalAnswered > 0)
        if (qs.length > 0) questionStats = qs
      }

      return {
        blockId: b.id,
        blockType: b.type,
        label: ((b.props as Record<string, unknown> | null)?.title as string | undefined) ?? b.type,
        responseCount: results.length,
        pctCorrect: withStatus.length > 0
          ? withStatus.filter(r => r.status === 'correct').length / withStatus.length
          : null,
        avgScore: withScore.length > 0
          ? withScore.reduce((sum, r) => sum + r.score!, 0) / withScore.length
          : null,
        questionStats,
      }
    })
    .filter(b => b.pctCorrect != null || b.avgScore != null)
}
