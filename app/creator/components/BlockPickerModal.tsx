'use client'

import { useEffect, useRef, useState } from 'react'
import type { BlockConfig } from '@primr/components'
import { BLOCK_REGISTRY, BLOCK_CATEGORIES } from './blockRegistry'
import styles from './BlockPickerModal.module.css'

interface BlockPickerModalProps {
  open: boolean
  onClose: () => void
  onSelect: (type: BlockConfig['type']) => void
  mode: 'insert' | 'change'
}

export default function BlockPickerModal({ open, onClose, onSelect, mode }: BlockPickerModalProps) {
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('core')
  const searchRef = useRef<HTMLInputElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })

  // Reset state when modal opens (this component only mounts when open=true,
  // but the effect guard handles the case if open prop ever changes while mounted)
  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveCategory('core')
    }
  }, [open])

  // Focus search on mount
  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  const trimmed = query.trim().toLowerCase()
  const isSearching = trimmed.length > 0

  const visibleEntries = isSearching
    ? BLOCK_REGISTRY.filter(e =>
        e.label.toLowerCase().includes(trimmed) ||
        e.description.toLowerCase().includes(trimmed)
      )
    : BLOCK_REGISTRY.filter(e => e.category === activeCategory)

  const activeCategoryDef = BLOCK_CATEGORIES.find(c => c.id === activeCategory)
  const cols = isSearching ? 2 : (activeCategoryDef?.cols ?? 2)
  const gridClass = cols === 3 ? styles.grid3 : styles.grid2

  function handleSelect(type: BlockConfig['type']) {
    onSelect(type)
    onClose()
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="block-picker-title">
        {/* Header */}
        <div className={styles.header}>
          <h2 id="block-picker-title" className={styles.title}>{mode === 'insert' ? 'Insert block' : 'Change block type'}</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>
        </div>

        {/* Search */}
        <div className={styles.searchWrap}>
          <input
            ref={searchRef}
            className={styles.searchInput}
            placeholder="Search blocks…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        {/* Category tabs — hidden during search */}
        {!isSearching && (
          <div className={styles.tabs}>
            {BLOCK_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                className={`${styles.tab} ${activeCategory === cat.id ? styles.tabActive : ''}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}

        {/* Block grid */}
        <div className={`${styles.grid} ${gridClass}`}>
          {visibleEntries.length === 0 ? (
            <div className={styles.empty}>No blocks match &ldquo;{trimmed}&rdquo;</div>
          ) : (
            visibleEntries.map(entry => (
              <button
                key={entry.type}
                className={styles.card}
                onClick={() => handleSelect(entry.type)}
              >
                <div className={styles.cardIcon}>{entry.icon}</div>
                <div className={styles.cardInfo}>
                  <div className={styles.cardName}>{entry.label}</div>
                  <div className={styles.cardDesc}>{entry.description}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
