'use client'

import { useEffect } from 'react'
import '@primr/components/dist/style.css'
import { LessonRenderer } from '@primr/components'
import type { LessonManifest } from '@primr/components'

export default function LessonClient({ manifest }: { manifest: LessonManifest }) {
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === 'theme-change' && (e.data.theme === 'light' || e.data.theme === 'dark')) {
        document.documentElement.setAttribute('data-theme', e.data.theme)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  function handleComplete() {
    window.parent.postMessage({ type: 'lesson-complete' }, '*')
  }

  return (
    <div style={{ width: '100%' }}>
      <LessonRenderer manifest={manifest} adminMode={false} mode="showcase" examEnforced={false} onLessonComplete={handleComplete} hideAutoAdvance />
    </div>
  )
}
