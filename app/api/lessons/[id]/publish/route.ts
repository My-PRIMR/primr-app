import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join, resolve, normalize } from 'path'
import { db } from '@/db'
import { lessons } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/session'
import { uploadBuffer } from '@/lib/cloudinary'
import type { LessonManifest } from '@primr/components'

const LOCAL_ASSET_PREFIX = '/api/assets/'

function collectLocalUrls(obj: unknown, urls: Set<string>): void {
  if (typeof obj === 'string') {
    if (obj.startsWith(LOCAL_ASSET_PREFIX)) urls.add(obj)
    return
  }
  if (Array.isArray(obj)) { obj.forEach(v => collectLocalUrls(v, urls)); return }
  if (obj && typeof obj === 'object') {
    Object.values(obj as Record<string, unknown>).forEach(v => collectLocalUrls(v, urls))
  }
}

function deepReplaceUrls(obj: unknown, map: Map<string, string>): unknown {
  if (typeof obj === 'string') return map.get(obj) ?? obj
  if (Array.isArray(obj)) return obj.map(v => deepReplaceUrls(v, map))
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, deepReplaceUrls(v, map)])
    )
  }
  return obj
}

/** POST — publish the lesson: upload any local images to Cloudinary, set publishedAt. */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const { id } = await params
  const [lesson] = await db.select().from(lessons).where(eq(lessons.id, id)).limit(1)
  if (!lesson) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
  if (lesson.createdBy !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Note: publish/unpublish are intentionally allowed on system content. Visibility is
  // operational metadata, not educational content — admins must be able to flip it.

  let manifest = lesson.manifest as LessonManifest

  // Upload any locally-stashed images to Cloudinary
  const localUrls = new Set<string>()
  collectLocalUrls(manifest, localUrls)

  if (localUrls.size > 0) {
    const stashRoot = resolve(process.cwd(), 'uploads', 'assets')
    const urlMap = new Map<string, string>()

    for (const localUrl of localUrls) {
      const parts = localUrl.replace(LOCAL_ASSET_PREFIX, '').split('/')
      if (parts.length !== 2) continue
      const [assetUserId, filename] = parts
      if (assetUserId !== userId) continue

      const filePath = resolve(join(stashRoot, assetUserId, filename))
      if (!filePath.startsWith(normalize(stashRoot))) continue

      try {
        const data = await readFile(filePath)
        const publicId = `primr_documents/${assetUserId}_${filename.replace('.png', '')}`
        const cloudUrl = await uploadBuffer(data, 'png', publicId)
        urlMap.set(localUrl, cloudUrl)
        console.log(`[publish] ${localUrl} → ${cloudUrl}`)
      } catch (err) {
        console.error(`[publish] failed to upload ${localUrl}:`, err)
        return NextResponse.json({ error: 'Failed to upload one or more images to Cloudinary.' }, { status: 500 })
      }
    }

    manifest = deepReplaceUrls(manifest, urlMap) as LessonManifest
  }

  const publishedAt = new Date()
  await db.update(lessons)
    .set({ manifest, publishedAt, updatedAt: publishedAt })
    .where(eq(lessons.id, id))

  return NextResponse.json({ publishedAt: publishedAt.toISOString() })
}

/** DELETE — unpublish the lesson (revert to draft). */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const { id } = await params
  const [lesson] = await db.select().from(lessons).where(eq(lessons.id, id)).limit(1)
  if (!lesson) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
  if (lesson.createdBy !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Allowed on system content (visibility metadata, see POST handler comment).

  await db.update(lessons)
    .set({ publishedAt: null, updatedAt: new Date() })
    .where(eq(lessons.id, id))

  return NextResponse.json({ ok: true })
}
