import styles from './PriceBadge.module.css'

interface Props {
  priceCents: number | null
  isPaid: boolean
}

export function PriceBadge({ priceCents, isPaid }: Props) {
  if (!isPaid || priceCents == null) return null
  return (
    <span className={styles.badge}>
      ${(priceCents / 100).toFixed(2)}
    </span>
  )
}
