'use client'

import { useState } from 'react'
import styles from './page.module.css'

export function InviteMemberForm({
  canInvite,
  seatLimit,
}: {
  canInvite: boolean
  seatLimit: number
}) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setError(null)
    const res = await fetch('/api/team/invite', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Failed to send invite')
      setStatus('error')
      return
    }
    setStatus('sent')
    setEmail('')
    setTimeout(() => window.location.reload(), 500)
  }

  if (!canInvite) {
    return (
      <p className={styles.muted}>
        Seat limit reached ({seatLimit} seats). Upgrade to add more.
      </p>
    )
  }

  return (
    <form onSubmit={submit} className={styles.inviteForm}>
      <input
        type="email"
        placeholder="teammate@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={styles.inviteInput}
        required
      />
      <button
        type="submit"
        disabled={status === 'sending'}
        className={styles.inviteBtn}
      >
        {status === 'sending' ? 'Sending…' : 'Send invite'}
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </form>
  )
}
