'use client'

import { useState } from 'react'
import styles from './page.module.css'

export function MonthlyAnnualToggle({
  initialPeriod,
}: {
  initialPeriod: 'monthly' | 'annual'
}) {
  const [period, setPeriod] = useState<'monthly' | 'annual'>(initialPeriod)

  const onToggle = (next: 'monthly' | 'annual') => {
    setPeriod(next)
    window.dispatchEvent(new CustomEvent('primr:period', { detail: next }))
  }

  return (
    <div className={styles.toggleRow} role="tablist">
      <button
        role="tab"
        className={period === 'monthly' ? styles.toggleActive : styles.toggle}
        onClick={() => onToggle('monthly')}
      >
        Monthly
      </button>
      <button
        role="tab"
        className={period === 'annual' ? styles.toggleActive : styles.toggle}
        onClick={() => onToggle('annual')}
      >
        Annual <span className={styles.save}>(Save 20%)</span>
      </button>
    </div>
  )
}
