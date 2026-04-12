'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import styles from './ImageSection.module.css'
import type { ImageSizeConfig } from '@/lib/image-size-config'

export type ImageLayout = 'beside' | 'above' | 'below'
export type { ImageSize } from '@/lib/image-size-config'
import type { ImageSize } from '@/lib/image-size-config'

export interface ImageValue {
  src: string
  alt?: string
  caption?: string
  layout?: ImageLayout
  photographer?: string
  imageSize?: ImageSize
  variants?: {
    thumb?: string
    small?: string
    medium?: string
    large?: string
  }
}

interface PexelsPhoto {
  id: number
  tiny: string
  medium: string
  large: string
  photographer: string
}

interface LibraryImage {
  url: string
  variants: {
    thumb?: string
    small?: string
    medium?: string
    large?: string
  }
}

interface Props {
  sizeConfig: ImageSizeConfig
  showCaption?: boolean
  showLayout?: boolean
  lessonId: string
  image: ImageValue | undefined
  canPexels: boolean
  onChange: (image: ImageValue | undefined) => void
}

export default function ImageSection({ sizeConfig, showCaption, showLayout, lessonId, image, canPexels, onChange }: Props) {
  const [activeTab, setActiveTab] = useState<'url' | 'upload' | 'pexels'>('url')
  const [urlValue, setUrlValue] = useState(image?.src ?? '')
  // Pexels state
  const [searchQuery, setSearchQuery] = useState('')
  const [photos, setPhotos] = useState<PexelsPhoto[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  // Upload/library state
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [library, setLibrary] = useState<LibraryImage[]>([])
  const [libraryLoading, setLibraryLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sync URL input when image.src changes externally (e.g. after Pexels pick)
  useEffect(() => {
    setUrlValue(image?.src ?? '')
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
    const src = photo.large
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { imageSize: _, variants: __, ...rest } = image ?? {}
    onChange({ ...rest, src, alt: searchQuery.trim() || image?.alt, photographer: photo.photographer })
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
  }

  const fetchLibrary = useCallback(async () => {
    setLibraryLoading(true)
    try {
      const res = await fetch(`/api/assets/library?lessonId=${encodeURIComponent(lessonId)}`)
      if (res.ok) {
        const data = await res.json() as { images: LibraryImage[] }
        setLibrary(data.images)
      }
    } catch {
      // silent fail — library shows empty
    } finally {
      setLibraryLoading(false)
    }
  }, [lessonId])

  useEffect(() => {
    if (activeTab === 'upload') {
      fetchLibrary()
    }
  }, [activeTab, fetchLibrary])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)

    const ALLOWED = ['image/png', 'image/jpeg', 'image/gif']
    if (!ALLOWED.includes(file.type)) {
      setUploadError('Only PNG, JPEG, and GIF files are supported.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File must be under 10 MB.')
      return
    }

    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('lessonId', lessonId)
      const res = await fetch('/api/assets/upload', { method: 'POST', body: fd })
      if (!res.ok) {
        setUploadError('Upload failed. Please try again.')
        return
      }
      await fetchLibrary()
    } catch {
      setUploadError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file || !fileInputRef.current) return
    const dt = new DataTransfer()
    dt.items.add(file)
    fileInputRef.current.files = dt.files
    fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }))
  }

  function selectFromLibrary(img: LibraryImage) {
    const hasSizes = sizeConfig.sizes.length > 0
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { imageSize: _, variants: __, ...rest } = image ?? {}
    const newImage: ImageValue = {
      ...rest,
      src: hasSizes ? (img.variants.large ?? img.url) : img.url,
      variants: img.variants,
      ...(hasSizes ? { imageSize: 'large' as const } : {}),
    }
    onChange(newImage)
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>Image</div>

      {/* Tab strip */}
      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === 'url' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('url')}
        >URL</button>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === 'upload' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('upload')}
        >Upload</button>
        {canPexels && (
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'pexels' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('pexels')}
          >Pexels</button>
        )}
      </div>

      {/* URL tab */}
      {activeTab === 'url' && (
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
          </div>
        </div>
      )}

      {/* Upload tab */}
      {activeTab === 'upload' && (
        <>
          {/* Drop zone */}
          <div
            className={`${styles.dropZone} ${uploading ? styles.dropZoneUploading : ''}`}
            onClick={() => !uploading && fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif"
              className={styles.fileInput}
              onChange={handleFileChange}
            />
            {uploading ? (
              <div className={styles.dropZoneSpinner}>Uploading…</div>
            ) : (
              <>
                <div className={styles.dropZoneIcon}>↑</div>
                <div className={styles.dropZoneLabel}>Drop an image here or click to browse</div>
                <div className={styles.dropZoneHint}>PNG, JPEG, GIF · max 10 MB</div>
              </>
            )}
          </div>
          {uploadError && <div className={styles.uploadError}>{uploadError}</div>}

          {/* Image library picker */}
          <div className={styles.librarySection}>
            <div className={styles.libraryLabel}>Uploaded images</div>
            {libraryLoading ? (
              <div className={styles.libraryEmpty}>Loading…</div>
            ) : library.length === 0 ? (
              <div className={styles.libraryEmpty}>No images uploaded yet</div>
            ) : (
              <div className={styles.libraryGrid}>
                {library.map((img) => (
                  <button
                    type="button"
                    key={img.url}
                    className={`${styles.libraryThumb} ${image?.variants?.thumb === img.variants.thumb ? styles.libraryThumbActive : ''}`}
                    onClick={() => selectFromLibrary(img)}
                    title="Use this image"
                  >
                    <img
                      src={img.variants.thumb ?? img.url}
                      alt=""
                      className={styles.libraryThumbImg}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Pexels tab */}
      {activeTab === 'pexels' && canPexels && (
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
                <button type="button" className={styles.pickerPageBtn} onClick={prevPage} disabled={searching}>↑</button>
              )}
              <div className={styles.pickerGrid}>
                {photos.map((photo, i) => (
                  <button type="button" key={`${photo.id}-${i}`} className={styles.pickerPhoto} onClick={() => selectPhoto(photo)}>
                    <img src={photo.tiny} alt="" className={styles.pickerPhotoImg} />
                  </button>
                ))}
              </div>
              {hasMore && (
                <button type="button" className={styles.pickerPageBtn} onClick={nextPage} disabled={searching}>↓</button>
              )}
              <div className={styles.pickerCredit}>Click an image to use it · Photos from Pexels</div>
            </>
          )}
        </div>
      )}

      {/* Alt / caption / size / layout — shown when image is set */}
      {image?.src && (
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

          {sizeConfig.sizes.length > 0 && image.variants && (
            <div className={styles.sizeSection}>
              <div className={styles.sizeLabel}>Image size</div>
              <div className={styles.sizeButtons}>
                {sizeConfig.sizes.map(size => {
                  const currentSize = image.imageSize ?? 'large'
                  const labels: Record<ImageSize, string> = { small: 'Small', medium: 'Medium', large: 'Large' }
                  return (
                    <button
                      type="button"
                      key={size}
                      className={`${styles.sizeBtn} ${currentSize === size ? styles.sizeBtnActive : ''}`}
                      onClick={() => {
                        const variantUrl = image.variants?.[size]
                        if (variantUrl) onChange({ ...image, imageSize: size, src: variantUrl })
                      }}
                    >{labels[size]}</button>
                  )
                })}
              </div>
            </div>
          )}

          {showLayout && (
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
