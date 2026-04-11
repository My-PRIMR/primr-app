'use client'

import { useState } from 'react'
import styles from './page.module.css'

export function AcceptButton({ token }: { token: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function accept() {
    setLoading(true)
    setError(null)
    const res = await fetch('/api/team/accept', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Failed to accept')
      setLoading(false)
      return
    }
    window.location.href = '/creator'
  }

  return (
    <>
      <button
        onClick={accept}
        disabled={loading}
        className={styles.acceptBtn}
      >
        {loading ? 'Joining…' : 'Accept invitation'}
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </>
  )
}
