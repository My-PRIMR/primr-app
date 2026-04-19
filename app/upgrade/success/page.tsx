import Link from 'next/link'
import { getStripe } from '@/stripe'
import styles from './page.module.css'

export default async function UpgradeSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  const { session_id } = await searchParams

  let isTrial = false
  if (session_id) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(session_id)
      isTrial = session.metadata?.primrTier === 'pro'
    } catch {
      // fall through to the non-trial copy
    }
  }

  return (
    <main className={styles.main}>
      <section className={styles.card}>
        <h1 className={styles.title}>
          {isTrial
            ? 'Your 14-day free trial has started.'
            : "You\u2019re all set."}
        </h1>
        <p className={styles.body}>
          {isTrial
            ? "Welcome to Pro. You won\u2019t be charged for 14 days. Cancel anytime from your billing settings before the trial ends."
            : 'Your subscription is active. Welcome aboard!'}
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
