'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import styles from './page.module.css'

type GenerationStatus = 'pending' | 'generating' | 'done' | 'failed' | null

interface LessonData {
  id: string
  title: string
  generationStatus: GenerationStatus
  sourceVideoUrl: string | null
}

const STATUS_STEPS = [
  { key: 'pending',    label: 'Queued',                     hint: 'Waiting to start transcription…' },
  { key: 'generating', label: 'Transcribing & generating',  hint: 'This takes a minute or two depending on video length.' },
  { key: 'done',       label: 'Done',                       hint: 'Redirecting to the editor…' },
]

const POLL_INTERVAL_MS = 3000

export default function VideoStatusPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const [lesson, setLesson] = useState<LessonData | null>(null)
  const [fetchError, setFetchError] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function stopPolling() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  async function poll() {
    try {
      const res = await fetch(`/api/lessons/${id}`)
      if (!res.ok) { setFetchError(true); stopPolling(); return }
      const data: LessonData = await res.json()
      setLesson(data)

      if (data.generationStatus === 'done') {
        stopPolling()
        router.push(`/dashboard/edit/${id}`)
      } else if (data.generationStatus === 'failed') {
        stopPolling()
      }
    } catch {
      setFetchError(true)
      stopPolling()
    }
  }

  useEffect(() => {
    poll()
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS)
    return stopPolling
  }, [id])

  const status = lesson?.generationStatus ?? 'pending'
  const activeStepIndex = STATUS_STEPS.findIndex(s => s.key === status)
  const isFailed = status === 'failed'
  const currentStep = STATUS_STEPS[activeStepIndex] ?? STATUS_STEPS[0]

  return (
    <main className={styles.main}>
      <nav className={styles.nav}>
        <Link href="/dashboard/new" className={styles.wordmark}>Primr</Link>
      </nav>

      <div className={styles.content}>
        <div className={styles.card}>
          {/* Progress steps */}
          <div className={styles.steps}>
            {STATUS_STEPS.map((step, i) => {
              const isComplete = !isFailed && activeStepIndex > i
              const isActive = !isFailed && activeStepIndex === i
              return (
                <div key={step.key} className={styles.stepRow}>
                  <div className={[
                    styles.stepDot,
                    isComplete ? styles.stepDotDone : '',
                    isActive ? styles.stepDotActive : '',
                  ].join(' ')}>
                    {isComplete ? '✓' : i + 1}
                  </div>
                  <span className={[
                    styles.stepLabel,
                    isActive ? styles.stepLabelActive : '',
                    isComplete ? styles.stepLabelDone : '',
                  ].join(' ')}>
                    {step.label}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Status message */}
          {!isFailed && !fetchError && (
            <div className={styles.status}>
              <div className={styles.spinner} />
              <div>
                <p className={styles.statusLabel}>{currentStep.label}…</p>
                <p className={styles.statusHint}>{currentStep.hint}</p>
              </div>
            </div>
          )}

          {/* Video info */}
          {lesson?.sourceVideoUrl && (
            <div className={styles.videoInfo}>
              <span className={styles.videoLabel}>Source video</span>
              <a
                href={lesson.sourceVideoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.videoUrl}
              >
                {lesson.sourceVideoUrl}
              </a>
            </div>
          )}

          {/* Failed state */}
          {isFailed && (
            <div className={styles.failedBox}>
              <p className={styles.failedTitle}>Generation failed</p>
              <p className={styles.failedHint}>
                Something went wrong during transcription or lesson generation.
              </p>
              <Link href="/dashboard/new?tab=video" className={styles.retryLink}>
                ← Try again
              </Link>
            </div>
          )}

          {/* Fetch error */}
          {fetchError && (
            <div className={styles.failedBox}>
              <p className={styles.failedTitle}>Could not load status</p>
              <p className={styles.failedHint}>Check your connection and refresh.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
