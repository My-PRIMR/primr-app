import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { lessons } from '@/db/schema'
import { auth } from '@/auth'
import { runVideoIngestion } from '@/lib/video-ingest'
import type { LessonManifest } from '@primr/components'

// Reuse the same URL parser logic as MediaBlock (server-side, no React)
function isSupportedVideoUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') return true
    if (u.hostname.includes('youtube.com') && (u.searchParams.get('v') || u.pathname.startsWith('/embed/'))) return true
    if (u.hostname.includes('vimeo.com')) return true
    return false
  } catch {
    return false
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id

  const body = await req.json()
  const url: string | undefined = body.url
  const title: string | undefined = body.title?.trim() || undefined
  const audience: string | undefined = body.audience?.trim() || undefined
  const level: string | undefined = body.level?.trim() || undefined

  if (!url?.trim()) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }

  if (!isSupportedVideoUrl(url)) {
    return NextResponse.json(
      { error: 'Unsupported video URL. Provide a YouTube or Vimeo link.' },
      { status: 400 }
    )
  }

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
    sourceVideoUrl: url,
    generationStatus: 'pending',
  }).returning()

  // Fire-and-forget background pipeline
  runVideoIngestion({ lessonId: lesson.id, videoUrl: url, title, audience, level }).catch(err => {
    console.error(`[ingest-video] Unhandled pipeline error for ${lesson.id}:`, err)
  })

  return NextResponse.json({ id: lesson.id, status: 'processing' }, { status: 202 })
}
