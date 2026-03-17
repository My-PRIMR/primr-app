'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './Step1Form.module.css'
import videoStyles from './VideoIngestForm.module.css'

function isYouTubeOrVimeo(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') return true
    if (u.hostname.includes('youtube.com') && (u.searchParams.get('v') || u.pathname.startsWith('/embed/'))) return true
    if (u.hostname.includes('vimeo.com')) return true
    return false
  } catch {
    return false
  }
}

const EXAMPLES = [
  { label: 'YouTube video', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
  { label: 'YouTube short URL', url: 'https://youtu.be/dQw4w9WgXcQ' },
  { label: 'Vimeo', url: 'https://vimeo.com/123456789' },
]

export default function VideoIngestForm() {
  const router = useRouter()

  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [audience, setAudience] = useState('')
  const [level, setLevel] = useState('beginner')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const urlValid = url.trim() && isYouTubeOrVimeo(url.trim())
  const urlTouched = url.trim().length > 0
  const urlInvalid = urlTouched && !urlValid

  async function handleSubmit() {
    if (!urlValid) return
    setSubmitting(true)
    setError('')

    const res = await fetch('/api/lessons/ingest-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: url.trim(),
        title: title.trim() || undefined,
        audience: audience.trim() || undefined,
        level,
      }),
    })

    const data = await res.json()
    setSubmitting(false)

    if (!res.ok) {
      setError(data.error || 'Something went wrong.')
      return
    }

    router.push(`/creator/video-status/${data.id}`)
  }

  return (
    <div className={styles.form}>
      <h1 className={styles.heading}>Generate from video</h1>
      <p className={styles.sub}>
        Paste a YouTube or Vimeo link. We'll transcribe it and generate a full lesson from the content.
      </p>

      <label className={styles.label}>
        Video URL
        <input
          className={[styles.input, urlInvalid ? videoStyles.inputError : ''].join(' ')}
          placeholder="https://www.youtube.com/watch?v=… or https://vimeo.com/…"
          value={url}
          onChange={e => { setUrl(e.target.value); setError('') }}
          autoFocus
          type="url"
        />
        {urlInvalid && (
          <span className={videoStyles.fieldError}>Paste a YouTube or Vimeo URL.</span>
        )}
      </label>

      <div className={styles.examples}>
        <span className={styles.examplesLabel}>Supported formats:</span>
        {EXAMPLES.map(ex => (
          <button
            key={ex.label}
            type="button"
            className={styles.exampleChip}
            onClick={() => setUrl(ex.url)}
          >
            {ex.label}
          </button>
        ))}
      </div>

      <label className={styles.label}>
        Lesson title <span className={videoStyles.optional}>(optional — we'll infer from the video)</span>
        <input
          className={styles.input}
          placeholder="e.g. Introduction to Machine Learning"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
      </label>

      <div className={styles.row}>
        <label className={styles.label}>
          Audience <span className={videoStyles.optional}>(optional)</span>
          <input
            className={styles.input}
            placeholder="e.g. Junior developers"
            value={audience}
            onChange={e => setAudience(e.target.value)}
          />
        </label>

        <label className={styles.label}>
          Level
          <select
            className={styles.select}
            value={level}
            onChange={e => setLevel(e.target.value)}
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <button
        className={styles.submit}
        disabled={!urlValid || submitting}
        onClick={handleSubmit}
      >
        {submitting ? 'Starting…' : 'Generate lesson from video →'}
      </button>
    </div>
  )
}
