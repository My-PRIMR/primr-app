import { redirect } from 'next/navigation'
import { getSession } from '@/session'
import { db } from '@/db'
import { planSubscriptions } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import PageHeaderServer from '../../components/PageHeaderServer'
import { ManageSubscriptionButton } from './ManageSubscriptionButton'
import styles from './page.module.css'

export default async function BillingPage() {
  const session = await getSession()
  if (!session?.user?.id) redirect('/login?next=/settings/billing')

  const sub = await db.query.planSubscriptions.findFirst({
    where: and(
      eq(planSubscriptions.subscriberUserId, session.user.id),
      eq(planSubscriptions.status, 'active'),
    ),
  })

  const tierLabel = sub ? (sub.tier === 'pro' ? 'Pro' : 'Teams') : 'Free'
  const periodLabel = sub ? (sub.billingPeriod === 'monthly' ? 'Monthly' : 'Annual') : null
  const renewalDate = sub?.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd).toLocaleDateString()
    : null
  const endingSoon = sub?.cancelAtPeriodEnd === true

  return (
    <>
      <PageHeaderServer />
      <main className={styles.main}>
        <a href="/creator" className={styles.backLink}>← Back to dashboard</a>
        <h1 className={styles.title}>Billing</h1>
      <section className={styles.card}>
        <h2 className={styles.cardHeading}>Current plan</h2>
        <p className={styles.plan}>{tierLabel}</p>
        {periodLabel && <p className={styles.muted}>Billed {periodLabel.toLowerCase()}</p>}
        {renewalDate && (
          <p className={styles.muted}>
            {endingSoon ? 'Ends on ' : 'Renews on '}
            {renewalDate}
          </p>
        )}
        {sub && <ManageSubscriptionButton />}
        {!sub && (
          <a href="/upgrade" className={styles.upgradeLink}>
            Upgrade to Pro
          </a>
        )}
      </section>
      </main>
    </>
  )
}
