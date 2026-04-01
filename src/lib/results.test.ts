import { fillDailyActivity, computeBlockPerformance } from './results'

describe('fillDailyActivity', () => {
  it('returns N entries for N days', () => {
    const result = fillDailyActivity([], 7)
    expect(result).toHaveLength(7)
  })

  it('returns all zeros when no sparse data', () => {
    const result = fillDailyActivity([], 5)
    expect(result.every(r => r.count === 0)).toBe(true)
  })

  it('fills in counts from sparse data', () => {
    const today = new Date().toISOString().slice(0, 10)
    const result = fillDailyActivity([{ date: today, count: 3 }], 7)
    const todayEntry = result.find(r => r.date === today)
    expect(todayEntry?.count).toBe(3)
  })

  it('ignores sparse entries outside the window', () => {
    const result = fillDailyActivity([{ date: '2000-01-01', count: 99 }], 7)
    expect(result.every(r => r.count === 0)).toBe(true)
  })

  it('dates are in ascending order', () => {
    const result = fillDailyActivity([], 5)
    for (let i = 1; i < result.length; i++) {
      expect(result[i].date > result[i - 1].date).toBe(true)
    }
  })
})

describe('computeBlockPerformance', () => {
  const blocks = [
    { id: 'b1', type: 'quiz', props: { title: 'Q1' } },
    { id: 'b2', type: 'exam', props: {} },
    { id: 'b3', type: 'narrative', props: {} },
  ]

  it('returns only blocks that have results', () => {
    const attempts = [
      { blockResults: { b1: { status: 'correct' } } },
    ]
    const result = computeBlockPerformance(attempts, blocks)
    expect(result).toHaveLength(1)
    expect(result[0].blockId).toBe('b1')
  })

  it('computes pctCorrect from status fields', () => {
    const attempts = [
      { blockResults: { b1: { status: 'correct' } } },
      { blockResults: { b1: { status: 'correct' } } },
      { blockResults: { b1: { status: 'incorrect' } } },
    ]
    const result = computeBlockPerformance(attempts, blocks)
    expect(result[0].pctCorrect).toBeCloseTo(2 / 3)
  })

  it('computes avgScore from score fields', () => {
    const attempts = [
      { blockResults: { b2: { status: 'completed', score: 0.8 } } },
      { blockResults: { b2: { status: 'completed', score: 0.6 } } },
    ]
    const result = computeBlockPerformance(attempts, blocks)
    expect(result[0].avgScore).toBeCloseTo(0.7)
  })

  it('uses block type as label when no title prop', () => {
    const attempts = [{ blockResults: { b2: { status: 'completed', score: 1 } } }]
    const result = computeBlockPerformance(attempts, blocks)
    expect(result[0].label).toBe('exam')
  })

  it('skips attempts with null blockResults', () => {
    const attempts = [
      { blockResults: null },
      { blockResults: { b1: { status: 'correct' } } },
    ]
    const result = computeBlockPerformance(attempts, blocks)
    expect(result[0].responseCount).toBe(1)
  })
})
