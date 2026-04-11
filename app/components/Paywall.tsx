import styles from './Paywall.module.css'

interface Props {
  kind: 'lesson' | 'course'
  id: string
  title: string
  priceCents: number | null
  creatorId: string | null
}

/**
 * Placeholder paywall shown when a learner lacks access to paid content.
 * The real purchase/subscribe flow is implemented in Task 15.
 */
export function Paywall({ kind, title, priceCents }: Props) {
  const price =
    priceCents != null ? `$${(priceCents / 100).toFixed(2)}` : '—'
  return (
    <main className={styles.wrapper}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Paid {kind}</p>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.subtitle}>
          This {kind} is paid. Purchase to unlock full access.
        </p>
        <p className={styles.price}>{price}</p>
        <p className={styles.hint}>
          Purchase flow will be available shortly.
        </p>
      </section>
    </main>
  )
}
