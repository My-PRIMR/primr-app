'use client'

import { useState } from 'react'
import type { BlockConfig } from '@/types/outline'
import styles from './BlockEditPanel.module.css'

interface Props {
  block: BlockConfig
  blockIndex: number
  lessonTitle: string
  onUpdate: (index: number, block: BlockConfig) => void
  onClose: () => void
  headerAction?: React.ReactNode
}

/** Render labeled form fields for a block's props based on its type */
function PropsEditor({ blockType, props, onChange }: { blockType: string; props: Record<string, unknown>; onChange: (key: string, value: unknown) => void }) {
  return (
    <div className={styles.fields}>
      {Object.entries(props).map(([key, value]) => {
        // Skip callback props
        if (key === 'onComplete' || key === 'onCtaClick') return null

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

          const locked = blockType === 'fill-in-the-blank' && key === 'answers'

          return (
            <div key={key} className={styles.fieldGroup}>
              <div className={styles.arrayHeader}>
                <label className={styles.fieldLabel}>{formatLabel(key)} ({arr.length})</label>
                {!locked && <TipButton cls={styles.arrayAddBtn} tip="Add a new item" onClick={addItem}>+ Add</TipButton>}
              </div>
              {arr.map((item: unknown, idx: number) => (
                <div key={idx} className={styles.arrayItem}>
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
                      {Object.entries(item as Record<string, unknown>).map(([subKey, subVal]) => (
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
                      ))}
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
              ))}
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

export default function BlockEditPanel({ block, blockIndex, onUpdate, onClose, headerAction }: Props) {
  const [localProps, setLocalProps] = useState<Record<string, unknown>>(block.props as Record<string, unknown>)
  const [jsonOpen, setJsonOpen] = useState(false)

  function handleFieldChange(key: string, value: unknown) {
    const next = { ...localProps, [key]: value }
    setLocalProps(next)
    onUpdate(blockIndex, { ...block, props: next })
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
        <PropsEditor blockType={block.type} props={localProps} onChange={handleFieldChange} />

        {/* AI rewrite — disabled for now */}
        <div className={styles.aiSection}>
          <div className={styles.aiDisabled}>
            <span className={styles.aiIcon}>✦</span>
            <span>AI rewrite</span>
            <span className={styles.aiBadge}>Pro</span>
          </div>
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
