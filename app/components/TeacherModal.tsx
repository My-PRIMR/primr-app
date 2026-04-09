'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import styles from './UpgradeModal.module.css'

interface TeacherModalProps {
  onClose: () => void
}

export function TeacherModal({ onClose }: TeacherModalProps) {
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    const formData = new FormData(e.currentTarget)
    const res = await fetch('/api/teacher-application', { method: 'POST', body: formData })
    setSubmitting(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Submission failed. Please try again.')
      return
    }
    setSubmitted(true)
  }

  return createPortal(
    <div className={styles.backdrop} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.card} role="dialog" aria-modal="true" style={{ maxWidth: 520, overflowY: 'auto', maxHeight: '90vh' }}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>

        <div className={styles.badge}>Free for educators</div>
        <h2 className={styles.title}>Apply for the Teacher tier</h2>

        {submitted ? (
          <>
            <p className={styles.subtitle}>Application received. We&apos;ll review your application and email you within 2 business days.</p>
            <button className={styles.cta} onClick={onClose}>Close</button>
          </>
        ) : (
          <>
            <p className={styles.subtitle}>Free for verified K-12 teachers using Primr with their own students. Submit one of the documents below to verify your role.</p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <label className={styles.fieldLabel}>
                Full name
                <input name="name" required className={styles.input} />
              </label>
              <label className={styles.fieldLabel}>
                Contact email
                <input name="email" type="email" required className={styles.input} />
              </label>
              <label className={styles.fieldLabel}>
                School name
                <input name="schoolName" required className={styles.input} />
              </label>
              <label className={styles.fieldLabel}>
                Grade level
                <select name="gradeLevel" required className={styles.input}>
                  <option value="">Choose…</option>
                  <option>Elementary K-5</option>
                  <option>Middle 6-8</option>
                  <option>High 9-12</option>
                  <option>Other K-12</option>
                </select>
              </label>
              <label className={styles.fieldLabel}>
                Current role
                <select name="currentRole" required className={styles.input}>
                  <option value="">Choose…</option>
                  <option>Classroom teacher</option>
                  <option>Specialist</option>
                  <option>Substitute</option>
                  <option>Administrator</option>
                  <option>Other</option>
                </select>
              </label>
              <label className={styles.fieldLabel}>
                <span>Proof of role</span>
                <span className={styles.fieldHint}>School photo ID badge, pay stub, employment verification letter, faculty/staff directory page, or teaching certificate. PDF, PNG, JPG, or WebP up to 5 MB.</span>
                <input name="proof" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" required className={styles.input} />
              </label>

              {error && <p className={styles.error}>{error}</p>}

              <button type="submit" className={styles.cta} disabled={submitting} style={{ marginTop: '0.5rem' }}>
                {submitting ? 'Submitting…' : 'Submit application →'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
