'use client'

import '@primr/components/dist/style.css'
import { LessonRenderer } from '@primr/components'
import type { LessonManifest } from '@primr/components'

export default function LessonClient({ manifest }: { manifest: LessonManifest }) {
  function handleComplete() {
    window.parent.postMessage({ type: 'lesson-complete' }, '*')
  }

  return (
    <div style={{ width: '100%' }}>
      <LessonRenderer manifest={manifest} adminMode={false} mode="showcase" examEnforced={false} onLessonComplete={handleComplete} hideAutoAdvance />
    </div>
  )
}
