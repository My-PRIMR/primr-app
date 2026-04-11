'use client'

import { useState } from 'react'
import styles from './SubscriptionSettings.module.css'

interface Props {
  initialEnabled: boolean
  initialPriceCents: number | null
}

export function SubscriptionSettings({ initialEnabled, initialPriceCents }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [dollars, setDollars] = useState(
    initialPriceCents != null ? (initialPriceCents / 100).toFixed(2) : '5.00',
  )
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setStatus('saving')
    setError(null)
    const priceCents = enabled ? Math.round(parseFloat(dollars || '0') * 100) : null
    const res = await fetch('/api/creator/subscription-settings', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled, priceCents }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Failed to save')
      setStatus('error')
      return
    }
    setStatus('saved')
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Subscriptions</h2>
      <p className={styles.subhead}>
        Offer a monthly subscription that unlocks all your paid content.
      </p>
      <label className={styles.toggleRow}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        <span>Enable subscriptions</span>
      </label>
      {enabled && (
        <div className={styles.priceRow}>
          <label className={styles.priceLabel}>Monthly price (USD, $1–$100)</label>
          <input
            type="number"
            min="1"
            max="100"
            step="0.50"
            value={dollars}
            onChange={(e) => setDollars(e.target.value)}
            className={styles.priceInput}
          />
        </div>
      )}
      <button
        onClick={save}
        disabled={status === 'saving'}
        className={styles.saveBtn}
      >
        {status === 'saving' ? 'Saving…' : 'Save subscription settings'}
      </button>
      {status === 'saved' && <span className={styles.saved}>Saved</span>}
      {error && <span className={styles.error}>{error}</span>}
    </section>
  )
}
