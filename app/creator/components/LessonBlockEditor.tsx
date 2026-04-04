'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import '@primr/components/dist/style.css'
import {
  HeroCard, NarrativeBlock, StepNavigator, Quiz, FlipCardDeck, FillInTheBlank, MediaBlock,
  HotspotImage, DecisionTree, SortRank, CodeRunner, EquationRenderer, GraphPlotter,
  ReactionBalancer, AnatomyLabeler, CircuitBuilder, ChartBuilder, ClickableMap,
  SqlSandbox, AudioPronunciation, FinancialCalculator, StatuteAnnotator, PhysicsSimulator,
  Exam,
} from '@primr/components'
import type { LessonManifest, BlockConfig } from '@/types/outline'
import BlockEditPanel from '../new/components/BlockEditPanel'
import BlockPickerModal from './BlockPickerModal'
import { PAGE_ARRAY_KEY } from '../lib/pageArrayKey'
import styles from './LessonBlockEditor.module.css'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BLOCK_COMPONENTS: Record<string, React.ComponentType<any>> = {
  // Core
  'hero':                 HeroCard,
  'narrative':            NarrativeBlock,
  'step-navigator':       StepNavigator,
  'quiz':                 Quiz,
  'flashcard':            FlipCardDeck,
  'fill-in-the-blank':    FillInTheBlank,
  'media':                MediaBlock,
  // Phase 1
  'hotspot-image':        HotspotImage,
  'decision-tree':        DecisionTree,
  'sort-rank':            SortRank,
  'code-runner':          CodeRunner,
  'equation-renderer':    EquationRenderer,
  'graph-plotter':        GraphPlotter,
  // Phase 2
  'reaction-balancer':    ReactionBalancer,
  'anatomy-labeler':      AnatomyLabeler,
  'circuit-builder':      CircuitBuilder,
  'chart-builder':        ChartBuilder,
  'clickable-map':        ClickableMap,
  // Phase 3
  'sql-sandbox':          SqlSandbox,
  'audio-pronunciation':  AudioPronunciation,
  'financial-calculator': FinancialCalculator,
  'statute-annotator':    StatuteAnnotator,
  'physics-simulator':    PhysicsSimulator,
  'exam':                 Exam,
}

export const EMPTY_PROPS: Record<string, Record<string, unknown>> = {
  // Core
  hero:                { title: '', tagline: '' },
  narrative:           { body: '', title: '', eyebrow: '' },
  'step-navigator':    { steps: [{ title: '', body: '' }], badge: '', title: '' },
  quiz:                { questions: [{ prompt: '', options: ['', '', '', ''], correctIndex: 0 }], badge: '', title: '' },
  flashcard:           { cards: [{ front: '', back: '' }], badge: '', title: '' },
  'fill-in-the-blank': { prompt: '', answers: [''], badge: '', title: '' },
  media:               { url: '', title: '', badge: 'Video', caption: '' },
  exam:                { questions: [{ prompt: '', options: ['', '', '', ''], correctIndex: 0 }], badge: '', title: '' },
  // Phase 1
  'hotspot-image':     { imageUrl: '', hotspots: [] },
  'decision-tree':     { nodes: [{ id: 'root', prompt: '', choices: [] }], rootId: 'root' },
  'sort-rank':         { items: [{ id: '1', label: '', correctPosition: 0 }] },
  'code-runner':       { language: 'javascript', starterCode: '', instructions: '' },
  'equation-renderer': { equations: [{ latex: '' }] },
  'graph-plotter':     { functions: [] },
  // Phase 2
  'reaction-balancer': { reactants: [{ id: '1', formula: '' }], products: [{ id: '2', formula: '' }] },
  'anatomy-labeler':   { imageUrl: '', regions: [{ id: '1', label: '', x: 0, y: 0 }] },
  'circuit-builder':   { availableComponents: [] },
  'chart-builder':     { data: [{ label: '', value: 0 }] },
  'clickable-map':     { regions: [{ id: '1', label: '', x: 0, y: 0 }] },
  // Phase 3
  'sql-sandbox':           { tables: [] },
  'audio-pronunciation':   { words: [{ word: '' }] },
  'financial-calculator':  {},
  'statute-annotator':     { text: '' },
  'physics-simulator':     {},
}

const BLOCK_LABEL: Record<string, string> = {
  hero: 'Hero', narrative: 'Narrative', 'step-navigator': 'Steps',
  quiz: 'Quiz', flashcard: 'Cards', 'fill-in-the-blank': 'Fill', media: 'Video', exam: 'Exam',
}

function getBlockTitle(block: BlockConfig, index: number): string {
  const props = block.props as Record<string, unknown>
  const title = (props.title as string | undefined)?.trim()
  if (title) return title
  return `${index + 1}. ${BLOCK_LABEL[block.type] ?? block.type}`
}

interface LessonBlockEditorProps {
  lessonId: string
  initialManifest: LessonManifest
  /** ISO string if lesson is published, null/undefined if draft. */
  initialPublishedAt?: string | null
  /**
   * 'float' (default) — panel appears as a floating overlay with a dock/undock toggle.
   * 'dock'            — panel is always a fixed right column.
   */
  panelMode?: 'float' | 'dock'
  /** Extra content rendered below the BlockEditPanel (e.g. share section). */
  rightPanelExtra?: React.ReactNode
  /** Left px offset for the fixed paginator bar (use sidebar width when a sidebar is present). */
  paginatorLeft?: number
  /** Whether the current user can use Pexels image search. */
  canPexels?: boolean
  /** Whether the current user can use AI rewrite/conversion features. */
  canAiEdit?: boolean
}

export default function LessonBlockEditor({
  lessonId,
  initialManifest,
  initialPublishedAt = null,
  panelMode = 'float',
  rightPanelExtra,
  paginatorLeft = 0,
  canPexels = false,
  canAiEdit = false,
}: LessonBlockEditorProps) {
  const [manifest, setManifest] = useState(initialManifest)
  const [currentBlock, setCurrentBlock] = useState(0)
  const [panelOpen, setPanelOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [panelAnchored, setPanelAnchored] = useState(false)
  const [disabledIds, setDisabledIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [publishedAt, setPublishedAt] = useState<string | null>(initialPublishedAt)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState('')
  const [activePage, setActivePage] = useState(0)
  const dotsRef = useRef<HTMLDivElement>(null)

  const blocks = manifest.blocks
  const block = blocks[currentBlock]
  const isDisabled = block ? disabledIds.has(block.id) : false
  const useDotPaginator = blocks.length <= 10

  const blockTitles = useMemo(() => blocks.map(getBlockTitle), [blocks])

  useEffect(() => {
    if (!useDotPaginator) return
    const dot = dotsRef.current?.children[currentBlock] as HTMLElement | undefined
    dot?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [currentBlock, useDotPaginator])

  useEffect(() => { setActivePage(0) }, [block?.id])

  function goTo(idx: number) {
    setCurrentBlock(Math.max(0, Math.min(blocks.length - 1, idx)))
  }

  function toggleBlock(id: string) {
    setDisabledIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
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

  function handleInlinePropsChange(blockIndex: number, partial: Record<string, unknown>) {
    const b = blocks[blockIndex]
    handleBlockUpdate(blockIndex, { ...b, props: { ...(b.props as object), ...partial } })
  }

  function insertBlock(type: BlockConfig['type']) {
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

  async function publishLesson() {
    setPublishing(true)
    setPublishError('')
    // Save current edits first, then publish
    await saveLesson()
    const res = await fetch(`/api/lessons/${lessonId}/publish`, { method: 'POST' })
    const data = await res.json()
    setPublishing(false)
    if (!res.ok) {
      setPublishError(data.error ?? 'Failed to publish lesson.')
      return
    }
    setPublishedAt(data.publishedAt)
    // Reload manifest so any local image URLs are replaced with Cloudinary URLs
    const lessonRes = await fetch(`/api/lessons/${lessonId}`)
    if (lessonRes.ok) {
      const { manifest: updated } = await lessonRes.json()
      setManifest(updated)
    }
  }

  async function unpublishLesson() {
    setPublishing(true)
    setPublishError('')
    const res = await fetch(`/api/lessons/${lessonId}/publish`, { method: 'DELETE' })
    setPublishing(false)
    if (res.ok) setPublishedAt(null)
    else setPublishError('Failed to unpublish lesson.')
  }

  const Component = block ? BLOCK_COMPONENTS[block.type] : null

  const pageProps = block && PAGE_ARRAY_KEY[block.type]
    ? { activePage, onPageChange: setActivePage }
    : {}

  const dockToggle = panelMode === 'float' ? (
    <button
      className={`${styles.panelDockBtn} ${panelAnchored ? styles.panelDockBtnActive : ''}`}
      onClick={() => setPanelAnchored(v => !v)}
      title={panelAnchored ? 'Switch to floating panel' : 'Anchor panel to right'}
    >
      {panelAnchored ? '⊟ Docked' : '⊞ Dock'}
    </button>
  ) : null

  const editPanel = block ? (
    <BlockEditPanel
      key={currentBlock}
      block={block}
      blockIndex={currentBlock}
      lessonTitle={manifest.title}
      activePage={activePage}
      onPageChange={setActivePage}
      onUpdate={handleBlockUpdate}
      onClose={() => setPanelOpen(false)}
      headerAction={dockToggle}
      canPexels={canPexels}
      canAiEdit={canAiEdit}
    />
  ) : null

  const panelContent = (
    <>
      {editPanel}
      {rightPanelExtra}
    </>
  )

  const isDocked = panelMode === 'dock' || (panelMode === 'float' && panelAnchored)

  return (
    <>
      {/* ── Flex content: block area + optional docked panel ── */}
      <div className={styles.editorWrap}>
        <div className={styles.blockArea}>
          <div className={styles.blockContent}>
            {/* Lesson title */}
            <input
              className={styles.lessonTitleInput}
              value={manifest.title}
              onChange={e => { setManifest({ ...manifest, title: e.target.value }); setSaved(false) }}
              placeholder="Lesson title"
              aria-label="Lesson title"
            />
          </div>
          {block && (
            <div className={styles.blockContent}>
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
                <button
                  className={`${styles.saveBtn} ${saved ? styles.saveBtnSaved : ''}`}
                  onClick={saveLesson}
                  disabled={saving || publishing}
                >
                  {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
                </button>
                {publishedAt ? (
                  <button
                    className={styles.unpublishBtn}
                    onClick={unpublishLesson}
                    disabled={publishing}
                    title="Revert to draft — learners will no longer be able to access this lesson"
                  >
                    {publishing ? '…' : 'Unpublish'}
                  </button>
                ) : (
                  <button
                    className={styles.publishBtn}
                    onClick={publishLesson}
                    disabled={publishing}
                    title="Save and publish — learners with access can view this lesson"
                  >
                    {publishing ? 'Publishing…' : 'Publish'}
                  </button>
                )}
                {publishError && <span className={styles.publishError}>{publishError}</span>}
              </div>

              {/* Block render */}
              <div className={`${styles.blockWrap} ${isDisabled ? styles.blockWrapDisabled : ''}`}>
                {Component && !isDisabled && (
                  <Component
                    key={block.id}
                    {...(block.props as Record<string, unknown>)}
                    {...pageProps}
                    isEditor={true}
                    onComplete={() => {}}
                    onPropsChange={(partial: Record<string, unknown>) => handleInlinePropsChange(currentBlock, partial)}
                  />
                )}
                {isDisabled && (
                  <div className={styles.disabledPlaceholder}>
                    Block disabled — will not appear in the published lesson
                  </div>
                )}
              </div>

              {/* Insert after current */}
              <div className={styles.insertBar}>
                <button className={styles.addBlockBtn} onClick={() => setPickerOpen(true)}>
                  Add block →
                </button>
                <BlockPickerModal
                  open={pickerOpen}
                  onClose={() => setPickerOpen(false)}
                  onSelect={(type) => {
                    insertBlock(type)
                  }}
                  mode="insert"
                />
              </div>
            </div>
          )}
        </div>

        {/* Docked right panel */}
        {panelOpen && isDocked && (
          <div className={styles.dockedPanel}>
            {panelContent}
          </div>
        )}
      </div>

      {/* Floating panel overlay (float mode, not anchored) */}
      {panelOpen && panelMode === 'float' && !panelAnchored && (
        <div className={styles.floatingOverlay}>
          <div className={styles.floatingPanel}>
            {panelContent}
          </div>
        </div>
      )}

      {/* Fixed bottom paginator */}
      <div className={styles.paginator} style={{ left: paginatorLeft }}>
        <button
          className={styles.pageArrow}
          onClick={() => goTo(currentBlock - 1)}
          disabled={currentBlock === 0}
          aria-label="Previous block"
        >←</button>

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
        >→</button>

        <span className={styles.pageCounter}>{currentBlock + 1}/{blocks.length}</span>
      </div>
    </>
  )
}
