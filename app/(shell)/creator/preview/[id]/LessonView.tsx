'use client'

import '@primr/components/dist/style.css'
import { LessonRenderer } from '@primr/components'
import type { LessonManifest } from '@primr/components'

export default function LessonView({ manifest }: { manifest: LessonManifest }) {
  return <LessonRenderer manifest={manifest} preview={false} />
}
