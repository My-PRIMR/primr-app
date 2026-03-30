'use client'

import { useState } from 'react'
import Link from 'next/link'
import styles from './page.module.css'

export default function SecurityPage() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess(false)
    if (newPassword !== confirm) {
      setError('New passwords do not match.')
      return
    }
    setLoading(true)
    const res = await fetch('/api/account/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(data.error ?? 'Something went wrong.')
      return
    }
    setSuccess(true)
    setCurrentPassword('')
    setNewPassword('')
    setConfirm('')
  }

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <h1 className={styles.heading}>Change password</h1>
        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.field}>
            <span>Current password</span>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              className={styles.input}
            />
          </label>
          <label className={styles.field}>
            <span>New password</span>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              className={styles.input}
            />
          </label>
          <label className={styles.field}>
            <span>Confirm new password</span>
            <input
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className={styles.input}
            />
          </label>
          {error && <p className={styles.error}>{error}</p>}
          {success && <p className={styles.success}>Password updated successfully.</p>}
          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Saving...' : 'Update password'}
          </button>
        </form>
        <p className={styles.back}>
          <Link href="/my-primr" className={styles.backLink}>← Back</Link>
        </p>
      </div>
    </main>
  )
}
