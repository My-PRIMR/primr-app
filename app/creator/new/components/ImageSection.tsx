'use client'

import { useState, useEffect } from 'react'
import styles from './ImageSection.module.css'

export type ImageLayout = 'beside' | 'above' | 'below'
export type ImageSize = 'small' | 'medium' | 'large'

export interface ImageValue {
  src: string
  alt?: string
  caption?: string
  layout?: ImageLayout
  photographer?: string
  imageSize?: ImageSize
}

const MEDIUM_PX = 480
const SMALL_PX = 240

function getSizeOptions(naturalWidth: number | null): ImageSize[] {
  if (!naturalWidth) return []
  if (naturalWidth > MEDIUM_PX * 1.25) return ['small', 'medium', 'large']
  if (naturalWidth > SMALL_PX * 1.25) return ['small', 'medium']
  return []
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
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [naturalWidth, setNaturalWidth] = useState<number | null>(null)

  // Sync URL input when image.src changes externally (e.g. after Pexels pick)
  useEffect(() => {
    setUrlValue(image?.src ?? '')
  }, [image?.src])

  // Detect natural image width whenever src changes
  useEffect(() => {
    if (!image?.src) { setNaturalWidth(null); return }
    const img = new window.Image()
    img.onload = () => setNaturalWidth(img.naturalWidth)
    img.onerror = () => setNaturalWidth(null)
    img.src = image.src
  }, [image?.src])

  async function doSearch(page = 1) {
    const q = searchQuery.trim()
    if (!q) return
    setSearching(true)
    if (page === 1) setSearchError(false)
    try {
      const res = await fetch('/api/pexels/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, page }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        console.error('[ImageSection] Pexels search error', res.status, text)
        setSearchError(true)
        return
      }
      const data = await res.json()
      setPhotos(data.photos)
      setHasMore(data.hasMore)
      setCurrentPage(page)
    } catch (err) {
      console.error('[ImageSection] Pexels fetch exception', err)
      setSearchError(true)
    } finally {
      setSearching(false)
    }
  }

  function prevPage() { doSearch(currentPage - 1) }
  function nextPage() { doSearch(currentPage + 1) }

  function selectPhoto(photo: PexelsPhoto) {
    const src = blockType === 'step-navigator' ? photo.medium : photo.large
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { imageSize: _, ...rest } = image ?? {}
    onChange({ ...rest, src, alt: searchQuery.trim() || image?.alt, photographer: photo.photographer })
    setPickerOpen(false)
  }

  function handleUrlBlur() {
    const src = urlValue.trim()
    if (!src) {
      onChange(undefined)
    } else if (src !== image?.src) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { imageSize: _, ...rest } = image ?? {}
      onChange({ ...rest, src })
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
            <button type="button" className={styles.clearBtn} onClick={clearImage} title="Remove image">×</button>
          )}
          {canPexels && (
            <button
              type="button"
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
            <button type="button" className={styles.pickerSearchBtn} onClick={() => doSearch()} disabled={searching}>
              {searching ? '…' : 'Search'}
            </button>
          </div>
          {searchError && <div className={styles.pickerError}>Search failed. Try again.</div>}
          {photos.length > 0 && (
            <>
              {currentPage > 1 && (
                <button type="button" className={styles.pickerPageBtn} onClick={prevPage} disabled={searching}>
                  ↑
                </button>
              )}
              <div className={styles.pickerGrid}>
                {photos.map((photo, i) => (
                  <button type="button" key={`${photo.id}-${i}`} className={styles.pickerPhoto} onClick={() => selectPhoto(photo)}>
                    <img src={photo.tiny} alt="" className={styles.pickerPhotoImg} />
                  </button>
                ))}
              </div>
              {hasMore && (
                <button type="button" className={styles.pickerPageBtn} onClick={nextPage} disabled={searching}>
                  ↓
                </button>
              )}
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

          {blockType === 'narrative' && (() => {
            const options = getSizeOptions(naturalWidth)
            if (options.length === 0) return null
            const hasLarge = options.includes('large')
            const currentSize = image.imageSize ?? (hasLarge ? 'large' : 'medium')
            const labels: Record<ImageSize, string> = { small: 'Small', medium: 'Medium', large: 'Large' }
            return (
              <div className={styles.sizeSection}>
                <div className={styles.sizeLabel}>Image size</div>
                <div className={styles.sizeButtons}>
                  {options.map(size => (
                    <button
                      type="button"
                      key={size}
                      className={`${styles.sizeBtn} ${currentSize === size ? styles.sizeBtnActive : ''}`}
                      onClick={() => onChange({ ...image, imageSize: size })}
                    >
                      {labels[size]}
                    </button>
                  ))}
                </div>
              </div>
            )
          })()}

          {blockType === 'step-navigator' && (
            <div className={styles.layoutSection}>
              <div className={styles.layoutLabel}>Image Layout</div>
              <div className={styles.layoutButtons}>
                {(['beside', 'above', 'below'] as ImageLayout[]).map(layout => (
                  <button
                    type="button"
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
