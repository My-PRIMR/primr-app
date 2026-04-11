import Link from 'next/link'
import styles from './page.module.css'

export default async function UpgradeSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  const { session_id } = await searchParams
  return (
    <main className={styles.main}>
      <section className={styles.card}>
        <h1 className={styles.title}>You&rsquo;re all set.</h1>
        <p className={styles.body}>
          Your subscription is active. Welcome to Pro!
        </p>
        {session_id && (
          <p className={styles.receipt}>
            Receipt: <span className={styles.mono}>{session_id}</span>
          </p>
        )}
        <div className={styles.actions}>
          <Link href="/creator" className={styles.primary}>
            Go to your creator dashboard
          </Link>
          <Link href="/settings/billing" className={styles.secondary}>
            Manage subscription
          </Link>
        </div>
      </section>
    </main>
  )
}
