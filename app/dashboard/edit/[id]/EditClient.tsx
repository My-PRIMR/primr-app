'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import Link from 'next/link'
import '@primr/components/dist/style.css'
import {
  HeroCard, NarrativeBlock, StepNavigator, Quiz, FlipCardDeck, FillInTheBlank, MediaBlock,
} from '@primr/components'
import type { LessonManifest, BlockConfig, BlockType } from '@/types/outline'
import BlockEditPanel from '../../new/components/BlockEditPanel'
import styles from './EditClient.module.css'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BLOCK_COMPONENTS: Record<string, React.ComponentType<any>> = {
  hero: HeroCard,
  narrative: NarrativeBlock,
  'step-navigator': StepNavigator,
  quiz: Quiz,
  flashcard: FlipCardDeck,
  'fill-in-the-blank': FillInTheBlank,
  media: MediaBlock,
}

const INSERTABLE_TYPES: { type: BlockType; label: string; icon: string }[] = [
  { type: 'narrative', label: 'Narrative', icon: '¶' },
  { type: 'step-navigator', label: 'Step Walkthrough', icon: '→' },
  { type: 'quiz', label: 'Quiz', icon: '?' },
  { type: 'flashcard', label: 'Flashcards', icon: '⟳' },
  { type: 'fill-in-the-blank', label: 'Fill in the Blank', icon: '⎵' },
  { type: 'media', label: 'Video', icon: '▶' },
]

const EMPTY_PROPS: Record<BlockType, Record<string, unknown>> = {
  hero: { title: '', tagline: '' },
  narrative: { body: '', title: '', eyebrow: '' },
  'step-navigator': { steps: [{ title: '', body: '' }], badge: '', title: '' },
  quiz: { questions: [{ prompt: '', options: ['', '', '', ''], correctIndex: 0 }], badge: '', title: '' },
  flashcard: { cards: [{ front: '', back: '' }], badge: '', title: '' },
  'fill-in-the-blank': { prompt: '', answers: [''], badge: '', title: '' },
  media: { url: '', title: '', badge: 'Video', caption: '', requireWatch: true },
}

const BLOCK_LABEL: Record<string, string> = {
  hero: 'Hero', narrative: 'Narrative', 'step-navigator': 'Steps',
  quiz: 'Quiz', flashcard: 'Cards', 'fill-in-the-blank': 'Fill', media: 'Video',
}

function getBlockTitle(block: BlockConfig, index: number): string {
  const props = block.props as Record<string, unknown>
  const title = (props.title as string | undefined)?.trim()
  if (title) return title
  return `${index + 1}. ${BLOCK_LABEL[block.type] ?? block.type}`
}

export default function EditClient({ lessonId, manifest: initial }: { lessonId: string; manifest: LessonManifest }) {
  const [manifest, setManifest] = useState(initial)
  const [currentBlock, setCurrentBlock] = useState(0)
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelAnchored, setPanelAnchored] = useState(false)
  const [disabledIds, setDisabledIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [inviteEmails, setInviteEmails] = useState('')
  const [invitedList, setInvitedList] = useState<{ id: string; email: string }[]>([])
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [inviting, setInviting] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  const dotsRef = useRef<HTMLDivElement>(null)

  const blocks = manifest.blocks
  const block = blocks[currentBlock]
  const isDisabled = block ? disabledIds.has(block.id) : false
  const useDotPaginator = blocks.length <= 10

  // Scroll active dot into view (vertical)
  useEffect(() => {
    if (!useDotPaginator) return
    const container = dotsRef.current
    if (!container) return
    const dot = container.children[currentBlock] as HTMLElement | undefined
    dot?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [currentBlock, useDotPaginator])

  const blockTitles = useMemo(() => blocks.map(getBlockTitle), [blocks])

  function goTo(idx: number) {
    setCurrentBlock(Math.max(0, Math.min(blocks.length - 1, idx)))
  }

  function toggleBlock(id: string) {
    setDisabledIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setSaved(false)
  }

  function handleBlockUpdate(index: number, updated: BlockConfig) {
    const next = [...blocks]
    next[index] = updated
    setManifest({ ...manifest, blocks: next })
    setSaved(false)
  }

  function insertBlock(type: BlockType) {
    const id = `block-${Date.now().toString(36)}`
    const newBlock: BlockConfig = { id, type, props: { ...EMPTY_PROPS[type] } }
    const next = [...blocks]
    next.splice(currentBlock + 1, 0, newBlock)
    setManifest({ ...manifest, blocks: next })
    setCurrentBlock(currentBlock + 1)
    setPanelOpen(true)
    setSaved(false)
  }

  async function saveLesson() {
    setSaving(true)
    const filtered = { ...manifest, blocks: blocks.filter(b => !disabledIds.has(b.id)) }
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

  const Component = block ? BLOCK_COMPONENTS[block.type] : null

  const dockToggle = (
    <button
      className={`${styles.panelDockBtn} ${panelAnchored ? styles.panelDockBtnActive : ''}`}
      onClick={() => setPanelAnchored(v => !v)}
      title={panelAnchored ? 'Switch to floating panel' : 'Anchor panel to right'}
    >
      {panelAnchored ? '⊟ Docked' : '⊞ Dock'}
    </button>
  )

  const editPanel = block ? (
    <BlockEditPanel
      key={currentBlock}
      block={block}
      blockIndex={currentBlock}
      lessonTitle={manifest.title}
      onUpdate={handleBlockUpdate}
      onClose={() => setPanelOpen(false)}
      headerAction={dockToggle}
    />
  ) : null

  const sharePanel = (
    <div className={styles.shareSection}>
      <p className={styles.shareHeading}>Share lesson</p>
      <div className={styles.shareRow}>
        <input
          className={styles.shareInput}
          placeholder="email1@example.com, email2@example.com"
          value={inviteEmails}
          onChange={e => setInviteEmails(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendInvites()}
        />
        <button className={styles.shareBtn} onClick={sendInvites} disabled={inviting}>
          {inviting ? '…' : 'Invite'}
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
  )

  return (
    <div className={styles.root}>
      {/* ── Nav ── */}
      <nav className={styles.nav}>
        <Link href="/" className={styles.wordmark}>Primr</Link>
        <div className={styles.navSep} />
        <button
          className={`${styles.navBtn} ${styles.navBtnPrimary}`}
          onClick={saveLesson}
          disabled={saving}
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
        </button>
        <div className={styles.navRight}>
          <Link href={`/dashboard/preview/${lessonId}`} className={styles.navLink}>Preview →</Link>
          <Link href={`/learn/${lessonId}`} className={styles.navLink}>Take lesson →</Link>
        </div>
      </nav>

      {/* ── Body ── */}
      <div className={styles.body}>
        {/* Block view */}
        <div className={styles.blockView}>
          <div className={styles.blockContent}>
            {block && (
              <>
                {/* Block toolbar */}
                <div className={styles.blockToolbar}>
                  <span className={styles.blockTypeLabel}>
                    {BLOCK_LABEL[block.type] ?? block.type}
                  </span>
                  <button
                    className={`${styles.editToggleBtn} ${panelOpen ? styles.editToggleBtnActive : ''}`}
                    onClick={() => setPanelOpen(v => !v)}
                  >
                    {panelOpen ? 'Close editor' : 'Edit block'}
                  </button>
                  {block.type !== 'hero' && (
                    <button className={styles.disableBtn} onClick={() => toggleBlock(block.id)}>
                      {isDisabled ? 'Enable' : 'Disable'}
                    </button>
                  )}
                </div>

                {/* Block render */}
                <div className={`${styles.blockWrap} ${isDisabled ? styles.blockWrapDisabled : ''}`}>
                  {Component && !isDisabled && (
                    <Component {...(block.props as Record<string, unknown>)} onComplete={() => {}} />
                  )}
                  {isDisabled && (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--ink-muted)', fontSize: 14 }}>
                      Block disabled — will not appear in published lesson
                    </div>
                  )}
                </div>

                {/* Insert after current */}
                <div className={styles.insertBar}>
                  <span className={styles.insertLabel}>Insert after</span>
                  {INSERTABLE_TYPES.map(t => (
                    <button key={t.type} className={styles.insertChip} onClick={() => insertBlock(t.type)}>
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Anchored edit panel */}
        {panelAnchored && panelOpen && (
          <div className={styles.anchoredPanel}>
            {editPanel}
            {sharePanel}
          </div>
        )}
      </div>

      {/* Floating edit panel */}
      {!panelAnchored && panelOpen && (
        <div className={styles.floatingPanelBackdrop}>
          <div className={styles.floatingPanel}>
            {editPanel}
            {sharePanel}
          </div>
        </div>
      )}

      {/* ── Paginator (left side, vertically centered) ── */}
      <div className={styles.paginator}>
        <button
          className={styles.pageArrow}
          onClick={() => goTo(currentBlock - 1)}
          disabled={currentBlock === 0}
          aria-label="Previous block"
        >
          ←
        </button>

        {useDotPaginator ? (
          <div className={styles.pageDots} ref={dotsRef}>
            {blocks.map((b, i) => (
              <button
                key={b.id}
                className={`${styles.pageDot} ${i === currentBlock ? styles.pageDotActive : ''}`}
                onClick={() => goTo(i)}
                title={blockTitles[i]}
                aria-label={blockTitles[i]}
              />
            ))}
          </div>
        ) : (
          <select
            className={styles.pageSelect}
            value={currentBlock}
            onChange={e => goTo(Number(e.target.value))}
            aria-label="Go to block"
          >
            {blocks.map((b, i) => (
              <option key={b.id} value={i}>{i + 1}. {blockTitles[i]}</option>
            ))}
          </select>
        )}

        <button
          className={styles.pageArrow}
          onClick={() => goTo(currentBlock + 1)}
          disabled={currentBlock === blocks.length - 1}
          aria-label="Next block"
        >
          →
        </button>

        <span className={styles.pageCounter}>{currentBlock + 1}/{blocks.length}</span>
      </div>
    </div>
  )
}
