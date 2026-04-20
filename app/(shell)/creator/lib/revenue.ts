const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatCents(cents: number): string {
  return USD.format(cents / 100)
}

export type RevenueRow = { itemId: string | null; revenueCents: number }

export function mergeRevenueByItem(
  itemIds: string[],
  rows: RevenueRow[],
): Map<string, number> {
  const out = new Map<string, number>()
  for (const id of itemIds) out.set(id, 0)
  for (const row of rows) {
    if (row.itemId && out.has(row.itemId)) {
      out.set(row.itemId, (out.get(row.itemId) ?? 0) + row.revenueCents)
    }
  }
  return out
}
