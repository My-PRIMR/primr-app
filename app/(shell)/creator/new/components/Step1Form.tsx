import { useRef, useState } from 'react'
import type { WizardState } from '@/types/outline'
import type { ContentType } from '@/lib/content-type'
import styles from './Step1Form.module.css'
import { canSelectModels } from '@/lib/models'
import { modelSelectorGroups } from '@/lib/model-select'

function isYouTubeUrl(val: string) {
  return /youtu\.be\/|youtube\.com\/(watch|embed|shorts)/.test(val)
}

interface Props {
  state: WizardState
  onField: (field: string, value: unknown) => void
  onSubmit: () => void
  internalRole?: string | null
  productRole?: string | null
  selectedModel?: string
  onModelChange?: (model: string) => void
  passiveLesson?: boolean
  onPassiveLessonChange?: (v: boolean) => void
  includeImages?: boolean
  onIncludeImagesChange?: (v: boolean) => void
  /** Whether the current user may use enriched PDF ingestion (pro+). */
  canRichIngest?: boolean
  /** Current content category selection. */
  contentType?: ContentType
  /** Callback when content category changes. */
  onContentTypeChange?: (ct: ContentType) => void
  /** Whether the current user may select academic/STEM categories (teacher+). */
  canStemGen?: boolean
  /** 'lesson' (default) shows lesson-specific copy; 'course' for future use. */
  mode?: 'lesson' | 'course'
}

const EXAMPLES = [
  { title: 'How TCP/IP Handshakes Work', topic: 'Explain the three-way handshake in TCP, how connections are established and torn down, and common issues.' },
  { title: 'The Basics of Compound Interest', topic: 'Teach the concept of compound interest, the formula, and how it applies to savings and debt.' },
  { title: 'Introduction to Git Branching', topic: 'Cover creating branches, merging, rebasing, and resolving merge conflicts in Git.' },
]

export default function Step1Form({
  state, onField, onSubmit, internalRole, productRole,
  selectedModel, onModelChange,
  passiveLesson, onPassiveLessonChange,
  includeImages, onIncludeImagesChange,
  canRichIngest = false,
  contentType = 'general',
  onContentTypeChange,
  canStemGen = false,
  mode = 'lesson',
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')
  const [isPasting, setIsPasting] = useState(false)

  const videoUrlValid = isYouTubeUrl(state.videoUrl.trim())
  const hasSources = (state.videoUrl.trim() && videoUrlValid) || !!state.documentText
  const canSubmit = state.topic.trim() || hasSources
  const showStructureToggle = videoUrlValid && !!state.documentText

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setExtracting(true)
    setExtractError('')
    onField('documentText', '')
    onField('documentName', '')
    onField('documentAssets', [])

    const form = new FormData()
    form.append('file', file)
    if (canRichIngest && file.name.toLowerCase().endsWith('.pdf')) {
      form.append('extractImages', String(state.extractImages))
      form.append('decodeQr', String(state.decodeQr))
    }

    const res = await fetch('/api/lessons/extract', { method: 'POST', body: form })
    const data = await res.json()

    setExtracting(false)

    if (!res.ok) {
      setExtractError(data.error || 'Failed to read file.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    onField('documentText', data.text)
    onField('documentName', file.name)
    onField('documentAssets', data.assets ?? [])
  }

  function clearDocument() {
    onField('documentText', '')
    onField('documentName', '')
    onField('documentAssets', [])
    if (fileInputRef.current) fileInputRef.current.value = ''
    setIsPasting(false)
  }

  const submitLabel = mode === 'lesson' ? 'Generate lesson →' : 'Generate course →'

  return (
    <div className={styles.form}>
      <h1 className={styles.heading}>Create a new lesson</h1>
      <p className={styles.sub}>Upload a document or add a YouTube video — we'll generate a lesson for you to review.</p>

      {/* ── Source document ── */}
      <div className={styles.uploadSection}>
        <span className={styles.uploadLabel}>Source document <span className={styles.optional}>(optional)</span></span>

        {!isPasting ? (
          <>
            <p className={styles.uploadHint}>Upload a PDF, DOCX, TXT, or MD file — content will be used as source material.</p>

            {!state.documentName && canRichIngest && (
              <div className={styles.enrichmentOptions}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={state.extractImages}
                    onChange={e => onField('extractImages', e.target.checked)}
                    className={styles.checkbox}
                  />
                  Extract images from PDF
                  <span className={styles.enrichmentNote}> — adds ~30–60s</span>
                </label>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={state.decodeQr}
                    onChange={e => onField('decodeQr', e.target.checked)}
                    className={styles.checkbox}
                  />
                  Decode QR codes (e.g. embedded YouTube videos)
                  <span className={styles.enrichmentNote}> — adds ~10s</span>
                </label>
              </div>
            )}

            {!state.documentName && !canRichIngest && (
              <p className={styles.proNote}>
                <span className={styles.proBadge}>Pro</span>
                {' '}Upgrade to extract images and QR-encoded videos from PDFs.
              </p>
            )}

            {state.documentName ? (
              <div className={styles.uploadedFile}>
                <span className={styles.uploadedName}>{state.documentName}</span>
                <button type="button" className={styles.clearFile} onClick={clearDocument}>Remove</button>
              </div>
            ) : (
              <>
                <label className={styles.uploadBtn}>
                  {extracting ? 'Reading file…' : 'Choose file'}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.txt,.md"
                    className={styles.fileInput}
                    onChange={handleFile}
                    disabled={extracting}
                  />
                </label>
                <button
                  type="button"
                  className={styles.pasteToggle}
                  onClick={() => setIsPasting(true)}
                >
                  Or paste text instead →
                </button>
              </>
            )}

            {extractError && <p className={styles.error}>{extractError}</p>}
          </>
        ) : (
          <>
            <button
              type="button"
              className={styles.pasteToggle}
              onClick={() => { setIsPasting(false); onField('documentText', ''); setExtractError('') }}
            >
              ← Back to file upload
            </button>
            <textarea
              className={`${styles.textarea} ${styles.pasteTextarea}`}
              placeholder="Paste your content here — article, notes, training material..."
              value={state.documentText}
              onChange={e => onField('documentText', e.target.value)}
            />
          </>
        )}
      </div>

      {/* ── YouTube URL ── */}
      <label className={styles.label}>
        YouTube URL <span className={styles.optional}>(optional)</span>
        <input
          className={styles.input}
          type="url"
          placeholder="https://www.youtube.com/watch?v=..."
          value={state.videoUrl}
          onChange={e => onField('videoUrl', e.target.value)}
        />
        {state.videoUrl.trim() && !videoUrlValid && (
          <span className={styles.fieldError}>Please enter a valid YouTube URL</span>
        )}
      </label>

      {/* ── Structure source toggle (when both doc + video present) ── */}
      {showStructureToggle && (
        <div className={styles.uploadSection}>
          <span className={styles.uploadLabel}>Lesson structure source</span>
          <div className={styles.structureToggle}>
            <label className={`${styles.structureOption} ${state.structureSource === 'document' ? styles.structureOptionActive : ''}`}>
              <input
                type="radio"
                name="structureSource"
                value="document"
                checked={state.structureSource === 'document'}
                onChange={() => onField('structureSource', 'document')}
                className={styles.srOnly}
              />
              <span className={styles.structureOptionTitle}>Document</span>
              <span className={styles.structureOptionHint}>Structure from doc · video as supplement</span>
            </label>
            <label className={`${styles.structureOption} ${state.structureSource === 'video' ? styles.structureOptionActive : ''}`}>
              <input
                type="radio"
                name="structureSource"
                value="video"
                checked={state.structureSource === 'video'}
                onChange={() => onField('structureSource', 'video')}
                className={styles.srOnly}
              />
              <span className={styles.structureOptionTitle}>Video</span>
              <span className={styles.structureOptionHint}>Structure from video · doc text as supplement</span>
            </label>
          </div>
        </div>
      )}

      {/* ── Title ── */}
      <label className={styles.label}>
        Lesson title <span className={styles.optional}>(optional — inferred from content if blank)</span>
        <input
          className={styles.input}
          placeholder="e.g. How TCP/IP Handshakes Work"
          value={state.title}
          onChange={e => onField('title', e.target.value)}
        />
      </label>

      {/* ── Topic ── */}
      <label className={styles.label}>
        What should this lesson teach? <span className={styles.optional}>(optional)</span>
        <textarea
          className={styles.textarea}
          placeholder={hasSources ? 'Additional context or focus areas…' : "Describe the topic, key concepts to cover, and any specific examples you'd like to include..."}
          value={state.topic}
          onChange={e => onField('topic', e.target.value)}
          rows={4}
        />
      </label>

      {/* ── Audience + Level ── */}
      <div className={styles.row}>
        <label className={styles.label}>
          Audience <span className={styles.optional}>(optional)</span>
          <input
            className={styles.input}
            placeholder="e.g. Junior developers"
            value={state.audience}
            onChange={e => onField('audience', e.target.value)}
          />
        </label>

        <label className={styles.label}>
          Level
          <select
            className={styles.select}
            value={state.level}
            onChange={e => onField('level', e.target.value)}
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>
      </div>

      {/* ── Content category ── */}
      <label className={styles.label}>
        Content category
        <select
          className={styles.select}
          value={contentType}
          onChange={e => onContentTypeChange?.(e.target.value as ContentType)}
        >
          <option value="general">General / Professional</option>
          <option value="stem_math" disabled={!canStemGen}>
            STEM — Mathematics{!canStemGen ? ' (Teacher+)' : ''}
          </option>
          <option value="stem_science" disabled={!canStemGen}>
            STEM — Science{!canStemGen ? ' (Teacher+)' : ''}
          </option>
          <option value="language_arts" disabled={!canStemGen}>
            Language Arts / Academic{!canStemGen ? ' (Teacher+)' : ''}
          </option>
        </select>
      </label>
      {!canStemGen && (
        <p className={styles.proNote}>
          <span className={styles.proBadge}>Teacher</span>
          {' '}Upgrade to Creator Teacher or Pro to generate STEM or academic lessons with enhanced accuracy.
        </p>
      )}

      {/* ── Scope ── */}
      <label className={styles.label}>
        Scope / focus <span className={styles.optional}>(optional)</span>
        <input
          className={styles.input}
          placeholder="e.g. Focus on practical examples, skip theory"
          value={state.scope}
          onChange={e => onField('scope', e.target.value)}
        />
      </label>

      {/* ── Internal controls ── */}
      {canSelectModels(internalRole, productRole) && (
        <div className={styles.internalControls}>
          <label className={styles.label}>
            Model
            <select
              className={styles.select}
              value={selectedModel}
              onChange={e => onModelChange?.(e.target.value)}
            >
              {modelSelectorGroups(internalRole, productRole).map(group => (
                <optgroup key={group.provider} label={group.providerLabel}>
                  {group.options.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={passiveLesson}
              onChange={e => onPassiveLessonChange?.(e.target.checked)}
              className={styles.checkbox}
            />
            Informational only (no interactive content)
          </label>

          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={includeImages}
              onChange={e => onIncludeImagesChange?.(e.target.checked)}
              className={styles.checkbox}
            />
            Include images (Pexels)
          </label>
        </div>
      )}

      {/* ── Examples ── */}
      <div className={styles.examples}>
        <span className={styles.examplesLabel}>Try an example:</span>
        {EXAMPLES.map(ex => (
          <button
            key={ex.title}
            type="button"
            className={styles.exampleChip}
            onClick={() => { onField('title', ex.title); onField('topic', ex.topic) }}
          >
            {ex.title}
          </button>
        ))}
      </div>

      {state.error && <p className={styles.error}>{state.error}</p>}

      <button
        className={styles.submit}
        disabled={!canSubmit}
        onClick={onSubmit}
      >
        {submitLabel}
      </button>
    </div>
  )
}
