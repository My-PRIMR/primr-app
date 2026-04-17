'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import '@primr/components/dist/style.css'
import { LessonRenderer } from '@primr/components'
import type { LessonManifest, LessonCompletePayload, LessonMode } from '@primr/components'
import { FeedbackOverlay } from './FeedbackOverlay'

export default function LessonPlayer({ lessonId, manifest, adminMode, examEnforced = true, isEmbed = false, dashboardUrl, isInternalUser = false }: { lessonId: string; manifest: LessonManifest; adminMode?: boolean; examEnforced?: boolean; isEmbed?: boolean; dashboardUrl?: string; isInternalUser?: boolean }) {
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<LessonMode>('interactive')
  const [phase, setPhase] = useState<'learning' | 'feedback' | 'complete'>('learning')
  const [pendingFlags, setPendingFlags] = useState<Array<{ blockId: string; comment: string }>>([])
  const submitted = useRef(false)
  const lastPayloadRef = useRef<LessonCompletePayload | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Start a new attempt on mount
  useEffect(() => {
    fetch(`/api/lessons/${lessonId}/attempts`, { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        if (data.attempt?.id) setAttemptId(data.attempt.id)
        else setError('Could not start lesson. Are you signed in?')
      })
      .catch(() => setError('Could not start lesson.'))
  }, [lessonId])

  const handleBlockFlag = useCallback((blockId: string, comment: string) => {
    setPendingFlags(prev => [...prev, { blockId, comment }])
  }, [])

  const handleBugReport = useCallback(async (report: { blockId: string; blockIndex: number; blockType: string; description: string }) => {
    try {
      await fetch(`/api/lessons/${lessonId}/bug-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      })
    } catch (err) {
      console.error('[bug-report] failed:', err)
    }
  }, [lessonId])

  async function handleLessonComplete(payload: LessonCompletePayload) {
    if (!attemptId || submitted.current) return
    submitted.current = true
    lastPayloadRef.current = payload

    await fetch(`/api/attempts/${attemptId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        score: payload.score,
        scoredBlocks: payload.scoredBlocks,
        blockResults: payload.blockResults,
      }),
    })

    // Save block flags immediately so they aren't lost if the learner closes
    // the window before interacting with the feedback overlay.
    if (pendingFlags.length > 0) {
      await fetch(`/api/lessons/${lessonId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId, blockFlags: pendingFlags }),
      })
    }

    setPhase('feedback')
  }

  async function handleFeedbackDone(rating: number | null, comment: string) {
    if (attemptId) {
      await fetch(`/api/lessons/${lessonId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId,
          rating: rating ?? undefined,
          comment: comment || undefined,
          blockFlags: pendingFlags,
        }),
      })
    }
    setPhase('complete')
    window.parent.postMessage({ type: 'lesson-complete', score: lastPayloadRef.current?.score }, '*')
  }

  if (error) {
    return <div style={{ padding: '2rem', color: '#d94f4f' }}>{error}</div>
  }

  return (
    <div ref={contentRef} style={{ position: 'relative' }}>
      {isEmbed && (
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
        onBlockFlag={mode === 'interactive' && !adminMode ? handleBlockFlag : undefined}
        onBugReport={isInternalUser ? handleBugReport : undefined}
        dashboardUrl={dashboardUrl}
      />
      {phase === 'feedback' && (
        <FeedbackOverlay onDone={handleFeedbackDone} />
      )}
    </div>
  )
}
