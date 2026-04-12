'use client'

import { useState } from 'react'
import styles from './PricingSection.module.css'

interface Props {
  courseId: string
  initialPriceCents: number | null
  initialIsPaid: boolean
}

export function PricingSection({
  courseId,
  initialPriceCents,
  initialIsPaid,
}: Props) {
  const [isPaid, setIsPaid] = useState(initialIsPaid)
  const [dollars, setDollars] = useState(
    initialPriceCents != null ? (initialPriceCents / 100).toFixed(2) : '',
  )
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle',
  )
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setStatus('saving')
    setError(null)
    const priceCents = isPaid ? Math.round(parseFloat(dollars || '0') * 100) : null
    const res = await fetch(`/api/creator/courses/${courseId}/pricing`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isPaid, priceCents }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Failed to save')
      setStatus('error')
      return
    }
    setStatus('saved')
  }

  const [collapsed, setCollapsed] = useState(true)

  return (
    <section className={styles.section}>
      <button className={styles.headingBtn} onClick={() => setCollapsed(v => !v)}>
        <span className={`${styles.chevron} ${collapsed ? styles.chevronCollapsed : ''}`}>▾</span>
        <span>Pricing</span>
      </button>
      {!collapsed && <>
      <label className={styles.toggleRow}>
        <input
          type="checkbox"
          checked={isPaid}
          onChange={(e) => setIsPaid(e.target.checked)}
        />
        <span>This course is paid</span>
      </label>
      {isPaid && (
        <div className={styles.priceInputRow}>
          <label className={styles.inputLabel}>Price (USD)</label>
          <input
            type="number"
            min="0.99"
            step="0.01"
            value={dollars}
            onChange={(e) => setDollars(e.target.value)}
            className={styles.priceInput}
          />
          <p className={styles.hint}>
            Subscribers to your creator subscription automatically get access.
          </p>
        </div>
      )}
      <div className={styles.actions}>
        <button
          onClick={save}
          disabled={status === 'saving'}
          className={styles.saveBtn}
        >
          {status === 'saving' ? 'Saving…' : 'Save pricing'}
        </button>
        {status === 'saved' && <span className={styles.saved}>Saved</span>}
        {error && <span className={styles.error}>{error}</span>}
      </div>
      </>}
    </section>
  )
}
