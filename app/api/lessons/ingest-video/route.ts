import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { lessons } from '@/db/schema'
import { getSession } from '@/session'
import { runVideoIngestion } from '@/lib/video-ingest'
import { resolveModel } from '@/lib/models'
import type { LessonManifest } from '@primr/components'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { randomUUID } from 'node:crypto'

const MAX_UPLOAD_BYTES = 1024 * 1024 * 1024 // 1GB
const ALLOWED_EXTENSIONS = new Set([
  '.mp4', '.mov', '.m4v', '.webm', '.mkv',
  '.mp3', '.m4a', '.wav', '.aac', '.ogg',
])

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function isYouTubeUrl(url: string): boolean {
  return /youtu\.be\/|youtube\.com\/(watch|embed|shorts)/.test(url)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id
  const internalRole = session.user.internalRole ?? null
  const productRole = session.user.productRole ?? null

  // ── Detect content type: JSON (URL) vs multipart (file upload) ────────────
  const contentType = req.headers.get('content-type') ?? ''
  const isJson = contentType.includes('application/json')

  let videoUrl: string | undefined
  let file: File | undefined
  let title: string | undefined
  let audience: string | undefined
  let level: string | undefined
  let scope: string | undefined
  let modelId: string | undefined
  let passiveLesson: boolean = false

  if (isJson) {
    const body = await req.json() as Record<string, string | boolean>
    videoUrl = (body.url as string)?.trim() || undefined
    title = (body.title as string)?.trim() || undefined
    audience = (body.audience as string)?.trim() || undefined
    level = (body.level as string)?.trim() || undefined
    scope = (body.scope as string)?.trim() || undefined
    modelId = (body.model as string)?.trim() || undefined
    passiveLesson = body.passiveLesson === true || body.passiveLesson === 'true'

    if (!videoUrl) return NextResponse.json({ error: 'url is required' }, { status: 400 })
    if (!isYouTubeUrl(videoUrl)) return NextResponse.json({ error: 'Only YouTube URLs are supported' }, { status: 400 })
  } else {
    const form = await req.formData()
    const fileRaw = form.get('file')
    title = typeof form.get('title') === 'string' ? (form.get('title') as string).trim() || undefined : undefined
    audience = typeof form.get('audience') === 'string' ? (form.get('audience') as string).trim() || undefined : undefined
    level = typeof form.get('level') === 'string' ? (form.get('level') as string).trim() || undefined : undefined
    scope = typeof form.get('scope') === 'string' ? (form.get('scope') as string).trim() || undefined : undefined
    modelId = typeof form.get('model') === 'string' ? (form.get('model') as string).trim() || undefined : undefined
    passiveLesson = form.get('passiveLesson') === 'true'

    if (!(fileRaw instanceof File)) return NextResponse.json({ error: 'file is required' }, { status: 400 })
    if (fileRaw.size === 0) return NextResponse.json({ error: 'uploaded file is empty' }, { status: 400 })
    if (fileRaw.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: 'file is too large (max 1GB)' }, { status: 400 })
    const ext = extname(fileRaw.name || 'upload.bin').toLowerCase()
    if (!ALLOWED_EXTENSIONS.has(ext)) return NextResponse.json({ error: 'unsupported file type' }, { status: 400 })
    file = fileRaw
  }

  let resolvedModel = resolveModel(undefined, internalRole, productRole)!
  if (modelId) {
    const m = resolveModel(modelId, internalRole, productRole)
    if (!m) return NextResponse.json({ error: 'Unauthorized model selection' }, { status: 403 })
    resolvedModel = m
  }

  // ── Create placeholder lesson ─────────────────────────────────────────────
  const pendingTitle = title || (videoUrl ? 'Processing YouTube video…' : 'Processing video…')
  const slug = `${slugify(pendingTitle)}-${Math.random().toString(36).slice(2, 7)}`
  const placeholderManifest: LessonManifest = { id: 'pending', title: pendingTitle, slug, blocks: [] }

  const [lesson] = await db.insert(lessons).values({
    slug,
    title: pendingTitle,
    manifest: placeholderManifest,
    createdBy: userId,
    sourceVideoUrl: videoUrl ?? `upload://${file!.name}`,
    generationStatus: 'pending',
  }).returning()

  // ── Fire-and-forget pipeline ──────────────────────────────────────────────
  if (videoUrl) {
    runVideoIngestion({ lessonId: lesson.id, videoUrl, title, audience, level, scope, model: resolvedModel.id, passiveLesson })
      .catch(err => console.error(`[ingest-video] Unhandled error for ${lesson.id}:`, err))
  } else {
    const uploadDir = process.env.LOCAL_VIDEO_UPLOAD_DIR?.trim() || '/tmp/primr-video-uploads'
    await mkdir(uploadDir, { recursive: true })
    const ext = extname(file!.name || 'upload.bin').toLowerCase()
    const storedPath = join(uploadDir, `${Date.now()}-${randomUUID()}${ext}`)
    await writeFile(storedPath, new Uint8Array(await file!.arrayBuffer()))

    runVideoIngestion({ lessonId: lesson.id, localFilePath: storedPath, sourceLabel: file!.name, title, audience, level, scope, model: resolvedModel.id, passiveLesson })
      .catch(err => console.error(`[ingest-video] Unhandled error for ${lesson.id}:`, err))
  }

  return NextResponse.json({ id: lesson.id, status: 'processing' }, { status: 202 })
}
