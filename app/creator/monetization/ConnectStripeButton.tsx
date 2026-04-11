'use client'

import { useState } from 'react'
import styles from './ConnectStripeButton.module.css'

export function ConnectStripeButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/creator/stripe/connect', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to start onboarding')
      const { url } = await res.json()
      window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setLoading(false)
    }
  }

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={styles.button}
      >
        {loading ? 'Redirecting…' : 'Connect with Stripe'}
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  )
}
