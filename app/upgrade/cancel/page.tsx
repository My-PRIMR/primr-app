import Link from 'next/link'
import styles from '../success/page.module.css'

export default function UpgradeCancelPage() {
  return (
    <main className={styles.main}>
      <section className={styles.card}>
        <h1 className={styles.title}>Checkout canceled</h1>
        <p className={styles.body}>
          No worries — you can come back any time.
        </p>
        <div className={styles.actions}>
          <Link href="/upgrade" className={styles.primary}>
            Back to plans
          </Link>
        </div>
      </section>
    </main>
  )
}
