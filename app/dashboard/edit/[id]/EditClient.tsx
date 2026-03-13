'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import '@primr/components/dist/style.css'
import {
  HeroCard, NarrativeBlock, StepNavigator, Quiz, FlipCardDeck, FillInTheBlank,
} from '@primr/components'
import type { LessonManifest, BlockConfig } from '@/types/outline'
import type { BlockType } from '@/types/outline'
import BlockEditPanel from '../../new/components/BlockEditPanel'
import styles from '../../new/page.module.css'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BLOCK_COMPONENTS: Record<string, React.ComponentType<any>> = {
  hero: HeroCard,
  narrative: NarrativeBlock,
  'step-navigator': StepNavigator,
  quiz: Quiz,
  flashcard: FlipCardDeck,
  'fill-in-the-blank': FillInTheBlank,
}

const INSERTABLE_TYPES: { type: BlockType; label: string; icon: string }[] = [
  { type: 'narrative', label: 'Narrative', icon: '¶' },
  { type: 'step-navigator', label: 'Step Walkthrough', icon: '→' },
  { type: 'quiz', label: 'Quiz', icon: '?' },
  { type: 'flashcard', label: 'Flashcards', icon: '⟳' },
  { type: 'fill-in-the-blank', label: 'Fill in the Blank', icon: '⎵' },
]

const EMPTY_PROPS: Record<BlockType, Record<string, unknown>> = {
  hero: { title: '', tagline: '' },
  narrative: { body: '', title: '', eyebrow: '' },
  'step-navigator': { steps: [{ title: '', body: '' }], badge: '', title: '' },
  quiz: { questions: [{ prompt: '', options: ['', '', '', ''], correctIndex: 0 }], badge: '', title: '' },
  flashcard: { cards: [{ front: '', back: '' }], badge: '', title: '' },
  'fill-in-the-blank': { prompt: '', answers: [''], badge: '', title: '' },
}

export default function EditClient({ lessonId, manifest: initial }: { lessonId: string; manifest: LessonManifest }) {
  const [manifest, setManifest] = useState(initial)
  const [editingBlock, setEditingBlock] = useState<number | null>(null)
  const [insertAfter, setInsertAfter] = useState<number | null>(null)
  const [disabledIds, setDisabledIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [inviteEmails, setInviteEmails] = useState('')
  const [invitedList, setInvitedList] = useState<{ id: string; email: string }[]>([])
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [inviting, setInviting] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  function toggleBlock(id: string) {
    setDisabledIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setSaved(false)
  }

  function handleBlockUpdate(index: number, block: BlockConfig) {
    const blocks = [...manifest.blocks]
    blocks[index] = block
    setManifest({ ...manifest, blocks })
    setSaved(false)
  }

  function insertBlock(afterIdx: number, type: BlockType) {
    const id = `block-${Date.now().toString(36)}`
    const newBlock: BlockConfig = { id, type, props: { ...EMPTY_PROPS[type] } }
    const blocks = [...manifest.blocks]
    blocks.splice(afterIdx + 1, 0, newBlock)
    setManifest({ ...manifest, blocks })
    setInsertAfter(null)
    setEditingBlock(afterIdx + 1)
    setSaved(false)
  }

  async function saveLesson() {
    setSaving(true)
    const filtered = { ...manifest, blocks: manifest.blocks.filter(b => !disabledIds.has(b.id)) }
    const res = await fetch(`/api/lessons/${lessonId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manifest: filtered }),
    })
    setSaving(false)
    if (res.ok) setSaved(true)
  }

  const loadInvitations = useCallback(async () => {
    const res = await fetch(`/api/lessons/${lessonId}/invite`)
    if (res.ok) {
      const data = await res.json()
      setInvitedList(data.invitations)
    }
  }, [lessonId])

  useEffect(() => { loadInvitations() }, [loadInvitations])

  async function sendInvites() {
    const emails = inviteEmails.split(',').map(e => e.trim()).filter(Boolean)
    if (emails.length === 0) return
    setInviting(true)
    await fetch(`/api/lessons/${lessonId}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails }),
    })
    setInviteEmails('')
    setInviting(false)
    loadInvitations()
  }

  async function removeInvite(email: string) {
    await fetch(`/api/lessons/${lessonId}/invite`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    loadInvitations()
  }

  async function copyInviteLink() {
    let token = inviteLink
    if (!token) {
      const res = await fetch(`/api/lessons/${lessonId}/invite-link`, { method: 'POST' })
      if (!res.ok) return
      const data = await res.json()
      token = data.token
      setInviteLink(token)
    }
    await navigator.clipboard.writeText(`${window.location.origin}/api/invite/${token}`)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  return (
    <main className={styles.main}>
      <nav className={styles.nav}>
        <Link href="/" className={styles.wordmark}>Primr</Link>
      </nav>

      <div className={styles.content}>
        <div className={styles.preview}>
          <div className={styles.previewActions}>
            <button className={styles.saveBtn} onClick={saveLesson} disabled={saving}>
              {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save lesson'}
            </button>
            <Link href={`/dashboard/preview/${lessonId}`} className={styles.viewLink}>
              Preview →
            </Link>
            <Link href={`/learn/${lessonId}`} className={styles.viewLink}>
              Take lesson →
            </Link>
          </div>
          <div className={styles.shareSection}>
            <h3 className={styles.shareHeading}>Share</h3>
            <div className={styles.shareRow}>
              <input
                className={styles.shareInput}
                placeholder="email1@example.com, email2@example.com"
                value={inviteEmails}
                onChange={e => setInviteEmails(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendInvites()}
              />
              <button className={styles.shareBtn} onClick={sendInvites} disabled={inviting}>
                {inviting ? 'Inviting...' : 'Invite'}
              </button>
            </div>
            {invitedList.length > 0 && (
              <ul className={styles.invitedList}>
                {invitedList.map(inv => (
                  <li key={inv.id} className={styles.invitedItem}>
                    <span>{inv.email}</span>
                    <button className={styles.removeBtn} onClick={() => removeInvite(inv.email)}>Remove</button>
                  </li>
                ))}
              </ul>
            )}
            <button className={styles.linkBtn} onClick={copyInviteLink}>
              {linkCopied ? 'Copied!' : 'Copy invite link'}
            </button>
          </div>
          <p className={styles.editHint}>Click any block to edit it.</p>
          <div className={styles.blockStack}>
            {manifest.blocks.map((block, idx) => {
              const Component = BLOCK_COMPONENTS[block.type]
              if (!Component) return null
              const isDisabled = disabledIds.has(block.id)
              return (
                <div key={block.id}>
                  <div
                    className={`${styles.blockCard} ${editingBlock === idx ? styles.blockActive : ''} ${isDisabled ? styles.blockDisabled : ''}`}
                    onClick={() => { if (!isDisabled) { setEditingBlock(idx); setInsertAfter(null) } }}
                  >
                    <div className={styles.blockLabel}>
                      <span>{idx + 1}. {block.type}{isDisabled ? ' (disabled)' : ''}</span>
                      {block.type !== 'hero' && (
                        <button
                          className={styles.toggleBtn}
                          onClick={e => { e.stopPropagation(); toggleBlock(block.id) }}
                        >
                          {isDisabled ? 'Enable' : 'Disable'}
                        </button>
                      )}
                    </div>
                    {!isDisabled && (
                      <div className={styles.blockPreview}>
                        <Component {...(block.props as Record<string, unknown>)} onComplete={() => {}} />
                      </div>
                    )}
                  </div>

                  {/* Insert button between blocks (not before hero) */}
                  <div className={styles.insertRow}>
                    {insertAfter === idx ? (
                      <div className={styles.insertPicker}>
                        {INSERTABLE_TYPES.map(t => (
                          <button
                            key={t.type}
                            className={styles.insertTypeBtn}
                            onClick={() => insertBlock(idx, t.type)}
                          >
                            {t.icon} {t.label}
                          </button>
                        ))}
                        <button className={styles.insertCancel} onClick={() => setInsertAfter(null)}>Cancel</button>
                      </div>
                    ) : (
                      <button
                        className={styles.insertBtn}
                        onClick={() => { setInsertAfter(idx); setEditingBlock(null) }}
                      >
                        + Insert block
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {editingBlock !== null && (
        <BlockEditPanel
          key={editingBlock}
          block={manifest.blocks[editingBlock]}
          blockIndex={editingBlock}
          lessonTitle={manifest.title}
          onUpdate={handleBlockUpdate}
          onClose={() => setEditingBlock(null)}
        />
      )}
    </main>
  )
}
