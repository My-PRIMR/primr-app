'use client'

import { useState } from 'react'
import Link from 'next/link'
import styles from './OnboardingStrip.module.css'

export interface OnboardingLesson {
  id: string
  title: string
  slug: string
  displayOrder: number
  status: 'completed' | 'in_progress' | 'not_started'
}

interface Props {
  lessons: OnboardingLesson[]
}

export default function OnboardingStrip({ lessons }: Props) {
  const [dismissed, setDismissed] = useState(false)
  const [showToast, setShowToast] = useState(false)

  if (dismissed) {
    if (!showToast) return null
    return (
      <div className={styles.toast}>
        <span>Your onboarding lessons are still available in the <strong>My Learning</strong> tab.</span>
        <button onClick={() => setShowToast(false)} className={styles.toastClose} aria-label="Close">×</button>
      </div>
    )
  }

  const completedCount = lessons.filter(l => l.status === 'completed').length

  async function handleDismiss() {
    await fetch('/api/user/onboarding-dismiss', { method: 'PATCH' })
    setDismissed(true)
    setShowToast(true)
    setTimeout(() => setShowToast(false), 5000)
  }

  function statusLabel(status: OnboardingLesson['status']) {
    if (status === 'completed')   return '✅ Completed'
    if (status === 'in_progress') return '▶ In progress'
    return '⬜ Not started'
  }

  return (
    <div className={styles.strip}>
      <div className={styles.header}>
        <span className={styles.title}>Get started with Primr</span>
        <span className={styles.count}>{completedCount} of {lessons.length} complete</span>
        <button onClick={handleDismiss} className={styles.dismiss} aria-label="Dismiss onboarding">Dismiss ×</button>
      </div>
      <div className={styles.cards}>
        {lessons.map(lesson => (
          <Link
            key={lesson.id}
            href={`/learn/${lesson.slug}`}
            className={`${styles.card} ${styles[lesson.status]}`}
          >
            <span className={styles.statusLabel}>{statusLabel(lesson.status)}</span>
            <span className={styles.lessonTitle}>{lesson.title}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
