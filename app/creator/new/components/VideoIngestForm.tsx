'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './Step1Form.module.css'
import videoStyles from './VideoIngestForm.module.css'

export default function VideoIngestForm() {
  const router = useRouter()

  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [audience, setAudience] = useState('')
  const [level, setLevel] = useState('beginner')
  const [submitting, setSubmitting] = useState(false)
  const [uploadPercent, setUploadPercent] = useState(0)
  const [uploadStage, setUploadStage] = useState<'idle' | 'uploading' | 'processing'>('idle')
  const [error, setError] = useState('')
  const fileValid = !!file

  async function handleSubmit() {
    if (!fileValid) return
    setSubmitting(true)
    setError('')
    setUploadPercent(0)
    setUploadStage('uploading')
    const form = new FormData()
    form.append('file', file)
    if (title.trim()) form.append('title', title.trim())
    if (audience.trim()) form.append('audience', audience.trim())
    form.append('level', level)

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
        Upload a video or audio file. We will transcribe it and generate a full lesson.
      </p>

      <label className={styles.label}>
        Source file
        <input
          className={styles.input}
          type="file"
          accept=".mp4,.mov,.m4v,.webm,.mkv,.mp3,.m4a,.wav,.aac,.ogg"
          onChange={e => {
            setFile(e.target.files?.[0] ?? null)
            setError('')
          }}
          autoFocus
        />
        <span className={videoStyles.optional}>Accepted: mp4, mov, webm, mkv, mp3, m4a, wav, aac, ogg (max 1GB)</span>
      </label>

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

      {error && <p className={styles.error}>{error}</p>}
      {submitting && (
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
        disabled={!fileValid || submitting}
        onClick={handleSubmit}
      >
        {submitting ? 'Uploading…' : 'Generate lesson from file →'}
      </button>
    </div>
  )
}
