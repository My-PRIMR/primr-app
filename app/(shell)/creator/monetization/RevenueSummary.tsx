import styles from './RevenueSummary.module.css'

interface Props {
  lifetimeRevenueCents: number
  revenueThresholdCents: number
}

export function RevenueSummary({
  lifetimeRevenueCents,
  revenueThresholdCents,
}: Props) {
  const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`
  const crossed = lifetimeRevenueCents >= revenueThresholdCents
  const pct = Math.min(
    100,
    Math.max(
      0,
      Math.round((lifetimeRevenueCents / revenueThresholdCents) * 100),
    ),
  )

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Revenue</h2>
      <p className={styles.lifetime}>
        Lifetime earnings:{' '}
        <span className={styles.lifetimeValue}>{dollars(lifetimeRevenueCents)}</span>
      </p>
      <div className={styles.barWrapper}>
        <div className={styles.bar} style={{ width: `${pct}%` }} />
      </div>
      <p className={styles.tierText}>
        {crossed
          ? 'You are on the reduced 20% platform fee tier.'
          : `You are on the standard 30% tier. You reach the reduced 20% tier at ${dollars(revenueThresholdCents)}.`}
      </p>
    </section>
  )
}
