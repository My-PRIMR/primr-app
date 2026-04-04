'use client'

import { useState, useRef, useEffect } from 'react'
import type { BlockConfig } from '@/types/outline'
import styles from './BlockEditPanel.module.css'
import { PAGE_ARRAY_KEY } from '../../lib/pageArrayKey'
import { EMPTY_PROPS } from '../../components/LessonBlockEditor'
import { ALL_BLOCK_TYPES } from '@/lib/block-schemas'
import ImageSection from './ImageSection'
import type { ImageValue } from './ImageSection'

const IMAGE_BLOCKS = ['hero', 'narrative', 'step-navigator']

interface Props {
  block: BlockConfig
  blockIndex: number
  lessonTitle: string
  onUpdate: (index: number, block: BlockConfig) => void
  onClose: () => void
  headerAction?: React.ReactNode
  activePage?: number
  onPageChange?: (index: number) => void
  canPexels?: boolean
  /** Whether the current user can use AI rewrite/conversion features. */
  canAiEdit?: boolean
}

/** Render labeled form fields for a block's props based on its type */
function PropsEditor({ blockType, props, onChange, activePage, onPageChange, canPexels }: {
  blockType: string
  props: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
  activePage?: number
  onPageChange?: (index: number) => void
  canPexels?: boolean
}) {
  const pageArrayKey = PAGE_ARRAY_KEY[blockType]
  const pageItemRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    if (!pageArrayKey || activePage === undefined) return
    pageItemRefs.current[activePage]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activePage, pageArrayKey])

  return (
    <div className={styles.fields}>
      {/* Dedicated image editor for hero and narrative */}
      {(blockType === 'hero' || blockType === 'narrative') && (
        <ImageSection
          blockType={blockType as 'hero' | 'narrative'}
          image={props.image as ImageValue | undefined}
          canPexels={canPexels ?? false}
          onChange={(newImage) => onChange('image', newImage)}
        />
      )}

      {Object.entries(props).map(([key, value]) => {
        // Skip callback props
        if (key === 'onComplete' || key === 'onCtaClick') return null
        // Image for hero/narrative is handled above; image for step-navigator is per-step below
        if (key === 'image' && IMAGE_BLOCKS.includes(blockType)) return null

        // Array fields: render sub-items with add/delete/reorder
        if (Array.isArray(value)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const arr = value as any[]
          function moveItem(from: number, to: number) {
            if (to < 0 || to >= arr.length) return
            const next = [...arr]
            const [moved] = next.splice(from, 1)
            next.splice(to, 0, moved)
            onChange(key, next)
          }

          function removeItem(idx: number) {
            onChange(key, arr.filter((_: unknown, i: number) => i !== idx))
          }

          function addItem() {
            const template = arr.length > 0 && typeof arr[0] === 'object' && arr[0] !== null
              ? Object.fromEntries(Object.keys(arr[0] as Record<string, unknown>).map(k => {
                  const sample = (arr[0] as Record<string, unknown>)[k]
                  if (typeof sample === 'number') return [k, 0]
                  if (typeof sample === 'boolean') return [k, false]
                  if (Array.isArray(sample)) return [k, ['', '', '', '']]
                  return [k, '']
                }))
              : ''
            onChange(key, [...arr, template])
          }

          const locked = false
          const isPageArray = key === pageArrayKey
          if (isPageArray) pageItemRefs.current = []

          return (
            <div key={key} className={styles.fieldGroup}>
              <div className={styles.arrayHeader}>
                <label className={styles.fieldLabel}>{formatLabel(key)} ({arr.length})</label>
                {!locked && <TipButton cls={styles.arrayAddBtn} tip="Add a new item" onClick={addItem}>+ Add</TipButton>}
              </div>
              {arr.map((item: unknown, idx: number) => {
                return (
                  <div
                    key={idx}
                    ref={isPageArray ? (el) => { pageItemRefs.current[idx] = el } : undefined}
                    className={[
                      styles.arrayItem,
                      isPageArray && idx === activePage ? styles.arrayItemActive : '',
                    ].filter(Boolean).join(' ')}
                    onClick={isPageArray && onPageChange ? () => onPageChange(idx) : undefined}
                    style={isPageArray && onPageChange ? { cursor: 'pointer' } : undefined}
                  >
                  <div className={styles.arrayControls}>
                    <span className={styles.arrayIndex}>{idx + 1}</span>
                    {!locked && <>
                      <span className={styles.arrayControlsSpacer} />
                      <TipButton cls={styles.arrayMoveBtn} tip="Move up" disabled={idx === 0} onClick={() => moveItem(idx, idx - 1)}>↑</TipButton>
                      <TipButton cls={styles.arrayMoveBtn} tip="Move down" disabled={idx === arr.length - 1} onClick={() => moveItem(idx, idx + 1)}>↓</TipButton>
                      <TipButton cls={styles.arrayDeleteBtn} tip="Delete" onClick={() => removeItem(idx)}>×</TipButton>
                    </>}
                  </div>
                  {typeof item === 'object' && item !== null ? (
                    <div className={styles.subFields}>
                      {Object.entries(item as Record<string, unknown>).map(([subKey, subVal]) => {
                        // image sub-key in steps is rendered via ImageSection below
                        if (key === 'steps' && blockType === 'step-navigator' && subKey === 'image') return null
                        return (
                          <FieldInput
                            key={subKey}
                            label={formatLabel(subKey)}
                            value={subVal}
                            onChange={(newVal) => {
                              const newArr = [...arr]
                              newArr[idx] = { ...newArr[idx], [subKey]: newVal }
                              onChange(key, newArr)
                            }}
                          />
                        )
                      })}
                      {key === 'steps' && blockType === 'step-navigator' && (
                        <ImageSection
                          blockType="step-navigator"
                          image={(item as Record<string, unknown>).image as ImageValue | undefined}
                          canPexels={canPexels ?? false}
                          onChange={(newImage) => {
                            const newArr = [...arr]
                            newArr[idx] = { ...newArr[idx], image: newImage }
                            onChange(key, newArr)
                          }}
                        />
                      )}
                    </div>
                  ) : (
                    <FieldInput
                      label=""
                      value={item}
                      onChange={(newVal) => {
                        const newArr = [...arr]
                        newArr[idx] = newVal
                        onChange(key, newArr)
                      }}
                    />
                  )}
                </div>
                )
              })}
            </div>
          )
        }

        // Scalar fields
        return (
          <FieldInput
            key={key}
            label={formatLabel(key)}
            value={value}
            onChange={(newVal) => onChange(key, newVal)}
          />
        )
      })}
    </div>
  )
}

const FIELD_TOOLTIPS: Record<string, string> = {
  Eyebrow: 'Small uppercase text that appears above the title — acts as a section label or category tag.',
  Tagline: 'One-sentence description shown below the hero title.',
  Badge: 'Small label shown above the block title, e.g. "Quiz" or "Step walkthrough".',
  'Pass Score': 'Score required to pass (0–1). E.g. 0.6 means 60% correct.',
  Hint: 'Optional hint text shown to the learner if they get stuck.',
}

function Tooltip({ text }: { text: string }) {
  return (
    <span className={styles.tooltip}>
      <span className={styles.tooltipIcon}>i</span>
      <span className={styles.tooltipText}>{text}</span>
    </span>
  )
}

function TipButton({ cls, tip, disabled, onClick, children }: {
  cls: string; tip: string; disabled?: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <span className={styles.tipWrap}>
      <button type="button" className={cls} disabled={disabled} onClick={onClick}>{children}</button>
      <span className={styles.tipPopup}>{tip}</span>
    </span>
  )
}

function FieldInput({ label, value, onChange }: { label: string; value: unknown; onChange: (v: unknown) => void }) {
  const tip = FIELD_TOOLTIPS[label]
  if (typeof value === 'boolean') {
    return (
      <label className={styles.checkboxLabel}>
        <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} />
        {label}{tip && <Tooltip text={tip} />}
      </label>
    )
  }

  if (typeof value === 'number') {
    return (
      <label className={styles.fieldLabel}>
        <span>{label}{tip && <Tooltip text={tip} />}</span>
        <input
          type="number"
          className={styles.fieldInput}
          defaultValue={value}
          onBlur={e => onChange(parseFloat(e.target.value) || 0)}
        />
      </label>
    )
  }

  const strVal = typeof value === 'string' ? value : JSON.stringify(value)
  const isLong = strVal.length > 80

  return (
    <label className={styles.fieldLabel}>
      <span>{label}{tip && <Tooltip text={tip} />}</span>
      {isLong ? (
        <textarea
          className={styles.fieldTextarea}
          defaultValue={strVal}
          onBlur={e => onChange(e.target.value)}
          rows={Math.min(8, Math.ceil(strVal.length / 60))}
        />
      ) : (
        <input
          type="text"
          className={styles.fieldInput}
          defaultValue={strVal}
          onBlur={e => onChange(e.target.value)}
        />
      )}
    </label>
  )
}

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/^\w/, c => c.toUpperCase())
    .trim()
}

export default function BlockEditPanel({ block, blockIndex, lessonTitle, activePage, onPageChange, onUpdate, onClose, headerAction, canPexels = false, canAiEdit = false }: Props) {
  const [localProps, setLocalProps] = useState<Record<string, unknown>>(block.props as Record<string, unknown>)
  const [jsonOpen, setJsonOpen] = useState(false)

  // AI rewrite / type conversion
  const [originalBlock, setOriginalBlock] = useState<{ type: string; props: Record<string, unknown> } | null>(null)
  const [selectedType, setSelectedType] = useState<string>(block.type)
  const [instruction, setInstruction] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiOpen, setAiOpen] = useState(false)
  const aiInFlight = useRef(false)

  function handleFieldChange(key: string, value: unknown) {
    const next = { ...localProps, [key]: value }
    setLocalProps(next)
    onUpdate(blockIndex, { ...block, props: next })
  }

  function handleTypeChange(newType: string) {
    if (newType === selectedType) return
    if (!originalBlock) {
      setOriginalBlock({ type: block.type, props: { ...localProps } })
    }
    setSelectedType(newType)
    const emptyProps = (EMPTY_PROPS as Record<string, Record<string, unknown>>)[newType] ?? {}
    setLocalProps(emptyProps)
    onUpdate(blockIndex, { ...block, type: newType as BlockConfig['type'], props: emptyProps })
    setAiError('')
  }

  function handleRevert() {
    if (!originalBlock) return
    setSelectedType(originalBlock.type)
    setLocalProps(originalBlock.props)
    onUpdate(blockIndex, { ...block, type: originalBlock.type as BlockConfig['type'], props: originalBlock.props })
    setOriginalBlock(null)
    setInstruction('')
    setAiError('')
  }

  async function handleAiRewrite() {
    if (aiInFlight.current) return
    aiInFlight.current = true
    const sourceProps = originalBlock?.props ?? localProps
    const sourceType = originalBlock?.type ?? block.type
    if (!originalBlock) {
      setOriginalBlock({ type: block.type, props: { ...localProps } })
    }
    setAiLoading(true)
    setAiError('')
    try {
      const res = await fetch('/api/lessons/rewrite-block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          block: { id: block.id, type: sourceType, props: sourceProps },
          targetType: selectedType,
          instruction: instruction.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAiError(data.error ?? 'Generation failed')
        return
      }
      const newProps = data.block.props as Record<string, unknown>
      setLocalProps(newProps)
      onUpdate(blockIndex, { ...block, type: selectedType as BlockConfig['type'], props: newProps })
    } catch {
      setAiError('Network error. Please try again.')
    } finally {
      setAiLoading(false)
      aiInFlight.current = false
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          Edit: <span className={styles.blockType}>{block.type}</span>
        </h3>
        <div className={styles.headerActions}>
          {headerAction}
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
      </div>

      <div className={styles.scrollArea}>
        <PropsEditor blockType={block.type} props={localProps} onChange={handleFieldChange} activePage={activePage} onPageChange={onPageChange} canPexels={canPexels} />

        {/* AI rewrite / type conversion */}
        <div className={styles.aiSection}>
          <button
            type="button"
            className={styles.aiToggle}
            onClick={() => setAiOpen(o => !o)}
          >
            <span className={styles.aiIcon}>✦</span>
            <span>AI rewrite</span>
            {!canAiEdit && <span className={styles.aiBadge}>Pro</span>}
            <span className={styles.aiChevron}>{aiOpen ? '▲' : '▼'}</span>
          </button>

          {aiOpen && (
            <div className={styles.aiBody}>
              {/* Type selector — all users */}
              <label className={styles.aiLabel}>
                Block type
                <select
                  className={styles.aiSelect}
                  value={selectedType}
                  onChange={e => handleTypeChange(e.target.value)}
                >
                  {ALL_BLOCK_TYPES.map(t => (
                    <option key={t} value={t}>{formatLabel(t)}</option>
                  ))}
                </select>
              </label>

              {/* Guidance — Pro only */}
              <label className={[styles.aiLabel, !canAiEdit ? styles.aiLabelDisabled : ''].join(' ')}>
                What should change? <span className={styles.aiOptional}>(optional)</span>
                <textarea
                  className={styles.aiTextarea}
                  placeholder={canAiEdit ? 'e.g. "make it harder", "focus on compliance"' : 'Available on Pro'}
                  value={instruction}
                  onChange={e => setInstruction(e.target.value)}
                  disabled={!canAiEdit}
                  rows={2}
                />
              </label>

              {/* Actions */}
              <div className={styles.aiActions}>
                {originalBlock && (
                  <button
                    type="button"
                    className={styles.aiRevertBtn}
                    onClick={handleRevert}
                    disabled={aiLoading}
                  >
                    ↩ Revert to {originalBlock.type}
                  </button>
                )}
                <button
                  type="button"
                  className={styles.aiBtn}
                  onClick={handleAiRewrite}
                  disabled={!canAiEdit || aiLoading}
                >
                  {aiLoading
                    ? '✦ Generating…'
                    : selectedType !== (originalBlock?.type ?? block.type)
                      ? '✦ Generate with AI'
                      : '✦ Rewrite'}
                </button>
              </div>

              {aiError && <p className={styles.aiError}>{aiError}</p>}
            </div>
          )}
        </div>

        {/* Collapsible raw JSON */}
        <details className={styles.jsonDetails} open={jsonOpen} onToggle={e => setJsonOpen((e.target as HTMLDetailsElement).open)}>
          <summary className={styles.jsonSummary}>Raw JSON</summary>
          <pre className={styles.json}>{JSON.stringify(block.props, null, 2)}</pre>
        </details>
      </div>
    </div>
  )
}
