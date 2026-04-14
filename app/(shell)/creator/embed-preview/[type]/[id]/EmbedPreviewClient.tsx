'use client'

import { useMemo, useRef, useState } from 'react'
import { THEMES, canUseTheme, type UserPlan } from '@/lib/themes'
import styles from './EmbedPreview.module.css'

interface Props {
  type: 'lesson' | 'course'
  id: string
  title: string
  savedTheme: string
  userPlan: UserPlan
}

export default function EmbedPreviewClient({ type, id, title, savedTheme, userPlan }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [selected, setSelected] = useState(savedTheme)
  const [saved, setSaved] = useState(savedTheme)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [upgradeRequired, setUpgradeRequired] = useState(false)

  const selectedTheme = useMemo(
    () => THEMES.find((t) => t.id === selected),
    [selected],
  )
  const locked = !canUseTheme(selected, userPlan)
  const canSave = selected !== saved && !locked && status !== 'saving'

  function onPick(themeId: string) {
    setSelected(themeId)
    setStatus('idle')
    setUpgradeRequired(false)
    // Live swap inside the iframe
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'primr-theme-change', theme: themeId },
      '*',
    )
  }

  async function onSave() {
    setStatus('saving')
    setUpgradeRequired(false)
    const res = await fetch(`/api/creator/${type}s/${id}/theme`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ theme: selected }),
    })
    if (res.ok) {
      setSaved(selected)
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 1500)
      return
    }
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    if (res.status === 403 && body.error === 'upgrade_required') {
      setUpgradeRequired(true)
      setStatus('error')
      return
    }
    setStatus('error')
  }

  const iframeSrc = `/embed/${type}/${id}?theme=${selected}`

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <h1 className={styles.title}>Preview: {title}</h1>
        <button className={styles.closeBtn} onClick={() => window.close()}>
          Close
        </button>
      </header>

      <div className={styles.toolbar}>
        <label className={styles.toolbarLabel}>Theme</label>
        <select
          className={styles.select}
          value={selected}
          onChange={(e) => onPick(e.target.value)}
        >
          {THEMES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
              {t.tier !== 'free' ? ` (${t.tier})` : ''}
            </option>
          ))}
        </select>
        {selectedTheme && selectedTheme.tier !== 'free' && (
          <span className={styles.tierPill}>{selectedTheme.tier}</span>
        )}

        {upgradeRequired ? (
          <a
            className={styles.upgradeLink}
            href="/upgrade"
            target="_blank"
            rel="noopener noreferrer"
          >
            Upgrade to {selectedTheme?.tier === 'enterprise' ? 'Enterprise' : 'Pro'}
          </a>
        ) : (
          <button className={styles.saveBtn} disabled={!canSave} onClick={onSave}>
            {status === 'saving' ? 'Saving…' : 'Set as default'}
          </button>
        )}
        {status === 'saved' && <span className={styles.saved}>Saved</span>}
      </div>

      <div className={styles.viewport}>
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          className={styles.frame}
          title="Embed preview"
          height={700}
          allow="clipboard-write"
        />
      </div>
    </div>
  )
}
