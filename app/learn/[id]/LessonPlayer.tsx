'use client'

import { useEffect, useRef, useState } from 'react'
import '@primr/components/dist/style.css'
import { LessonRenderer } from '@primr/components'
import type { LessonManifest, LessonCompletePayload } from '@primr/components'

export default function LessonPlayer({ lessonId, manifest, adminMode }: { lessonId: string; manifest: LessonManifest; adminMode?: boolean }) {
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const submitted = useRef(false)

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

  async function handleLessonComplete(payload: LessonCompletePayload) {
    if (!attemptId || submitted.current) return
    submitted.current = true

    await fetch(`/api/attempts/${attemptId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        score: payload.score,
        scoredBlocks: payload.scoredBlocks,
        blockResults: payload.blockResults,
      }),
    })
  }

  if (error) {
    return <div style={{ padding: '2rem', color: '#d94f4f' }}>{error}</div>
  }

  return (
    <LessonRenderer
      manifest={manifest}
      adminMode={adminMode}
      onLessonComplete={handleLessonComplete}
    />
  )
}
