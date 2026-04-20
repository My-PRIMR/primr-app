'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import '@primr/components/dist/style.css'
import { LessonRenderer } from '@primr/components'
import type { LessonManifest, LessonCompletePayload, LessonMode } from '@primr/components'
import { FeedbackOverlay } from './FeedbackOverlay'

export default function LessonPlayer({ lessonId, manifest, adminMode, examEnforced = true, isEmbed = false, dashboardUrl, isInternalUser = false }: { lessonId: string; manifest: LessonManifest; adminMode?: boolean; examEnforced?: boolean; isEmbed?: boolean; dashboardUrl?: string; isInternalUser?: boolean }) {
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [attemptStatus, setAttemptStatus] = useState<'in_progress' | 'completed' | null>(null)
  const [initialBlockStates, setInitialBlockStates] = useState<Record<string, { status: 'complete'; score?: number; questions?: Array<{ index: number; chosenIndex: number; correct: boolean }> }> | null>(null)
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
        if (data.attempt?.id) {
          setAttemptId(data.attempt.id)
          setAttemptStatus(data.attempt.status ?? 'in_progress')
          // Exam blocks always restart on resume (graded content isn't half-takeable).
          // Filter any exam-block entries out of the hydrated state so the learner
          // re-encounters them; everything else resumes from where they left off.
          const examBlockIds = new Set(
            manifest.blocks.filter(b => b.type === 'exam').map(b => b.id),
          )
          const raw = data.attempt.blockResults ?? null
          if (raw && examBlockIds.size > 0) {
            const filtered = Object.fromEntries(
              Object.entries(raw).filter(([blockId]) => !examBlockIds.has(blockId)),
            )
            setInitialBlockStates(filtered as typeof raw)
          } else {
            setInitialBlockStates(raw)
          }
        } else {
          setError('Could not start lesson. Are you signed in?')
        }
      })
      .catch(() => setError('Could not start lesson.'))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId])

  const handleBlockFlag = useCallback((blockId: string, comment: string) => {
    setPendingFlags(prev => [...prev, { blockId, comment }])
  }, [])

  const handleBlockComplete = useCallback(
    async (blockId: string, result: { status: string; score?: number; questions?: Array<{ index: number; chosenIndex: number; correct: boolean }> }) => {
      if (!attemptId) return
      try {
        await fetch(`/api/attempts/${attemptId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blockResult: { blockId, ...result } }),
        })
      } catch (err) {
        console.error('[block-complete] failed:', err)
      }
    },
    [attemptId],
  )

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
      {attemptStatus === 'completed' && !isEmbed && (
        <div style={{ padding: '0.5rem 1.5rem', background: 'var(--surface-alt, #F7F6F3)', borderBottom: '1px solid var(--border, rgba(15,17,23,0.1))', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'DM Sans, system-ui, sans-serif' }}>
          <span>You&rsquo;ve completed this lesson.</span>
          <button
            type="button"
            onClick={async () => {
              const res = await fetch(`/api/lessons/${lessonId}/attempts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ forceNew: true }),
              })
              const data = await res.json()
              if (data.attempt?.id) {
                setAttemptId(data.attempt.id)
                setAttemptStatus('in_progress')
                setInitialBlockStates(null)
                submitted.current = false
              }
            }}
            style={{ padding: '0.25rem 0.65rem', border: '1px solid rgba(15,17,23,0.2)', borderRadius: '5px', background: 'transparent', cursor: 'pointer', fontFamily: 'DM Sans, system-ui, sans-serif' }}
          >
            Start over
          </button>
        </div>
      )}
      <LessonRenderer
        manifest={manifest}
        adminMode={adminMode}
        mode={mode}
        examEnforced={examEnforced}
        initialBlockStates={initialBlockStates ?? undefined}
        onBlockComplete={mode === 'interactive' && !adminMode ? handleBlockComplete : undefined}
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
