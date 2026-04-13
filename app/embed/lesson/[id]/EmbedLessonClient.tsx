'use client'

import { useEffect } from 'react'
import '@primr/components/dist/style.css'
import { LessonRenderer } from '@primr/components'
import type { LessonManifest, LessonCompletePayload } from '@primr/components'

interface Props {
  lessonId: string
  manifest: LessonManifest
  initialTheme?: 'light' | 'dark'
}

export default function EmbedLessonClient({ lessonId, manifest, initialTheme }: Props) {
  useEffect(() => {
    if (initialTheme) {
      document.documentElement.setAttribute('data-theme', initialTheme)
    }
    document.body.dataset.embedType = 'lesson'
    document.body.dataset.embedId = lessonId
  }, [initialTheme, lessonId])

  // Fire anonymous view event
  useEffect(() => {
    const sid = getOrCreateSessionId()
    fetch('/api/embed/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lessonId,
        eventType: 'view',
        anonymousSessionId: sid,
        embedOrigin: document.referrer || '',
      }),
    }).catch(() => {})
  }, [lessonId])

  function handleComplete(payload: LessonCompletePayload) {
    window.parent.postMessage({
      type: 'primr-lesson-complete',
      lessonId,
      score: payload.score,
      duration: null,
    }, '*')

    const sid = getOrCreateSessionId()
    fetch('/api/embed/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lessonId,
        eventType: 'lesson_complete',
        anonymousSessionId: sid,
        embedOrigin: document.referrer || '',
        payload: { score: payload.score, scoredBlocks: payload.scoredBlocks, totalBlocks: payload.totalBlocks },
      }),
    }).catch(() => {})
  }

  return (
    <div style={{ width: '100%' }}>
      <LessonRenderer
        manifest={manifest}
        adminMode={false}
        mode="showcase"
        examEnforced={false}
        onLessonComplete={handleComplete}
        hideAutoAdvance
      />
      <footer style={{
        textAlign: 'center',
        padding: '1rem',
        fontSize: '11px',
        color: 'var(--ink-muted)',
        borderTop: '1px solid var(--border)',
      }}>
        Powered by <a href="https://getprimr.com" target="_blank" rel="noopener" style={{ color: 'inherit' }}>Primr</a>
      </footer>
    </div>
  )
}

function getOrCreateSessionId(): string {
  const key = 'primr_embed_sid'
  let sid = ''
  try {
    sid = localStorage.getItem(key) || ''
    if (!sid) {
      sid = crypto.randomUUID()
      localStorage.setItem(key, sid)
    }
  } catch {
    sid = crypto.randomUUID()
  }
  return sid
}
