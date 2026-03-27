'use client'

import { useState, useEffect } from 'react'
import styles from './ImageSection.module.css'

export type ImageLayout = 'beside' | 'above' | 'below'

export interface ImageValue {
  src: string
  alt?: string
  caption?: string
  layout?: ImageLayout
  photographer?: string
}

interface PexelsPhoto {
  id: number
  tiny: string
  medium: string
  large: string
  photographer: string
}

interface Props {
  blockType: 'hero' | 'narrative' | 'step-navigator'
  image: ImageValue | undefined
  canPexels: boolean
  onChange: (image: ImageValue | undefined) => void
}

export default function ImageSection({ blockType, image, canPexels, onChange }: Props) {
  const [urlValue, setUrlValue] = useState(image?.src ?? '')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [photos, setPhotos] = useState<PexelsPhoto[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(false)

  // Sync URL input when image.src changes externally (e.g. after Pexels pick)
  useEffect(() => {
    setUrlValue(image?.src ?? '')
  }, [image?.src])

  async function doSearch() {
    const q = searchQuery.trim()
    if (!q) return
    setSearching(true)
    setSearchError(false)
    try {
      const res = await fetch('/api/pexels/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })
      if (!res.ok) { setSearchError(true); return }
      const data = await res.json()
      setPhotos(data.photos)
    } catch {
      setSearchError(true)
    } finally {
      setSearching(false)
    }
  }

  function selectPhoto(photo: PexelsPhoto) {
    const src = blockType === 'step-navigator' ? photo.medium : photo.large
    onChange({ ...image, src, alt: searchQuery.trim() || image?.alt, photographer: photo.photographer })
    setPickerOpen(false)
  }

  function handleUrlBlur() {
    const src = urlValue.trim()
    if (!src) {
      onChange(undefined)
    } else if (src !== image?.src) {
      onChange({ ...image, src })
    }
  }

  function clearImage() {
    onChange(undefined)
    setPickerOpen(false)
  }

  const showCaption = blockType === 'narrative' || blockType === 'step-navigator'

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>Image</div>

      {/* Preview card */}
      <div className={styles.card}>
        <div className={styles.preview}>
          {image?.src ? (
            <img src={image.src} alt={image.alt ?? ''} className={styles.previewImg} />
          ) : (
            <div className={styles.previewPlaceholder}>No image · paste URL to add</div>
          )}
        </div>
        <div className={styles.urlRow}>
          <input
            type="text"
            className={styles.urlInput}
            value={urlValue}
            placeholder="Paste image URL…"
            onChange={e => setUrlValue(e.target.value)}
            onBlur={handleUrlBlur}
          />
          {image?.src && (
            <button className={styles.clearBtn} onClick={clearImage} title="Remove image">×</button>
          )}
          {canPexels && (
            <button
              className={`${styles.searchBtn} ${pickerOpen ? styles.searchBtnActive : ''}`}
              onClick={() => setPickerOpen(v => !v)}
              title="Search Pexels"
            >🔍</button>
          )}
        </div>
      </div>

      {/* Pexels picker — expands inline below the card */}
      {canPexels && pickerOpen && (
        <div className={styles.picker}>
          <div className={styles.pickerSearchRow}>
            <input
              type="text"
              className={styles.pickerInput}
              placeholder="Search Pexels…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
            />
            <button className={styles.pickerSearchBtn} onClick={doSearch} disabled={searching}>
              {searching ? '…' : 'Search'}
            </button>
          </div>
          {searchError && <div className={styles.pickerError}>Search failed. Try again.</div>}
          {photos.length > 0 && (
            <>
              <div className={styles.pickerGrid}>
                {photos.map(photo => (
                  <button key={photo.id} className={styles.pickerPhoto} onClick={() => selectPhoto(photo)}>
                    <img src={photo.tiny} alt="" className={styles.pickerPhotoImg} />
                  </button>
                ))}
              </div>
              <div className={styles.pickerCredit}>Click an image to use it · Photos from Pexels</div>
            </>
          )}
        </div>
      )}

      {/* Alt / caption / layout — shown only when image is set */}
      {image?.src && (
        // key forces remount (resetting uncontrolled inputs) when the image src changes
        <div key={image.src} className={styles.imageFields}>
          <label className={styles.fieldLabel}>
            <span>Alt text</span>
            <input
              type="text"
              className={styles.fieldInput}
              defaultValue={image.alt ?? ''}
              placeholder="Describe the image…"
              onBlur={e => onChange({ ...image, alt: e.target.value })}
            />
          </label>

          {showCaption && (
            <label className={styles.fieldLabel}>
              <span>Caption</span>
              <input
                type="text"
                className={styles.fieldInput}
                defaultValue={image.caption ?? ''}
                placeholder="Optional caption…"
                onBlur={e => onChange({ ...image, caption: e.target.value || undefined })}
              />
            </label>
          )}

          {blockType === 'step-navigator' && (
            <div className={styles.layoutSection}>
              <div className={styles.layoutLabel}>Image Layout</div>
              <div className={styles.layoutButtons}>
                {(['beside', 'above', 'below'] as ImageLayout[]).map(layout => (
                  <button
                    key={layout}
                    className={`${styles.layoutBtn} ${(image.layout ?? 'beside') === layout ? styles.layoutBtnActive : ''}`}
                    onClick={() => onChange({ ...image, layout })}
                  >
                    <LayoutIcon layout={layout} />
                    <span className={styles.layoutBtnLabel}>
                      {layout.charAt(0).toUpperCase() + layout.slice(1)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function LayoutIcon({ layout }: { layout: ImageLayout }) {
  if (layout === 'beside') {
    return (
      <div className={styles.layoutIcon}>
        <div className={styles.layoutIconTextLines}>
          <div className={styles.layoutIconLine} />
          <div className={styles.layoutIconLine} />
          <div className={`${styles.layoutIconLine} ${styles.layoutIconLineShort}`} />
        </div>
        <div className={styles.layoutIconImg} />
      </div>
    )
  }
  if (layout === 'above') {
    return (
      <div className={`${styles.layoutIcon} ${styles.layoutIconCol}`}>
        <div className={styles.layoutIconImgWide} />
        <div className={styles.layoutIconTextLines}>
          <div className={styles.layoutIconLine} />
          <div className={styles.layoutIconLine} />
        </div>
      </div>
    )
  }
  // below
  return (
    <div className={`${styles.layoutIcon} ${styles.layoutIconCol}`}>
      <div className={styles.layoutIconTextLines}>
        <div className={styles.layoutIconLine} />
        <div className={styles.layoutIconLine} />
      </div>
      <div className={styles.layoutIconImgWide} />
    </div>
  )
}
