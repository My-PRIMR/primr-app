'use client'

import { useState, useEffect } from 'react'
import styles from './EmbedAnalytics.module.css'

interface Analytics {
  views: number
  completions: number
  topDomains: Array<{ domain: string; count: number }>
}

export default function EmbedAnalytics() {
  const [data, setData] = useState<Analytics | null>(null)
  const [range, setRange] = useState('30d')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/embed/analytics?range=${range}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [range])

  if (loading) return <p className={styles.loading}>Loading embed analytics...</p>
  if (!data || (data.views === 0 && data.completions === 0)) {
    return <p className={styles.empty}>No embed activity yet. Embed your content on external sites to see analytics here.</p>
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Embed Analytics</h3>
        <select className={styles.rangeSelect} value={range} onChange={e => setRange(e.target.value)}>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="all">All time</option>
        </select>
      </div>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{data.views.toLocaleString()}</span>
          <span className={styles.statLabel}>Views</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{data.completions.toLocaleString()}</span>
          <span className={styles.statLabel}>Completions</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>
            {data.views > 0 ? `${Math.round((data.completions / data.views) * 100)}%` : '\u2014'}
          </span>
          <span className={styles.statLabel}>Completion rate</span>
        </div>
      </div>
      {data.topDomains.length > 0 && (
        <div className={styles.domains}>
          <h4 className={styles.domainsTitle}>Top embedding sites</h4>
          <ul className={styles.domainList}>
            {data.topDomains.map(d => (
              <li key={d.domain} className={styles.domainItem}>
                <span className={styles.domainName}>{d.domain || 'Direct'}</span>
                <span className={styles.domainCount}>{d.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
