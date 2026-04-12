'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './page.module.css'

export default function SecurityPage() {
  const router = useRouter()
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
    let res: Response
    let data: { error?: string }
    try {
      res = await fetch('/api/account/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      data = await res.json()
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
      return
    }
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
          <button type="button" onClick={() => router.back()} className={styles.backLink}>
            ← Back
          </button>
        </p>
      </div>
    </main>
  )
}
