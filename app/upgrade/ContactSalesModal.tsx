'use client'

import { useEffect, useState } from 'react'
import styles from './page.module.css'

export function ContactSalesModal() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [teamSize, setTeamSize] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener('primr:openContactSales', handler)
    return () => window.removeEventListener('primr:openContactSales', handler)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setError(null)
    const res = await fetch('/api/upgrade/contact-sales', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, email, teamSize, message }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Failed to send')
      setStatus('error')
      return
    }
    setStatus('sent')
  }

  if (!open) return null

  return (
    <div className={styles.modalBackdrop} onClick={() => setOpen(false)}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="contact-sales-title"
        aria-modal="true"
      >
        <button
          className={styles.modalClose}
          onClick={() => setOpen(false)}
          aria-label="Close"
          type="button"
        >
          ×
        </button>
        <h2 id="contact-sales-title" className={styles.modalTitle}>
          Contact sales
        </h2>
        {status === 'sent' ? (
          <p className={styles.modalSent}>
            Thanks — we&rsquo;ll be in touch within a business day.
          </p>
        ) : (
          <form onSubmit={submit}>
            <label className={styles.modalLabel}>
              Your name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={styles.modalInput}
                required
              />
            </label>
            <label className={styles.modalLabel}>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.modalInput}
                required
              />
            </label>
            <label className={styles.modalLabel}>
              Team size
              <select
                value={teamSize}
                onChange={(e) => setTeamSize(e.target.value)}
                className={styles.modalInput}
              >
                <option value="">Select…</option>
                <option>Under 10</option>
                <option>10–50</option>
                <option>50–200</option>
                <option>200+</option>
              </select>
            </label>
            <label className={styles.modalLabel}>
              Message
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className={styles.modalInput}
                rows={4}
              />
            </label>
            <button
              type="submit"
              disabled={status === 'sending'}
              className={styles.modalSubmit}
            >
              {status === 'sending' ? 'Sending…' : 'Contact sales'}
            </button>
            {error && <p className={styles.modalError}>{error}</p>}
          </form>
        )}
      </div>
    </div>
  )
}
