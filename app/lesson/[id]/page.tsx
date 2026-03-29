'use client'

import { useEffect, useState } from 'react'
import { notFound } from 'next/navigation'
import '@primr/components/dist/style.css'
import { LessonRenderer } from '@primr/components'
import type { LessonManifest } from '@primr/components'

export default function PublicShowcaseLesson({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ showcase?: string }>
}) {
  const [lesson, setLesson] = useState<{ id: string; manifest: LessonManifest } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [id, setId] = useState<string | null>(null)
  const [showParam, setShowParam] = useState<string | undefined>(undefined)

  // Resolve params and searchParams
  useEffect(() => {
    ;(async () => {
      try {
        const resolvedParams = await params
        const resolvedSearch = await searchParams
        setId(resolvedParams.id)
        setShowParam(resolvedSearch.showcase)
      } catch (e) {
        setError('Invalid route parameters')
      }
    })()
  }, [params, searchParams])

  // Fetch lesson data
  useEffect(() => {
    if (!id || showParam !== 'true') {
      setLoading(false)
      return
    }

    ;(async () => {
      try {
        const res = await fetch(`/api/lessons/${id}/public`)
        if (!res.ok) {
          throw new Error('Lesson not found or not in showcase mode')
        }
        const data = await res.json()
        setLesson(data.lesson)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load lesson')
      } finally {
        setLoading(false)
      }
    })()
  }, [id, showParam])

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading lesson...</div>
  }

  if (!id || showParam !== 'true') {
    notFound()
  }

  if (error) {
    return <div style={{ padding: '2rem', color: '#d94f4f' }}>Error: {error}</div>
  }

  if (!lesson) {
    notFound()
  }

  return (
    <div style={{ width: '100%' }}>
      <LessonRenderer
        manifest={lesson.manifest}
        adminMode={false}
        mode="showcase"
        examEnforced={false}
      />
    </div>
  )
}
