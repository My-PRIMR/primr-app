'use client'

import { useState } from 'react'
import styles from './EmbedCodeModal.module.css'

interface Props {
  type: 'lesson' | 'course'
  id: string
  title: string
  onClose: () => void
}

export default function EmbedCodeModal({ type, id, title, onClose }: Props) {
  const [tab, setTab] = useState<'sdk' | 'iframe'>('sdk')
  const [copied, setCopied] = useState(false)

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://primr.me'
  const embedUrl = `${origin}/embed/${type}/${id}`

  const sdkSnippet = `<script src="${origin}/embed/v1.js" defer></script>\n<primr-${type} ${type}-id="${id}"></primr-${type}>`
  const iframeSnippet = `<iframe src="${embedUrl}" width="100%" height="600" frameborder="0" allow="clipboard-write" style="max-width:900px;"></iframe>`

  const snippet = tab === 'sdk' ? sdkSnippet : iframeSnippet

  function handleCopy() {
    navigator.clipboard.writeText(snippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function openPreview() {
    window.open(
      `/creator/embed-preview/${type}/${id}`,
      'primr-embed-preview',
      'width=1100,height=800,menubar=no,toolbar=no',
    )
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Embed: {title}</h2>
          <button className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'sdk' ? styles.tabActive : ''}`} onClick={() => setTab('sdk')}>SDK (recommended)</button>
          <button className={`${styles.tab} ${tab === 'iframe' ? styles.tabActive : ''}`} onClick={() => setTab('iframe')}>iframe</button>
        </div>
        <div className={styles.config}>
          <button className={styles.configSelect} onClick={openPreview}>
            Preview &amp; choose theme →
          </button>
        </div>
        <pre className={styles.code}>{snippet}</pre>
        <button className={styles.copyBtn} onClick={handleCopy}>{copied ? 'Copied!' : 'Copy to clipboard'}</button>
      </div>
    </div>
  )
}
