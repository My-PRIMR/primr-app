'use client'

import { useEffect, useRef, useState } from 'react'
import '@primr/components/dist/style.css'
import { LessonRenderer } from '@primr/components'
import type { LessonManifest, LessonCompletePayload, LessonMode } from '@primr/components'

export default function LessonPlayer({ lessonId, manifest, adminMode, examEnforced = true, hideHeader = false }: { lessonId: string; manifest: LessonManifest; adminMode?: boolean; examEnforced?: boolean; hideHeader?: boolean }) {
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<LessonMode>('interactive')
  const submitted = useRef(false)
  const contentRef = useRef<HTMLDivElement>(null)

  // Start a new attempt on mount
  useEffect(() => {
    fetch(`/api/lessons/${lessonId}/attempts`, { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        if (data.attempt?.id) {
          setAttemptId(data.attempt.id)
          submitted.current = false // Reset for new attempt
        } else {
          setError('Could not start lesson. Are you signed in?')
        }
      })
      .catch(() => setError('Could not start lesson.'))
  }, [lessonId])

  // Listen for lesson-reset message from parent (when user clicks "Review lesson" in marketing page)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'lesson-reset') {
        submitted.current = false
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])


  async function handleLessonComplete(payload: LessonCompletePayload) {
    if (!attemptId || submitted.current) return
    submitted.current = true

    try {
      await fetch(`/api/attempts/${attemptId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score: payload.score,
          scoredBlocks: payload.scoredBlocks,
          blockResults: payload.blockResults,
        }),
      })

      // Notify parent page (for embedded showcase lessons) that lesson is complete
      window.parent.postMessage({ type: 'lesson-complete', score: payload.score }, '*')
    } catch (error) {
      // Reset on error so they can try again
      submitted.current = false
      console.error('Failed to submit lesson attempt:', error)
    }
  }

  if (error) {
    return <div style={{ padding: '2rem', color: '#d94f4f' }}>{error}</div>
  }

  return (
    <div ref={contentRef}>
      {adminMode && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0.5rem 1.5rem 0', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setMode(m => m === 'interactive' ? 'showcase' : 'interactive')}
            style={{
              fontSize: '11px',
              fontFamily: 'DM Sans, system-ui, sans-serif',
              padding: '0.25rem 0.65rem',
              border: '1px solid rgba(15,17,23,0.2)',
              borderRadius: '5px',
              background: mode === 'showcase' ? 'var(--accent, #7C8EF7)' : 'transparent',
              color: mode === 'showcase' ? '#fff' : 'inherit',
              cursor: 'pointer',
            }}
          >
            {mode === 'showcase' ? 'Showcase mode' : 'Interactive mode'}
          </button>
        </div>
      )}
      <LessonRenderer
        manifest={manifest}
        adminMode={adminMode}
        mode={mode}
        examEnforced={examEnforced}
        onLessonComplete={mode === 'interactive' ? handleLessonComplete : undefined}
      />
    </div>
  )
}
