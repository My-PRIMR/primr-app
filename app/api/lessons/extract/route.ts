import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/session'
import { canUseRichIngest } from '@/lib/models'
import { extractTextWithLiteParse, extractYouTubeUrls, enrichPdf } from './pipeline'
import type { DocumentAsset } from '@/types/outline'

const MAX_CHARS = 20_000

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const extractImages = formData.get('extractImages') === 'true'
    const decodeQr = formData.get('decodeQr') === 'true'
    const wantEnrichment = extractImages || decodeQr

    // Auth-gate enrichment options; also need userId for local asset stash
    const session = await getSession()
    const userId = session?.user?.id ?? null
    if (wantEnrichment) {
      const plan = session?.user?.plan ?? null
      const internalRole = session?.user?.internalRole ?? null
      if (!canUseRichIngest(plan, internalRole)) {
        return NextResponse.json({ error: 'Rich ingestion requires Creator Pro or higher.' }, { status: 403 })
      }
      if (!userId) {
        return NextResponse.json({ error: 'Authentication required for image extraction.' }, { status: 401 })
      }
    }

    const name = file.name.toLowerCase()
    // Keep raw bytes as an ArrayBuffer. For each LiteParse call we construct a
    // fresh Buffer via Buffer.from(new Uint8Array(bytes)), which copies the data.
    // This is necessary because LiteParse transfers its input's backing ArrayBuffer
    // to a worker thread (detaching it), so each call must receive its own copy.
    const bytes = await file.arrayBuffer()

    let text = ''
    let assets: DocumentAsset[] = []

    if (name.endsWith('.pdf')) {
      text = await extractTextWithLiteParse(Buffer.from(new Uint8Array(bytes)))

      // Always extract hyperlinked YouTube URLs from text (free, no plan check needed)
      const ytUrls = extractYouTubeUrls(text)
      assets.push(...ytUrls.map((url): DocumentAsset => ({ type: 'video', url, page: 0 })))

      // Enrichment: images and/or QR decoding (non-fatal — text extraction already succeeded)
      if (wantEnrichment) {
        try {
          const slug = file.name.replace(/\.pdf$/i, '').replace(/\s+/g, '-').toLowerCase().slice(0, 40)
          const enriched = await enrichPdf(buffer, { extractImages, decodeQr, slug })
          assets.push(...enriched)
        } catch (enrichErr) {
          console.warn('[extract] enrichPdf failed (non-fatal):', enrichErr instanceof Error ? enrichErr.message : enrichErr)
        }
      }
    } else if (name.endsWith('.docx')) {
      const buffer = Buffer.from(new Uint8Array(bytes))
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      text = result.value
    } else if (name.endsWith('.txt') || name.endsWith('.md')) {
      text = Buffer.from(new Uint8Array(bytes)).toString('utf-8')
    } else {
      return NextResponse.json({ error: 'Unsupported file type. Use PDF, DOCX, TXT, or MD.' }, { status: 400 })
    }

    const trimmed = text.trim()
    if (!trimmed) {
      return NextResponse.json({ error: 'Could not extract any text from the file.' }, { status: 422 })
    }

    return NextResponse.json({ text: trimmed.slice(0, MAX_CHARS), assets })
  } catch (err) {
    console.error('[extract] error:', err)
    return NextResponse.json({ error: 'Failed to process file.' }, { status: 500 })
  }
}
