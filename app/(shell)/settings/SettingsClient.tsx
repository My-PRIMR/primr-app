'use client'

import { useState } from 'react'
import { useTheme, type Theme } from '../../components/useTheme'
import styles from './page.module.css'

export default function SettingsClient({ initialName }: { initialName: string }) {
  // ── Profile state ──
  const [name, setName] = useState(initialName)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState(false)

  // ── Password state ──
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)

  // ── Theme ──
  const { theme, setTheme } = useTheme()

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault()
    setProfileError('')
    setProfileSuccess(false)
    const trimmed = name.trim()
    if (!trimmed) {
      setProfileError('Name cannot be empty.')
      return
    }
    setProfileLoading(true)
    try {
      const res = await fetch('/api/account/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) {
        setProfileError(data.error ?? 'Something went wrong.')
      } else {
        setProfileSuccess(true)
        setName(data.name)
      }
    } catch {
      setProfileError('Something went wrong. Please try again.')
    }
    setProfileLoading(false)
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    setPwSuccess(false)
    if (newPassword !== confirm) {
      setPwError('New passwords do not match.')
      return
    }
    setPwLoading(true)
    try {
      const res = await fetch('/api/account/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPwError(data.error ?? 'Something went wrong.')
      } else {
        setPwSuccess(true)
        setCurrentPassword('')
        setNewPassword('')
        setConfirm('')
      }
    } catch {
      setPwError('Something went wrong. Please try again.')
    }
    setPwLoading(false)
  }

  return (
    <main className={styles.main}>
      <h1 className={styles.pageTitle}>Settings</h1>

      {/* ── Profile ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Profile</h2>
        <form onSubmit={handleProfileSubmit} className={styles.form}>
          <label className={styles.field}>
            <span>Display name</span>
            <input
              type="text"
              required
              maxLength={100}
              value={name}
              onChange={e => setName(e.target.value)}
              className={styles.input}
            />
          </label>
          {profileError && <p className={styles.error}>{profileError}</p>}
          {profileSuccess && <p className={styles.success}>Name updated successfully.</p>}
          <button type="submit" className={styles.submitBtn} disabled={profileLoading}>
            {profileLoading ? 'Saving...' : 'Save'}
          </button>
        </form>
      </section>

      {/* ── Password ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Change password</h2>
        <form onSubmit={handlePasswordSubmit} className={styles.form}>
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
          {pwError && <p className={styles.error}>{pwError}</p>}
          {pwSuccess && <p className={styles.success}>Password updated successfully.</p>}
          <button type="submit" className={styles.submitBtn} disabled={pwLoading}>
            {pwLoading ? 'Saving...' : 'Update password'}
          </button>
        </form>
      </section>

      {/* ── Theme ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Theme</h2>
        <div className={styles.themeRow}>
          {(['light', 'system', 'dark'] as Theme[]).map(t => (
            <button
              key={t}
              className={`${styles.themeBtn} ${theme === t ? styles.themeBtnActive : ''}`}
              onClick={() => setTheme(t)}
            >
              <span className={styles.themeIcon}>
                {t === 'light' ? '\u2600' : t === 'dark' ? '\u263E' : '\u2299'}
              </span>
              <span>{t.charAt(0).toUpperCase() + t.slice(1)}</span>
            </button>
          ))}
        </div>
      </section>
    </main>
  )
}
