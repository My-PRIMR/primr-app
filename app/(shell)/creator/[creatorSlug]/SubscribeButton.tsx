'use client'

import { useState } from 'react'
import styles from './page.module.css'

interface Props {
  creatorId: string
  priceCents: number
}

export function SubscribeButton({ creatorId, priceCents }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/subscribe/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ creatorId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? 'Failed to start subscription')
      }
      const { url } = await res.json()
      if (!url) throw new Error('Missing checkout URL')
      window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setLoading(false)
    }
  }

  const dollars = (priceCents / 100).toFixed(2)

  return (
    <div className={styles.subscribeBlock}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={styles.subscribeBtn}
      >
        {loading ? 'Redirecting…' : `Subscribe for $${dollars}/mo`}
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  )
}
