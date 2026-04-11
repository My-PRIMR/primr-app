import { redirect } from 'next/navigation'
import { getSession } from '@/session'
import { db } from '@/db'
import { creatorProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { ConnectStripeButton } from './ConnectStripeButton'
import { SubscriptionSettings } from './SubscriptionSettings'
import styles from './page.module.css'

export const dynamic = 'force-dynamic'

export default async function MonetizationPage() {
  const session = await getSession()
  if (!session?.user?.id) redirect('/login')

  const profile = await db.query.creatorProfiles.findFirst({
    where: eq(creatorProfiles.userId, session.user.id),
  })

  const connected = !!profile?.stripeOnboardingComplete

  return (
    <main className={styles.main}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Monetization</h1>
        <p className={styles.subhead}>
          Connect with Stripe to start selling lessons, courses, and subscriptions.
        </p>

        <section className={styles.card}>
          <h2 className={styles.cardHeading}>Payments</h2>
          {connected ? (
            <p className={styles.connectedText}>
              Connected to Stripe. You can now set prices on your content.
            </p>
          ) : (
            <>
              <p className={styles.cardBody}>
                Primr uses Stripe Connect to handle payments and payouts. Primr
                takes a 30% platform fee, reduced to 20% once your lifetime
                revenue passes the threshold.
              </p>
              <ConnectStripeButton />
            </>
          )}
        </section>

        {connected && (
          <SubscriptionSettings
            initialEnabled={profile?.subscriptionEnabled ?? false}
            initialPriceCents={profile?.subscriptionPriceCents ?? null}
          />
        )}
      </div>
    </main>
  )
}
