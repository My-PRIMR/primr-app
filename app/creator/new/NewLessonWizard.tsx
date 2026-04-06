'use client'

import { useReducer, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { WizardState, WizardAction } from '@/types/outline'
import { DEFAULT_MODEL } from '@/lib/models'
import { canUseRichIngest, canUsePexels, canAiEdit as canAiEditFn } from '@/lib/models'
import StepIndicator from './components/StepIndicator'
import Step1Form from './components/Step1Form'
import LessonBlockEditor from '../components/LessonBlockEditor'
import styles from './page.module.css'

const initialState: WizardState = {
  step: 1,
  title: '',
  topic: '',
  audience: '',
  level: 'beginner',
  scope: '',
  videoUrl: '',
  structureSource: 'document',
  documentText: '',
  documentName: '',
  documentAssets: [],
  extractImages: false,
  decodeQr: false,
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
    case 'SET_MANIFEST':
      return { ...state, manifest: action.manifest, lessonId: action.lessonId, step: 3, status: 'idle', error: '' }
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

interface NewLessonWizardProps {
  internalRole: string | null
  productRole: string | null
  plan: string | null
}

export default function NewLessonWizard({ internalRole, productRole, plan }: NewLessonWizardProps) {
  const router = useRouter()
  const [state, dispatch] = useReducer(reducer, initialState)
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL)
  const [passiveLesson, setPassiveLesson] = useState(false)
  const [includeImages, setIncludeImages] = useState(false)

  const canRichIngest = canUseRichIngest(plan, internalRole)
  const canPexels = canUsePexels(plan, internalRole)
  const aiEditEnabled = canAiEditFn(plan, internalRole)
  const isInternal = internalRole != null

  async function generateLesson() {
    // If a YouTube URL is provided, use the async video ingestion path
    if (state.videoUrl.trim()) {
      dispatch({ type: 'SET_STATUS', status: 'loading' })
      try {
        const isYouTube = /youtu\.be\/|youtube\.com\/(watch|embed|shorts)/.test(state.videoUrl.trim())
        if (isYouTube) {
          const res = await fetch('/api/lessons/ingest-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: state.videoUrl.trim(),
              title: state.title.trim() || undefined,
              audience: state.audience.trim() || undefined,
              level: state.level,
              scope: state.scope.trim() || undefined,
              model: selectedModel,
              passiveLesson,
            }),
          })
          const data = await res.json() as { id?: string; error?: string }
          if (!res.ok) {
            dispatch({ type: 'SET_STATUS', status: 'error', error: data.error || 'Failed to start video generation.' })
            return
          }
          router.push(`/creator/video-status/${data.id}`)
          return
        }
      } catch {
        dispatch({ type: 'SET_STATUS', status: 'error', error: 'Network error. Please try again.' })
        return
      }
    }

    dispatch({ type: 'SET_STEP', step: 2 })

    const res = await fetch('/api/lessons/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: state.title.trim() || undefined,
        topic: state.topic || undefined,
        documentText: state.documentText || undefined,
        documentAssets: state.documentAssets.length ? state.documentAssets : undefined,
        model: selectedModel,
        passiveLesson,
        includeImages,
      }),
    })

    if (!res.ok) {
      let errorMsg = 'Failed to generate lesson.'
      try {
        const data = await res.json()
        errorMsg = data.error || errorMsg
      } catch {}
      dispatch({ type: 'SET_STATUS', status: 'error', error: errorMsg })
      dispatch({ type: 'SET_STEP', step: 1 })
      return
    }

    const { id, manifest } = await res.json()
    dispatch({ type: 'SET_MANIFEST', manifest, lessonId: id })
  }

  return (
    <main className={styles.main}>
      <nav className={styles.nav}>
        <Link href="/" className={styles.wordmark}>Primr</Link>
      </nav>

      <div className={styles.stepBar}>
        <StepIndicator current={state.step} />
      </div>

      <div className={styles.content}>
        {/* Step 1: Details form */}
        {state.step === 1 && (
          <Step1Form
            state={state}
            onField={(field, value) => dispatch({ type: 'SET_FIELD', field: field as keyof WizardState, value })}
            onSubmit={generateLesson}
            internalRole={internalRole}
            productRole={productRole}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            passiveLesson={passiveLesson}
            onPassiveLessonChange={setPassiveLesson}
            includeImages={includeImages}
            onIncludeImagesChange={setIncludeImages}
            canRichIngest={canRichIngest}
            mode="lesson"
          />
        )}

        {/* Step 2: Generating */}
        {state.step === 2 && (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <p className={styles.loadingText}>Building your lesson…</p>
            <p className={styles.loadingHint}>
              {state.extractImages || state.decodeQr
                ? 'Processing document assets — this may take up to a minute.'
                : 'This takes about 30 seconds.'}
            </p>
          </div>
        )}

        {/* Step 3: Paginated editor */}
        {state.step === 3 && state.manifest && state.lessonId && (
          <LessonBlockEditor
            lessonId={state.lessonId}
            initialManifest={state.manifest}
            canPexels={canPexels}
            canAiEdit={aiEditEnabled}
            plan={plan ?? undefined}
            isInternal={isInternal}
            rightPanelExtra={
              <Link href={`/creator/preview/${state.lessonId}`} className={styles.viewLink}>
                View published →
              </Link>
            }
          />
        )}
      </div>

      {state.error && state.step === 1 && (
        <p className={styles.error}>{state.error}</p>
      )}
    </main>
  )
}
