import { writeFile, unlink, mkdir, access } from 'fs/promises'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { createHash } from 'crypto'
import type { DocumentAsset } from '@/types/outline'

// Minimum embedded image dimension (px) to skip icons, bullets, decorations.
const MIN_IMAGE_DIM = 100

// Maximum pages to screenshot per document when scanning for QR codes.
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
    const pdfParse = await import('pdf-parse') as unknown as (buf: Buffer) => Promise<{ text: string }>
    const result = await pdfParse(pdfBuffer)
    return result.text ?? ''
  }
}

/** Find all YouTube URLs in a block of text (deduped). */
export function extractYouTubeUrls(text: string): string[] {
  const pattern = /https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)[\w\-?=&]+/g
  const matches = text.match(pattern) ?? []
  return [...new Set(matches)]
}

export interface EnrichmentOptions {
  extractImages: boolean
  decodeQr: boolean
  slug: string
  /** Session user ID — used to scope the local asset stash directory. */
  userId: string
}

/**
 * Run the full enrichment pipeline on a PDF buffer.
 * - extractImages: extracts embedded raster images via pdfjs-dist
 * - decodeQr: takes page screenshots via LiteParse and scans for QR codes
 */
export async function enrichPdf(
  pdfBuffer: Buffer,
  opts: EnrichmentOptions
): Promise<DocumentAsset[]> {
  const assets: DocumentAsset[] = []

  if (opts.extractImages) {
    const images = await extractEmbeddedImages(pdfBuffer)
    console.log(`[extract/pipeline] found ${images.length} embedded images across all pages`)

    // Screenshot up to MAX_SCREENSHOT_PAGES pages (1-indexed).
    // We don't know total page count upfront, so pass a page range and let LiteParse cap it.
    const pageRange = Array.from({ length: MAX_SCREENSHOT_PAGES }, (_, i) => i + 1)
    const screenshots = await parser.screenshot(freshCopy(pdfBuffer), pageRange)
    const stashDir = resolve(process.cwd(), 'uploads', 'assets', opts.userId)
    await mkdir(stashDir, { recursive: true })

    for (const { page, pngBuffer } of images) {
      // Content-addressed filename — same image from same or different PDF reuses the stashed file
      const hash = createHash('sha256').update(pngBuffer).digest('hex').slice(0, 32)
      const filename = `${hash}.png`
      const filePath = join(stashDir, filename)

      // Only write if not already stashed
      const exists = await access(filePath).then(() => true).catch(() => false)
      if (!exists) {
        await writeFile(filePath, pngBuffer)
        console.log(`[extract/pipeline] page ${page}: stashed ${filename} (${pngBuffer.length} bytes)`)
      } else {
        console.log(`[extract/pipeline] page ${page}: reusing stashed ${filename}`)
      }

      assets.push({ type: 'image', url: `/api/assets/${opts.userId}/${filename}`, page })
    }
  }

  if (opts.decodeQr) {
    // QR codes may be vector graphics (not raster images), so we need page screenshots.
    // Write to temp file to avoid pdfjs ArrayBuffer-transfer issues in screenshot().
    const { LiteParse } = await import('@llamaindex/liteparse')
    const parser = new LiteParse({ ocrEnabled: false })
    const tmpPath = join(tmpdir(), `primr_${randomBytes(8).toString('hex')}.pdf`)
    let screenshots: Awaited<ReturnType<InstanceType<typeof LiteParse>['screenshot']>>
    try {
      await writeFile(tmpPath, pdfBuffer)
      const pageRange = Array.from({ length: MAX_SCREENSHOT_PAGES }, (_, i) => i + 1)
      screenshots = await parser.screenshot(tmpPath, pageRange)
      console.log(`[extract/pipeline] QR scan: got ${screenshots.length} page screenshots`)
    } finally {
      await unlink(tmpPath).catch(() => {})
    }

    for (const { pageNum, imageBuffer } of screenshots) {
      const decoded = await tryDecodeQr(imageBuffer)
      if (decoded) {
        console.log(`[extract/pipeline] page ${pageNum}: QR decoded → ${decoded}`)
        if (isYouTubeUrl(decoded)) {
          assets.push({ type: 'video', url: decoded, page: pageNum })
        } else {
          assets.push({ type: 'link', url: decoded, page: pageNum })
        }
      }
    }
  }

  console.log(`[extract/pipeline] enrichment done: ${assets.length} assets (${assets.filter(a => a.type === 'image').length} images, ${assets.filter(a => a.type === 'video').length} videos, ${assets.filter(a => a.type === 'link').length} links)`)
  return assets
}

// ── Embedded image extraction ───────────────────────────────────────────────

interface ExtractedImage {
  page: number
  pngBuffer: Buffer
}

/**
 * Extract all embedded raster images from a PDF using pdfjs-dist.
 * Skips images smaller than MIN_IMAGE_DIM in either dimension (icons, bullets, etc.).
 */
async function extractEmbeddedImages(pdfBuffer: Buffer): Promise<ExtractedImage[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { getDocument, GlobalWorkerOptions, ImageKind } = await import('pdfjs-dist/legacy/build/pdf.mjs') as any
  // Point to the worker file — empty string isn't accepted by pdfjs v5.
  // process.cwd() is the Next.js project root where node_modules lives.
  GlobalWorkerOptions.workerSrc = `file://${resolve(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')}`

  const pdf = await getDocument({
    data: new Uint8Array(pdfBuffer),
    verbosity: 0,
  }).promise
  console.log(`[extract/pipeline] pdfjs loaded ${pdf.numPages} pages for image extraction`)

  const { default: sharp } = await import('sharp')
  const results: ExtractedImage[] = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    // getOperatorList triggers loading of all image XObjects into page.objs
    await page.getOperatorList()

    for (const [name, imgData] of page.objs) {
      if (!imgData?.data || !imgData.width || !imgData.height) continue
      // Only handle RGB and RGBA raster images
      if (imgData.kind !== ImageKind.RGB_24BPP && imgData.kind !== ImageKind.RGBA_32BPP) continue
      // Skip small images (icons, watermarks, decorations)
      if (imgData.width < MIN_IMAGE_DIM || imgData.height < MIN_IMAGE_DIM) continue

      console.log(`[extract/pipeline] page ${pageNum}: image ${name} ${imgData.width}×${imgData.height} kind=${imgData.kind === ImageKind.RGB_24BPP ? 'RGB' : 'RGBA'}`)

      const channels: 3 | 4 = imgData.kind === ImageKind.RGB_24BPP ? 3 : 4
      try {
        // imgData.data is a Uint8ClampedArray — may be a view into a larger buffer
        const raw = Buffer.from(imgData.data.buffer, imgData.data.byteOffset, imgData.data.byteLength)
        const pngBuffer = await sharp(raw, {
          raw: { width: imgData.width, height: imgData.height, channels },
        }).png({ compressionLevel: 6 }).toBuffer()

        results.push({ page: pageNum, pngBuffer })
      } catch (err) {
        console.error(`[extract/pipeline] page ${pageNum}: failed to convert image ${name}:`, err)
      }
    }

    page.cleanup()
  }

  return results
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
