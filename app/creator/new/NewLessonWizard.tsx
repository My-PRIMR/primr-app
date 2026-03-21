'use client'

import { useReducer, useState } from 'react'
import Link from 'next/link'
import VideoIngestForm from './components/VideoIngestForm'
import '@primr/components/dist/style.css'
import {
  HeroCard, NarrativeBlock, StepNavigator, Quiz, FlipCardDeck, FillInTheBlank, MediaBlock,
  HotspotImage, DecisionTree, SortRank, CodeRunner, EquationRenderer, GraphPlotter,
  ReactionBalancer, AnatomyLabeler, CircuitBuilder, ChartBuilder, ClickableMap,
  SqlSandbox, AudioPronunciation, FinancialCalculator, StatuteAnnotator, PhysicsSimulator,
} from '@primr/components'
import type { WizardState, WizardAction, LessonOutline, BlockConfig } from '@/types/outline'
import { DEFAULT_MODEL } from '@/lib/models'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BLOCK_COMPONENTS: Record<string, React.ComponentType<any>> = {
  hero: HeroCard,
  narrative: NarrativeBlock,
  'step-navigator': StepNavigator,
  quiz: Quiz,
  flashcard: FlipCardDeck,
  'fill-in-the-blank': FillInTheBlank,
  media: MediaBlock,
  // Phase 1
  'hotspot-image': HotspotImage,
  'decision-tree': DecisionTree,
  'sort-rank': SortRank,
  'code-runner': CodeRunner,
  'equation-renderer': EquationRenderer,
  'graph-plotter': GraphPlotter,
  // Phase 2
  'reaction-balancer': ReactionBalancer,
  'anatomy-labeler': AnatomyLabeler,
  'circuit-builder': CircuitBuilder,
  'chart-builder': ChartBuilder,
  'clickable-map': ClickableMap,
  // Phase 3
  'sql-sandbox': SqlSandbox,
  'audio-pronunciation': AudioPronunciation,
  'financial-calculator': FinancialCalculator,
  'statute-annotator': StatuteAnnotator,
  'physics-simulator': PhysicsSimulator,
}
import StepIndicator from './components/StepIndicator'
import Step1Form from './components/Step1Form'
import OutlineEditor from './components/OutlineEditor'
import BlockEditPanel from './components/BlockEditPanel'
import styles from './page.module.css'

const initialState: WizardState = {
  step: 1,
  title: '',
  topic: '',
  audience: '',
  level: 'beginner',
  scope: '',
  documentText: '',
  documentName: '',
  outline: null,
  lessonId: null,
  manifest: null,
  status: 'idle',
  error: '',
}

function reducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value }
    case 'SET_STEP':
      return { ...state, step: action.step, status: 'idle', error: '' }
    case 'SET_OUTLINE':
      return { ...state, outline: action.outline, step: 3, status: 'idle', error: '' }
    case 'UPDATE_OUTLINE_BLOCKS':
      if (!state.outline) return state
      return { ...state, outline: { ...state.outline, blocks: action.blocks } }
    case 'SET_MANIFEST':
      return { ...state, manifest: action.manifest, lessonId: action.lessonId, step: 5, status: 'idle', error: '' }
    case 'UPDATE_BLOCK':
      if (!state.manifest) return state
      const blocks = [...state.manifest.blocks]
      blocks[action.index] = action.block
      return { ...state, manifest: { ...state.manifest, blocks } }
    case 'SET_STATUS':
      return { ...state, status: action.status, error: action.error || '' }
    default:
      return state
  }
}

type Mode = 'topic' | 'video'

interface NewLessonWizardProps {
  internalRole: string | null
  productRole: string | null
}

export default function NewLessonWizard({ internalRole, productRole }: NewLessonWizardProps) {
  const [mode, setMode] = useState<Mode>('topic')
  const [state, dispatch] = useReducer(reducer, initialState)
  const [editingBlock, setEditingBlock] = useState<number | null>(null)
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL)
  const [passiveLesson, setPassiveLesson] = useState(false)

  function switchMode(next: Mode) {
    setMode(next)
    dispatch({ type: 'SET_STEP', step: 1 })
    setSelectedModel(DEFAULT_MODEL)
    setPassiveLesson(false)
  }

  async function generateOutline() {
    dispatch({ type: 'SET_STATUS', status: 'loading' })
    dispatch({ type: 'SET_STEP', step: 2 })

    const res = await fetch('/api/lessons/outline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: state.title,
        topic: state.topic,
        audience: state.audience,
        level: state.level,
        scope: state.scope,
        documentText: state.documentText,
        model: selectedModel,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      dispatch({ type: 'SET_STATUS', status: 'error', error: data.error || 'Failed to generate outline.' })
      dispatch({ type: 'SET_STEP', step: 1 })
      return
    }

    const outline: LessonOutline = await res.json()
    dispatch({ type: 'SET_OUTLINE', outline })
  }

  async function generateLesson() {
    if (!state.outline) return
    dispatch({ type: 'SET_STATUS', status: 'loading' })
    dispatch({ type: 'SET_STEP', step: 4 })

    const res = await fetch('/api/lessons/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outline: state.outline, documentText: state.documentText, topic: state.topic, model: selectedModel, passiveLesson }),
    })

    if (!res.ok) {
      const data = await res.json()
      dispatch({ type: 'SET_STATUS', status: 'error', error: data.error || 'Failed to generate lesson.' })
      dispatch({ type: 'SET_STEP', step: 3 })
      return
    }

    const { id, manifest } = await res.json()
    dispatch({ type: 'SET_MANIFEST', manifest, lessonId: id })
  }

  async function saveLesson() {
    if (!state.lessonId || !state.manifest) return
    dispatch({ type: 'SET_STATUS', status: 'loading' })

    const res = await fetch(`/api/lessons/${state.lessonId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manifest: state.manifest }),
    })

    if (!res.ok) {
      dispatch({ type: 'SET_STATUS', status: 'error', error: 'Failed to save.' })
      return
    }

    dispatch({ type: 'SET_STATUS', status: 'idle' })
  }

  function handleBlockUpdate(index: number, block: BlockConfig) {
    dispatch({ type: 'UPDATE_BLOCK', index, block })
  }

  return (
    <main className={styles.main}>
      <nav className={styles.nav}>
        <Link href="/" className={styles.wordmark}>Primr</Link>
      </nav>

      <div className={styles.tabBar}>
        <button
          className={[styles.tab, mode === 'topic' ? styles.tabActive : ''].join(' ')}
          onClick={() => switchMode('topic')}
        >
          Topic / Document
        </button>
        <button
          className={[styles.tab, mode === 'video' ? styles.tabActive : ''].join(' ')}
          onClick={() => switchMode('video')}
        >
          Video
        </button>
      </div>

      {mode === 'topic' && (
        <div className={styles.stepBar}>
          <StepIndicator current={state.step} />
        </div>
      )}

      <div className={styles.content}>
        {/* Video ingestion mode */}
        {mode === 'video' && (
          <VideoIngestForm
            internalRole={internalRole}
            productRole={productRole}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
          />
        )}

        {/* Step 1: Details form */}
        {mode === 'topic' && state.step === 1 && (
          <Step1Form
            state={state}
            onField={(field, value) => dispatch({ type: 'SET_FIELD', field: field as keyof WizardState, value })}
            onSubmit={generateOutline}
            internalRole={internalRole}
            productRole={productRole}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            passiveLesson={passiveLesson}
            onPassiveLessonChange={setPassiveLesson}
          />
        )}

        {/* Step 2: Loading outline */}
        {mode === 'topic' && state.step === 2 && (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <p className={styles.loadingText}>Generating outline…</p>
            <p className={styles.loadingHint}>This takes a few seconds.</p>
          </div>
        )}

        {/* Step 3: Outline editor */}
        {mode === 'topic' && state.step === 3 && state.outline && (
          <OutlineEditor
            outline={state.outline}
            onUpdateBlocks={blocks => dispatch({ type: 'UPDATE_OUTLINE_BLOCKS', blocks })}
            onGenerate={generateLesson}
            status={state.status}
            error={state.error}
          />
        )}

        {/* Step 4: Loading full generation */}
        {mode === 'topic' && state.step === 4 && (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <p className={styles.loadingText}>Building your lesson…</p>
            <p className={styles.loadingHint}>This takes about 30 seconds.</p>
          </div>
        )}

        {/* Step 5: Preview + edit */}
        {mode === 'topic' && state.step === 5 && state.manifest && (
          <div className={styles.preview}>
            <div className={styles.previewActions}>
              <button className={styles.saveBtn} onClick={saveLesson} disabled={state.status === 'loading'}>
                {state.status === 'loading' ? 'Saving…' : 'Save lesson'}
              </button>
              {state.lessonId && (
                <Link href={`/creator/preview/${state.lessonId}`} className={styles.viewLink}>
                  View published →
                </Link>
              )}
              {state.error && <span className={styles.error}>{state.error}</span>}
            </div>
            <p className={styles.editHint}>Click any block to edit it.</p>
            <div className={styles.blockStack}>
              {state.manifest.blocks.map((block, idx) => {
                const Component = BLOCK_COMPONENTS[block.type]
                if (!Component) return null
                return (
                  <div
                    key={block.id}
                    className={`${styles.blockCard} ${editingBlock === idx ? styles.blockActive : ''}`}
                    onClick={() => setEditingBlock(idx)}
                  >
                    <div className={styles.blockLabel}>{idx + 1}. {block.type}</div>
                    <div className={styles.blockPreview}>
                      <Component {...(block.props as Record<string, unknown>)} onComplete={() => {}} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Block edit slide-over */}
      {editingBlock !== null && state.manifest && (
        <BlockEditPanel
          key={editingBlock}
          block={state.manifest.blocks[editingBlock]}
          blockIndex={editingBlock}
          lessonTitle={state.manifest.title}
          onUpdate={handleBlockUpdate}
          onClose={() => setEditingBlock(null)}
        />
      )}
    </main>
  )
}
