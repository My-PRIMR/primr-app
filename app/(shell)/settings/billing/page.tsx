import { redirect } from 'next/navigation'
import { getSession } from '@/session'
import { db } from '@/db'
import { planSubscriptions } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { ManageSubscriptionButton } from '../../../components/ManageSubscriptionButton'
import { BecomeCreatorButton } from './BecomeCreatorButton'
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

  const userPlan = session.user.plan ?? 'free'
  const productRole = session.user.productRole ?? 'learner'
  const isLearner = productRole === 'learner'
  const isFree = !sub && userPlan === 'free'
  const tierLabel = sub
    ? (sub.tier === 'pro' ? 'Pro' : 'Teams')
    : (userPlan === 'pro' ? 'Pro'
      : userPlan === 'enterprise' ? 'Enterprise'
      : userPlan === 'teacher' ? 'Teacher'
      : isLearner ? 'Learner'
      : 'Creator — Free')
  const isAdminGranted = !sub && !isFree
  const periodLabel = sub ? (sub.billingPeriod === 'monthly' ? 'Monthly' : 'Annual') : null
  const isTrialing =
    sub?.trialEndsAt != null && new Date(sub.trialEndsAt).getTime() > Date.now()
  const trialEndDate = isTrialing
    ? new Date(sub!.trialEndsAt!).toLocaleDateString()
    : null
  const renewalDate = sub?.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd).toLocaleDateString()
    : null
  const endingSoon = sub?.cancelAtPeriodEnd === true

  return (
    <>
      <main className={styles.main}>
        <h1 className={styles.title}>Billing</h1>
      <section className={styles.card}>
        <h2 className={styles.cardHeading}>Current plan</h2>
        <p className={styles.plan}>
          {tierLabel}
          {isTrialing && ' (Free trial)'}
        </p>
        {periodLabel && (
          <p className={styles.muted}>
            {isTrialing
              ? `Billed ${periodLabel.toLowerCase()} after trial`
              : `Billed ${periodLabel.toLowerCase()}`}
          </p>
        )}
        {isAdminGranted && <p className={styles.muted}>Granted by admin</p>}
        {isTrialing && trialEndDate && (
          <p className={styles.muted}>Trial ends on {trialEndDate}</p>
        )}
        {!isTrialing && renewalDate && (
          <p className={styles.muted}>
            {endingSoon ? 'Ends on ' : 'Renews on '}
            {renewalDate}
          </p>
        )}
        {sub && (
          <div className={styles.manageWrap}>
            <ManageSubscriptionButton />
          </div>
        )}
        {isFree && (
          <div className={styles.ctaRow}>
            {isLearner && <BecomeCreatorButton />}
            <a href="/upgrade" className={styles.upgradeLink}>
              Upgrade to Pro
            </a>
          </div>
        )}
      </section>
      </main>
    </>
  )
}
