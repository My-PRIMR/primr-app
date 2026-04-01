'use client'

import { useState } from 'react'
import styles from './FeedbackOverlay.module.css'

interface FeedbackOverlayProps {
  onDone: (rating: number | null, comment: string) => void
}

export function FeedbackOverlay({ onDone }: FeedbackOverlayProps) {
  const [rating, setRating] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [hovered, setHovered] = useState<number | null>(null)

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <h2 className={styles.heading}>Before you go — how was this lesson?</h2>

        <div className={styles.stars} role="group" aria-label="Rate this lesson">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              type="button"
              className={[
                styles.star,
                (hovered ?? rating ?? 0) >= star ? styles.starActive : '',
              ].filter(Boolean).join(' ')}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(null)}
              aria-label={`${star} star${star !== 1 ? 's' : ''}`}
              aria-pressed={rating === star}
            >
              ★
            </button>
          ))}
        </div>

        <textarea
          className={styles.comment}
          placeholder="Anything else to share? (optional)"
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={3}
          aria-label="Additional comments"
        />

        <div className={styles.actions}>
          <button
            className={styles.submitBtn}
            onClick={() => onDone(rating, comment)}
          >
            Submit feedback
          </button>
          <button
            className={styles.skipBtn}
            onClick={() => onDone(null, '')}
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}
