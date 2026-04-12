'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import styles from './UpgradeModal.module.css'

const FEATURES = [
  { icon: '◈', title: 'Build with AI', body: 'Paste in a document, drop a link, or just describe your topic. Primr turns your source material into interactive lessons — quizzes, walkthroughs, and flip cards — in seconds.' },
  { icon: '⟐', title: 'Create full courses', body: 'Organise lessons into multi-chapter courses with a clean learning flow.' },
  { icon: '✉', title: 'Invite learners', body: 'Invite people by email or share a link. Learner accounts are free — they\'re in within seconds.' },
  { icon: '◎', title: 'Track progress', body: 'See completion rates, scores, and attempt history for everyone you teach.' },
]

interface UpgradeModalProps {
  onClose: () => void
}

export function UpgradeModal({ onClose }: UpgradeModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const cardRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  async function handleActivate() {
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/upgrade-to-creator', { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Something went wrong.')
      setLoading(false)
      return
    }
    router.push('/creator')
  }

  return createPortal(
    <div className={styles.backdrop} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.card} ref={cardRef} role="dialog" aria-modal="true">
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>

        <div className={styles.badge}>Free tier</div>
        <h2 className={styles.title}>Become a Creator</h2>
        <p className={styles.subtitle}>Teach anyone, anything. No credit card required — ever.</p>

        <ul className={styles.features}>
          {FEATURES.map(f => (
            <li key={f.title} className={styles.feature}>
              <span className={styles.featureIcon}>{f.icon}</span>
              <span>
                <span className={styles.featureTitle}>{f.title}</span>
                <span className={styles.featureBody}>{f.body}</span>
              </span>
            </li>
          ))}
        </ul>

        {error && <p className={styles.error}>{error}</p>}

        <button className={styles.cta} onClick={handleActivate} disabled={loading}>
          {loading ? 'Activating…' : 'Activate Creator Account →'}
        </button>

        <p className={styles.fine}>Free forever. No catch.</p>
      </div>
    </div>,
    document.body
  )
}
