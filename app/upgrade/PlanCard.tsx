'use client'

import { useEffect, useState } from 'react'
import styles from './page.module.css'

interface Props {
  tier: 'free' | 'pro' | 'teams' | 'enterprise'
  name: string
  priceLabel: string
  annualPriceLabel?: string
  description: string
  features: string[]
  featured?: boolean
  enterprise?: boolean
  current?: boolean
}

export function PlanCard(props: Props) {
  const [period, setPeriod] = useState<'monthly' | 'annual'>('monthly')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<'monthly' | 'annual'>).detail
      setPeriod(detail)
    }
    window.addEventListener('primr:period', handler)
    return () => window.removeEventListener('primr:period', handler)
  }, [])

  async function handleClick() {
    if (props.tier === 'free' || props.current) return
    if (props.tier === 'enterprise') {
      window.dispatchEvent(new CustomEvent('primr:openContactSales'))
      return
    }
    setLoading(true)
    const res = await fetch('/api/upgrade/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tier: props.tier, period }),
    })
    if (!res.ok) {
      if (res.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent(`/upgrade?period=${period}`)}`
        return
      }
      setLoading(false)
      return
    }
    const { url } = await res.json()
    window.location.href = url
  }

  const priceLabel =
    period === 'annual' && props.annualPriceLabel
      ? props.annualPriceLabel
      : props.priceLabel

  let cta: string
  if (props.current) cta = 'Current plan'
  else if (props.tier === 'free') cta = '—'
  else if (props.tier === 'enterprise') cta = 'Contact sales'
  else cta = `Subscribe to ${props.name}`

  return (
    <article
      className={`${styles.card} ${props.featured ? styles.cardFeatured : ''}`}
    >
      <h2 className={styles.cardName}>{props.name}</h2>
      <p className={styles.cardPrice}>{priceLabel}</p>
      <p className={styles.cardDescription}>{props.description}</p>
      <ul className={styles.features}>
        {props.features.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <button
        onClick={handleClick}
        disabled={loading || props.current || props.tier === 'free'}
        className={styles.cardCta}
      >
        {loading ? 'Redirecting…' : cta}
      </button>
    </article>
  )
}
