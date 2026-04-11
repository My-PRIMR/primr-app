'use client'

import { useState } from 'react'
import styles from './Paywall.module.css'

interface Props {
  kind: 'lesson' | 'course'
  id: string
  title: string
  priceCents: number | null
  creatorId: string | null
  creatorSubscriptionPriceCents: number | null
}

/**
 * Paywall shown when a learner lacks access to paid content.
 * Starts a Stripe Checkout session via /api/purchase/checkout and redirects.
 * If the creator offers subscriptions, also shows a Subscribe CTA that hits
 * /api/subscribe/checkout.
 */
export function Paywall({
  kind,
  id,
  title,
  priceCents,
  creatorId,
  creatorSubscriptionPriceCents,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function buy() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/purchase/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          kind === 'lesson' ? { lessonId: id } : { courseId: id },
        ),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to start checkout')
      }
      const { url } = await res.json()
      window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setLoading(false)
    }
  }

  async function subscribe() {
    if (!creatorId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/subscribe/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ creatorId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to start subscription')
      }
      const { url } = await res.json()
      window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setLoading(false)
    }
  }

  const priceLabel =
    priceCents != null ? `$${(priceCents / 100).toFixed(2)}` : '—'

  return (
    <main className={styles.wrapper}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Paid {kind}</p>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.subtitle}>
          This {kind} is paid. Purchase it to unlock full access.
        </p>
        <p className={styles.price}>{priceLabel}</p>
        <div className={styles.actions}>
          <button
            type="button"
            onClick={buy}
            disabled={loading}
            className={styles.buyBtn}
          >
            {loading ? 'Redirecting…' : `Buy for ${priceLabel}`}
          </button>
          {creatorSubscriptionPriceCents != null && creatorId && (
            <button
              type="button"
              onClick={subscribe}
              disabled={loading}
              className={styles.subscribeBtn}
            >
              Subscribe for ${(creatorSubscriptionPriceCents / 100).toFixed(2)}/mo
            </button>
          )}
        </div>
        {error && <p className={styles.error}>{error}</p>}
      </section>
    </main>
  )
}
