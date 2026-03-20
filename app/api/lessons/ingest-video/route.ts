import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { lessons } from '@/db/schema'
import { getSession } from '@/session'
import { runVideoIngestion } from '@/lib/video-ingest'
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

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id

  const form = await req.formData()
  const file = form.get('file')
  const titleRaw = form.get('title')
  const audienceRaw = form.get('audience')
  const levelRaw = form.get('level')

  const title = typeof titleRaw === 'string' ? titleRaw.trim() || undefined : undefined
  const audience = typeof audienceRaw === 'string' ? audienceRaw.trim() || undefined : undefined
  const level = typeof levelRaw === 'string' ? levelRaw.trim() || undefined : undefined

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 })
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'uploaded file is empty' }, { status: 400 })
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'file is too large (max 1GB)' }, { status: 400 })
  }

  const originalName = file.name || 'upload.bin'
  const ext = extname(originalName).toLowerCase()
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json({ error: 'unsupported file type' }, { status: 400 })
  }

  const uploadDir = process.env.LOCAL_VIDEO_UPLOAD_DIR?.trim() || '/tmp/primr-video-uploads'
  await mkdir(uploadDir, { recursive: true })
  const storedFileName = `${Date.now()}-${randomUUID()}${ext}`
  const storedPath = join(uploadDir, storedFileName)
  const bytes = await file.arrayBuffer()
  await writeFile(storedPath, new Uint8Array(bytes))

  // Create a placeholder lesson so we can return an ID immediately
  const pendingTitle = title || 'Processing video…'
  const slug = `${slugify(pendingTitle)}-${Math.random().toString(36).slice(2, 7)}`
  const placeholderManifest: LessonManifest = {
    id: 'pending',
    title: pendingTitle,
    slug,
    blocks: [],
  }

  const [lesson] = await db.insert(lessons).values({
    slug,
    title: pendingTitle,
    manifest: placeholderManifest,
    createdBy: userId,
    sourceVideoUrl: `upload://${originalName}`,
    generationStatus: 'pending',
  }).returning()

  // Fire-and-forget background pipeline
  runVideoIngestion({
    lessonId: lesson.id,
    localFilePath: storedPath,
    sourceLabel: originalName,
    title,
    audience,
    level,
  }).catch(err => {
    console.error(`[ingest-video] Unhandled pipeline error for ${lesson.id}:`, err)
  })

  return NextResponse.json({ id: lesson.id, status: 'processing' }, { status: 202 })
}
