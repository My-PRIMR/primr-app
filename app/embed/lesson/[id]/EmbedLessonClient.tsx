'use client'

import { useState, useEffect } from 'react'
import '@primr/components/dist/style.css'
import { LessonRenderer } from '@primr/components'
import type { LessonManifest, LessonCompletePayload } from '@primr/components'

interface Props {
  lessonId: string
  manifest: LessonManifest
  theme: string
}

export default function EmbedLessonClient({ lessonId, manifest, theme }: Props) {
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    document.body.setAttribute('data-primr-theme', theme)
    document.body.dataset.embedType = 'lesson'
    document.body.dataset.embedId = lessonId
  }, [theme, lessonId])

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === 'primr-auth-complete') {
        setLoggedIn(true)
        window.parent.postMessage({ type: 'primr-auth-complete', userId: e.data.userId }, '*')
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  function handleLogin() {
    const authUrl = process.env.NEXT_PUBLIC_PRIMR_AUTH_URL || 'http://localhost:3001'
    const w = window.open(
      `${authUrl}/login?embed=true`,
      'primr-login',
      'width=500,height=700,menubar=no,toolbar=no',
    )
    if (!w) {
      window.location.href = `${authUrl}/login?embed=true&returnUrl=${encodeURIComponent(window.location.href)}`
    }
  }

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
        autoAdvance={false}
        hideAutoAdvance
      />
      {!loggedIn && (
        <div style={{
          textAlign: 'center',
          padding: '0.5rem',
          fontSize: '12px',
          color: 'var(--lesson-ink-muted)',
        }}>
          <button
            onClick={handleLogin}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--lesson-accent)',
              cursor: 'pointer',
              fontSize: '12px',
              textDecoration: 'underline',
            }}
          >
            Sign in to save progress
          </button>
        </div>
      )}
      <footer style={{
        textAlign: 'center',
        padding: '1rem',
        fontSize: '11px',
        color: 'var(--lesson-ink-muted)',
        borderTop: '1px solid var(--lesson-divider)',
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
