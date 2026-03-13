import { useState } from 'react'
import type { OutlineBlock, BlockType, LessonOutline } from '@/types/outline'
import styles from './OutlineEditor.module.css'

const BLOCK_ICONS: Record<BlockType, string> = {
  hero: '◆',
  narrative: '¶',
  'step-navigator': '→',
  quiz: '?',
  flashcard: '⟳',
  'fill-in-the-blank': '⎵',
}

const BLOCK_LABELS: Record<BlockType, string> = {
  hero: 'Hero',
  narrative: 'Narrative',
  'step-navigator': 'Step Walkthrough',
  quiz: 'Quiz',
  flashcard: 'Flashcards',
  'fill-in-the-blank': 'Fill in the Blank',
}

interface Props {
  outline: LessonOutline
  onUpdateBlocks: (blocks: OutlineBlock[]) => void
  onGenerate: () => void
  status: 'idle' | 'loading' | 'error'
  error: string
}

export default function OutlineEditor({ outline, onUpdateBlocks, onGenerate, status, error }: Props) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [addingBlock, setAddingBlock] = useState(false)
  const blocks = outline.blocks

  function moveBlock(from: number, to: number) {
    if (from === to) return
    const next = [...blocks]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onUpdateBlocks(next)
  }

  function removeBlock(idx: number) {
    onUpdateBlocks(blocks.filter((_, i) => i !== idx))
  }

  function updateBlock(idx: number, patch: Partial<OutlineBlock>) {
    onUpdateBlocks(blocks.map((b, i) => i === idx ? { ...b, ...patch } : b))
  }

  function addBlock(type: BlockType) {
    const id = `block-${Date.now().toString(36)}`
    onUpdateBlocks([...blocks, { id, type, summary: '' }])
    setAddingBlock(false)
  }

  return (
    <div className={styles.editor}>
      <h2 className={styles.heading}>Review your lesson outline</h2>
      <p className={styles.sub}>
        Drag to reorder, edit summaries, or add/remove blocks. When you're happy, generate the full lesson.
      </p>

      <div className={styles.list}>
        {blocks.map((block, idx) => (
          <div
            key={block.id}
            className={`${styles.card} ${dragIdx === idx ? styles.dragging : ''}`}
            draggable
            onDragStart={() => setDragIdx(idx)}
            onDragOver={e => { e.preventDefault() }}
            onDrop={() => { if (dragIdx !== null) moveBlock(dragIdx, idx); setDragIdx(null) }}
            onDragEnd={() => setDragIdx(null)}
          >
            <div className={styles.cardHandle}>⠿</div>
            <div className={styles.cardContent}>
              <div className={styles.cardHeader}>
                <span className={styles.cardType}>
                  <span className={styles.cardIcon}>{BLOCK_ICONS[block.type]}</span>
                  {BLOCK_LABELS[block.type]}
                </span>
                {block.type !== 'hero' && (
                  <button className={styles.removeBtn} onClick={() => removeBlock(idx)}>×</button>
                )}
              </div>
              <textarea
                className={styles.summaryInput}
                value={block.summary}
                onChange={e => updateBlock(idx, { summary: e.target.value })}
                placeholder="Describe what this block should cover..."
                rows={2}
              />
              {(block.type === 'quiz' || block.type === 'flashcard' || block.type === 'step-navigator') && (
                <label className={styles.countLabel}>
                  Items:
                  <input
                    type="number"
                    className={styles.countInput}
                    value={block.itemCount ?? ''}
                    onChange={e => updateBlock(idx, { itemCount: parseInt(e.target.value) || undefined })}
                    min={1}
                    max={20}
                    placeholder="auto"
                  />
                </label>
              )}
            </div>
          </div>
        ))}
      </div>

      {addingBlock ? (
        <div className={styles.addPanel}>
          <span className={styles.addLabel}>Add block:</span>
          {(Object.keys(BLOCK_LABELS) as BlockType[])
            .filter(t => t !== 'hero')
            .map(type => (
              <button key={type} className={styles.addTypeBtn} onClick={() => addBlock(type)}>
                {BLOCK_ICONS[type]} {BLOCK_LABELS[type]}
              </button>
            ))}
          <button className={styles.cancelBtn} onClick={() => setAddingBlock(false)}>Cancel</button>
        </div>
      ) : (
        <button className={styles.addBtn} onClick={() => setAddingBlock(true)}>
          + Add block
        </button>
      )}

      {error && <p className={styles.error}>{error}</p>}

      <button
        className={styles.generate}
        onClick={onGenerate}
        disabled={status === 'loading' || blocks.length < 2}
      >
        {status === 'loading' ? 'Generating…' : 'Generate full lesson →'}
      </button>
    </div>
  )
}
