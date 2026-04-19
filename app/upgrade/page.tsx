import { getSession } from '@/session'
import { PlanCard } from './PlanCard'
import { MonthlyAnnualToggle } from './MonthlyAnnualToggle'
import { ContactSalesModal } from './ContactSalesModal'
import styles from './page.module.css'

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const session = await getSession()
  const { period } = await searchParams
  const initialPeriod: 'monthly' | 'annual' = period === 'annual' ? 'annual' : 'monthly'
  const currentPlan = session?.user?.plan ?? 'free'

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1 className={styles.title}>Choose your plan</h1>
        <p className={styles.subtitle}>
          Unlock course generation and unlimited lessons.
        </p>
        <MonthlyAnnualToggle initialPeriod={initialPeriod} />
      </header>

      <div className={styles.grid}>
        <PlanCard
          tier="free"
          name="Free"
          priceLabel="$0"
          description="For learners and light creators."
          features={[
            'Basic lesson generation',
            'No course creation',
            'Haiku model only',
          ]}
          current={currentPlan === 'free'}
        />
        <PlanCard
          tier="pro"
          name="Pro"
          priceLabel="$29/mo"
          annualPriceLabel="$290/yr"
          description="For individual creators. 14-day free trial, cancel anytime."
          features={[
            '14-day free trial',
            'Unlimited lesson generation',
            'Course creation',
            'Sonnet model access',
            'Priority support',
          ]}
          featured
          current={currentPlan === 'pro'}
          trialDays={14}
        />
        <PlanCard
          tier="teams"
          name="Teams"
          priceLabel="$99/mo"
          annualPriceLabel="$990/yr"
          description="For creator teams up to 5."
          features={[
            'Everything in Pro',
            '5 team seats',
            'Shared organization',
            'Team admin dashboard',
          ]}
        />
        <PlanCard
          tier="enterprise"
          name="Enterprise"
          priceLabel="Custom"
          description="For schools and large teams."
          features={[
            'Everything in Teams',
            'Custom seat counts',
            'Dedicated support',
            'SSO and security review',
          ]}
          enterprise
        />
      </div>

      <ContactSalesModal />
    </main>
  )
}
