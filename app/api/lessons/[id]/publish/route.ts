import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join, resolve, normalize } from 'path'
import { db } from '@/db'
import { lessons } from '@/db/schema'
import { and, eq, isNotNull, sql } from 'drizzle-orm'
import { getSession } from '@/session'
import { uploadBufferToLesson } from '@/lib/cloudinary'
import { canPublishAnotherLesson, FREE_PUBLISHED_LESSON_LIMIT } from '@/lib/models'
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

  // Enforce Free-tier published-lesson cap. Skip for re-publishing an already-published
  // lesson (same row, so it's already counted).
  if (!lesson.publishedAt) {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(lessons)
      .where(and(eq(lessons.createdBy, userId), isNotNull(lessons.publishedAt)))
    const publishedCount = row?.count ?? 0
    if (!canPublishAnotherLesson(session.user.plan, session.user.internalRole, publishedCount)) {
      return NextResponse.json(
        {
          error: `Free plan is limited to ${FREE_PUBLISHED_LESSON_LIMIT} published lessons. Upgrade to Pro to publish more.`,
          code: 'PUBLISH_LIMIT_REACHED',
        },
        { status: 402 },
      )
    }
  }

  let manifest = lesson.manifest as LessonManifest

  // Upload any locally-stashed images to Cloudinary
  const localUrls = new Set<string>()
  collectLocalUrls(manifest, localUrls)

  if (localUrls.size > 0) {
    const stashRoot = resolve(process.cwd(), 'uploads', 'assets')
    const urlMap = new Map<string, string>()

    for (const localUrl of localUrls) {
      // Support 2-part (legacy: userId/filename) and 3-part (userId/lessonId/filename) paths
      const parts = localUrl.replace(LOCAL_ASSET_PREFIX, '').split('/')
      if (parts.length !== 2 && parts.length !== 3) continue
      const assetUserId = parts[0]
      const filename = parts[parts.length - 1]
      if (assetUserId !== userId) continue

      const filePath = resolve(join(stashRoot, ...parts))
      if (!filePath.startsWith(normalize(stashRoot))) continue

      const ext = filename.split('.').pop() ?? 'png'
      const format = ext === 'jpg' ? 'jpg' : ext === 'gif' ? 'gif' : 'png'
      const baseName = filename.replace(/\.[^.]+$/, '')

      try {
        const data = await readFile(filePath)
        const cloudUrl = await uploadBufferToLesson(data, format as 'png' | 'jpg' | 'gif', id, baseName)
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
