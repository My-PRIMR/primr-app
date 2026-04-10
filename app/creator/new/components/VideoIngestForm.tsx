'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './Step1Form.module.css'
import videoStyles from './VideoIngestForm.module.css'
import { MODELS, canSelectModels, canSelectOpus } from '@/lib/models'

interface Props {
  internalRole?: string | null
  productRole?: string | null
  selectedModel?: string
  onModelChange?: (model: string) => void
}

type SourceMode = 'url' | 'file'

function isYouTubeUrl(val: string) {
  return /youtu\.be\/|youtube\.com\/(watch|embed|shorts)/.test(val)
}

export default function VideoIngestForm({ internalRole, productRole, selectedModel, onModelChange }: Props) {
  const router = useRouter()

  const [sourceMode, setSourceMode] = useState<SourceMode>('url')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [audience, setAudience] = useState('')
  const [level, setLevel] = useState('beginner')
  const [scope, setScope] = useState('')
  const [passiveLesson, setPassiveLesson] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploadPercent, setUploadPercent] = useState(0)
  const [uploadStage, setUploadStage] = useState<'idle' | 'uploading' | 'processing'>('idle')
  const [error, setError] = useState('')

  const urlValid = sourceMode === 'url' && isYouTubeUrl(url.trim())
  const fileValid = sourceMode === 'file' && !!file
  const canSubmit = urlValid || fileValid

  function switchMode(mode: SourceMode) {
    setSourceMode(mode)
    setError('')
  }

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError('')

    if (sourceMode === 'url') {
      // URL path — simple JSON POST, no upload progress needed
      try {
        const res = await fetch('/api/lessons/ingest-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: url.trim(),
            title: title.trim() || undefined,
            audience: audience.trim() || undefined,
            level,
            scope: scope.trim() || undefined,
            model: canSelectModels(internalRole, productRole) ? selectedModel : undefined,
            passiveLesson,
          }),
        })
        const data = await res.json() as { id?: string; error?: string }
        if (!res.ok) {
          setError(data.error || `Failed (${res.status}).`)
          setSubmitting(false)
          return
        }
        router.push(`/creator/video-status/${data.id}`)
      } catch {
        setError('Network error. Please try again.')
        setSubmitting(false)
      }
      return
    }

    // File upload path — XHR for progress tracking
    setUploadPercent(0)
    setUploadStage('uploading')
    const form = new FormData()
    form.append('file', file!)
    if (title.trim()) form.append('title', title.trim())
    if (audience.trim()) form.append('audience', audience.trim())
    form.append('level', level)
    if (scope.trim()) form.append('scope', scope.trim())
    if (selectedModel && canSelectModels(internalRole, productRole)) form.append('model', selectedModel)
    form.append('passiveLesson', String(passiveLesson))

    const result = await new Promise<{ ok: boolean; status: number; data: { id?: string; error?: string } }>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', '/api/lessons/ingest-video')
      xhr.responseType = 'json'
      xhr.upload.onprogress = e => {
        if (!e.lengthComputable) return
        const pct = Math.max(1, Math.min(99, Math.round((e.loaded / e.total) * 100)))
        setUploadPercent(pct)
      }
      xhr.onload = () => {
        const data = (xhr.response ?? {}) as { id?: string; error?: string }
        resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data })
      }
      xhr.onerror = () => reject(new Error('Network error while uploading file.'))
      xhr.send(form)
    })

    setSubmitting(false)
    setUploadPercent(100)
    setUploadStage('processing')

    if (!result.ok) {
      setUploadStage('idle')
      setError(result.data.error || `Upload failed (${result.status}).`)
      return
    }

    router.push(`/creator/video-status/${result.data.id}`)
  }

  return (
    <div className={styles.form}>
      <h1 className={styles.heading}>Generate from video</h1>
      <p className={styles.sub}>
        Paste a YouTube URL or upload a video/audio file — we'll generate a full lesson from it.
      </p>

      <div className={videoStyles.sourceToggle}>
        <button
          type="button"
          className={[videoStyles.sourceBtn, sourceMode === 'url' ? videoStyles.sourceBtnActive : ''].join(' ')}
          onClick={() => switchMode('url')}
        >
          YouTube URL
        </button>
        <button
          type="button"
          className={[videoStyles.sourceBtn, sourceMode === 'file' ? videoStyles.sourceBtnActive : ''].join(' ')}
          onClick={() => switchMode('file')}
        >
          Upload file
        </button>
      </div>

      {sourceMode === 'url' ? (
        <label className={styles.label}>
          YouTube URL
          <input
            className={styles.input}
            type="url"
            placeholder="https://www.youtube.com/watch?v=..."
            value={url}
            onChange={e => { setUrl(e.target.value); setError('') }}
            autoFocus
          />
          {url.trim() && !urlValid && (
            <span className={videoStyles.fieldError}>Please enter a valid YouTube URL</span>
          )}
        </label>
      ) : (
        <label className={styles.label}>
          Source file
          <input
            className={styles.input}
            type="file"
            accept=".mp4,.mov,.m4v,.webm,.mkv,.mp3,.m4a,.wav,.aac,.ogg"
            onChange={e => { setFile(e.target.files?.[0] ?? null); setError('') }}
            autoFocus
          />
          <span className={videoStyles.optional}>Accepted: mp4, mov, webm, mkv, mp3, m4a, wav, aac, ogg (max 1GB)</span>
        </label>
      )}

      <label className={styles.label}>
        Lesson title <span className={videoStyles.optional}>(optional — we'll infer from the content)</span>
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

      <label className={styles.label}>
        Scope / focus <span className={videoStyles.optional}>(optional)</span>
        <input
          className={styles.input}
          placeholder="e.g. Focus on practical examples, skip theory"
          value={scope}
          onChange={e => setScope(e.target.value)}
        />
      </label>

      <label className={videoStyles.passiveLabel}>
        <input
          type="checkbox"
          checked={passiveLesson}
          onChange={e => setPassiveLesson(e.target.checked)}
        />
        Informational only <span className={videoStyles.optional}>(skip interactive exercises)</span>
      </label>

      {canSelectModels(internalRole, productRole) && (
        <div className={styles.internalControls}>
          <label className={styles.label}>
            Model
            <select
              className={styles.select}
              value={selectedModel}
              onChange={e => onModelChange?.(e.target.value)}
            >
              <optgroup label="Anthropic">
                <option value={MODELS.haiku.id}>Haiku (fast)</option>
                <option value={MODELS.sonnet.id}>Sonnet (better)</option>
                {canSelectOpus(internalRole, productRole) && (
                  <option value={MODELS.opus.id}>Opus (best)</option>
                )}
              </optgroup>
              <optgroup label="Google">
                <option value={MODELS.flash.id}>Flash (fast)</option>
                <option value={MODELS.pro.id}>Pro (better)</option>
              </optgroup>
            </select>
          </label>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}
      {submitting && sourceMode === 'file' && (
        <div className={videoStyles.progressWrap}>
          <div className={videoStyles.progressLabelRow}>
            <span className={videoStyles.progressLabel}>
              {uploadStage === 'uploading'
                ? `Uploading file… ${uploadPercent}%`
                : 'Upload complete. Starting generation…'}
            </span>
          </div>
          <div className={videoStyles.progressTrack} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadPercent}>
            <div className={videoStyles.progressFill} style={{ width: `${uploadPercent}%` }} />
          </div>
        </div>
      )}

      <button
        className={styles.submit}
        disabled={!canSubmit || submitting}
        onClick={handleSubmit}
      >
        {submitting
          ? (sourceMode === 'file' && uploadStage === 'uploading' ? 'Uploading…' : 'Starting generation…')
          : 'Generate lesson →'}
      </button>
    </div>
  )
}
