import type { DocumentAsset } from '@/types/outline'
import { uploadBuffer } from '@/lib/cloudinary'

// Minimum screenshot file size to consider a page "visual" (bytes).
// Pages that are blank or text-only produce small PNGs; real figures are larger.
const MIN_IMAGE_BYTES = 30_000

// Maximum pages to screenshot per document to avoid excessive processing.
const MAX_SCREENSHOT_PAGES = 30

/**
 * Create a guaranteed fresh copy of a Buffer for WASM consumption.
 * WASM modules (like LiteParse) transfer (detach) the underlying ArrayBuffer,
 * making the original unusable. ArrayBuffer.slice() always allocates new memory.
 */
function freshCopy(buf: Buffer): Uint8Array {
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  return new Uint8Array(ab)
}

/** Extract text from a PDF buffer using LiteParse with pdf-parse fallback. */
export async function extractTextWithLiteParse(pdfBuffer: Buffer): Promise<string> {
  // Log first 8 bytes so we can verify the PDF header (%PDF-) in production logs
  console.log('[extract] buffer header:', pdfBuffer.slice(0, 8).toString('hex'), 'length:', pdfBuffer.length)
  try {
    const { LiteParse } = await import('@llamaindex/liteparse')
    const parser = new LiteParse({ ocrEnabled: false })
    const result = await parser.parse(freshCopy(pdfBuffer))
    return result.text ?? ''
  } catch (err) {
    console.warn('[extract] LiteParse failed, falling back to pdf-parse:', err instanceof Error ? err.message : err)
    const pdfParseModule = await import('pdf-parse')
    const pdfParse = pdfParseModule.default ?? pdfParseModule
    const result = await (pdfParse as (buf: Buffer) => Promise<{ text: string }>)(pdfBuffer)
    return result.text ?? ''
  }
}

/** Find all YouTube URLs in a block of text (deduped). */
export function extractYouTubeUrls(text: string): string[] {
  const pattern = /https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)[\w\-?=&]+/g
  const matches = text.match(pattern) ?? []
  return [...new Set(matches)]
}

/**
 * Generate a unique Cloudinary public_id for a document image asset.
 * Format: {slug}_p{page}_i{index}_{timestamp}
 */
export function buildPublicId(slug: string, page: number, index: number): string {
  return `${slug}_p${page}_i${index}_${Date.now().toString(36)}`
}

export interface EnrichmentOptions {
  extractImages: boolean
  decodeQr: boolean
  slug: string
}

/**
 * Run the full enrichment pipeline on a PDF buffer.
 * Returns DocumentAsset[] to be stored alongside the extracted text.
 */
export async function enrichPdf(
  pdfBuffer: Buffer,
  opts: EnrichmentOptions
): Promise<DocumentAsset[]> {
  const assets: DocumentAsset[] = []

  const { LiteParse } = await import('@llamaindex/liteparse')
  const parser = new LiteParse({ ocrEnabled: false })

  // Screenshot up to MAX_SCREENSHOT_PAGES pages (1-indexed).
  // We don't know total page count upfront, so pass a page range and let LiteParse cap it.
  const pageRange = Array.from({ length: MAX_SCREENSHOT_PAGES }, (_, i) => i + 1)
  const screenshots = await parser.screenshot(freshCopy(pdfBuffer), pageRange)

  let imageIndex = 0
  for (const shot of screenshots) {
    const { pageNum, imageBuffer } = shot

    // QR decode
    if (opts.decodeQr) {
      const decoded = await tryDecodeQr(imageBuffer)
      if (decoded) {
        if (isYouTubeUrl(decoded)) {
          assets.push({ type: 'video', url: decoded, page: pageNum })
        } else {
          assets.push({ type: 'link', url: decoded, page: pageNum })
        }
        continue // page is a QR — skip image upload
      }
    }

    // Image upload (skip small/blank pages)
    if (opts.extractImages && imageBuffer.length >= MIN_IMAGE_BYTES) {
      const publicId = buildPublicId(opts.slug, pageNum, imageIndex++)
      try {
        const url = await uploadBuffer(imageBuffer, 'png', publicId)
        assets.push({ type: 'image', url, page: pageNum })
      } catch (err) {
        console.error(`[extract/pipeline] Cloudinary upload failed for page ${pageNum}:`, err)
        // Non-fatal: skip this asset
      }
    }
  }

  return assets
}

// ── Helpers ────────────────────────────────────────────────────────────────

function isYouTubeUrl(url: string): boolean {
  return /youtube\.com|youtu\.be/.test(url)
}

async function tryDecodeQr(pngBuf: Buffer): Promise<string | null> {
  try {
    const jsQR = (await import('jsqr')).default
    const { PNG } = await import('pngjs')
    const png = PNG.sync.read(pngBuf)
    const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height)
    return code?.data ?? null
  } catch {
    return null
  }
}
