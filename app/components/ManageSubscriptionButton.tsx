'use client'

import { useState } from 'react'
import styles from './ManageSubscriptionButton.module.css'

export function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function go() {
    setLoading(true)
    setError(null)
    const res = await fetch('/api/billing/portal', { method: 'POST' })
    if (!res.ok) {
      setError('Failed to open billing portal')
      setLoading(false)
      return
    }
    const { url } = await res.json()
    window.location.href = url
  }

  return (
    <>
      <button onClick={go} disabled={loading} className={styles.manageBtn}>
        {loading ? 'Opening…' : 'Manage subscription'}
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </>
  )
}
