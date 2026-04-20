import { mergeRevenueByItem, formatCents } from './revenue'

describe('mergeRevenueByItem', () => {
  it('returns 0 for ids that have no matching row', () => {
    const result = mergeRevenueByItem(['a', 'b', 'c'], [])
    expect(result.get('a')).toBe(0)
    expect(result.get('b')).toBe(0)
    expect(result.get('c')).toBe(0)
  })

  it('sums revenue by item id from matching rows', () => {
    const result = mergeRevenueByItem(
      ['a', 'b'],
      [
        { itemId: 'a', revenueCents: 70 },
        { itemId: 'b', revenueCents: 350 },
      ],
    )
    expect(result.get('a')).toBe(70)
    expect(result.get('b')).toBe(350)
  })

  it('ignores rows for item ids not in the input list', () => {
    const result = mergeRevenueByItem(
      ['a'],
      [
        { itemId: 'a', revenueCents: 70 },
        { itemId: 'other', revenueCents: 999 },
      ],
    )
    expect(result.get('a')).toBe(70)
    expect(result.has('other')).toBe(false)
  })

  it('treats a null itemId as no-op', () => {
    const result = mergeRevenueByItem(
      ['a'],
      [{ itemId: null, revenueCents: 70 }],
    )
    expect(result.get('a')).toBe(0)
  })
})

describe('formatCents', () => {
  it('formats zero as $0.00', () => {
    expect(formatCents(0)).toBe('$0.00')
  })

  it('formats whole dollars with two decimals', () => {
    expect(formatCents(100)).toBe('$1.00')
    expect(formatCents(10000)).toBe('$100.00')
  })

  it('formats sub-dollar amounts correctly', () => {
    expect(formatCents(70)).toBe('$0.70')
    expect(formatCents(5)).toBe('$0.05')
  })

  it('does not add a thousands separator below 10,000 dollars', () => {
    expect(formatCents(100000)).toBe('$1,000.00')
  })
})
