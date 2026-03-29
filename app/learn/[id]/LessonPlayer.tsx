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
  const lastSentHeightRef = useRef(0)

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

  // Send content height to parent iframe (for embedding in marketing site)
  useEffect(() => {
    if (!contentRef.current) return

    let debounceTimeout: NodeJS.Timeout

    const sendHeight = () => {
      if (contentRef.current) {
        const height = contentRef.current.scrollHeight
        // Only send if height changed by more than 10px
        if (Math.abs(height - lastSentHeightRef.current) > 10) {
          lastSentHeightRef.current = height
          window.parent.postMessage({ type: 'lesson-height', height }, '*')
        }
      }
    }

    const debouncedSendHeight = () => {
      clearTimeout(debounceTimeout)
      debounceTimeout = setTimeout(sendHeight, 500)
    }

    // Send initial height after images load
    const images = contentRef.current.querySelectorAll('img')
    if (images.length === 0) {
      setTimeout(sendHeight, 100)
    } else {
      Promise.all(Array.from(images).map(img => {
        return new Promise(resolve => {
          if (img.complete) {
            resolve(true)
          } else {
            img.addEventListener('load', () => resolve(true), { once: true })
            img.addEventListener('error', () => resolve(false), { once: true })
          }
        })
      })).then(() => {
        setTimeout(sendHeight, 50)
      })
    }

    // Watch for block transitions and DOM changes (new images, content updates)
    const observer = new MutationObserver(() => {
      debouncedSendHeight()
    })

    observer.observe(contentRef.current, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    })

    // Also watch for image loads that happen after initial render
    const imageObserver = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        if (mutation.addedNodes.length) {
          Array.from(mutation.addedNodes).forEach(node => {
            if (node instanceof HTMLImageElement) {
              node.addEventListener('load', debouncedSendHeight, { once: true })
              node.addEventListener('error', debouncedSendHeight, { once: true })
            }
          })
        }
      })
    })

    imageObserver.observe(contentRef.current, {
      childList: true,
      subtree: true,
    })

    return () => {
      clearTimeout(debounceTimeout)
      observer.disconnect()
      imageObserver.disconnect()
    }
  }, [])

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

    // Notify parent page (for embedded showcase lessons) that lesson is complete
    window.parent.postMessage({ type: 'lesson-complete', score: payload.score }, '*')
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
