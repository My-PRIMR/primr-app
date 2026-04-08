import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join, resolve, normalize } from 'path'
import { getSession } from '@/session'
import { canAccessLesson } from '@/lib/lesson-access'

const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.gif']

function contentType(filename: string): string {
  if (filename.endsWith('.jpg')) return 'image/jpeg'
  if (filename.endsWith('.gif')) return 'image/gif'
  return 'image/png'
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params

  // Support 2-part paths (legacy: userId/filename) and 3-part paths (userId/lessonId/filename)
  if (path.length !== 2 && path.length !== 3) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const userId = path[0]
  const filename = path[path.length - 1]

  if (!ALLOWED_EXTENSIONS.some(ext => filename.endsWith(ext))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Auth: the requesting user must own this asset, be internal staff,
  // or (for 3-part paths) be able to access the lesson the asset belongs to
  const session = await getSession()
  const sessionUserId = session?.user?.id ?? null
  const internalRole = session?.user?.internalRole ?? null
  if (sessionUserId !== userId && internalRole == null) {
    if (path.length === 3 && sessionUserId && session?.user?.email) {
      const lessonId = path[1]
      const hasAccess = await canAccessLesson(lessonId, sessionUserId, session.user.email, internalRole)
      if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Resolve file path and guard against path traversal
  const stashRoot = resolve(process.cwd(), 'uploads', 'assets')
  const filePath = resolve(join(stashRoot, ...path))
  if (!filePath.startsWith(normalize(stashRoot))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const data = await readFile(filePath)
    return new NextResponse(data, {
      headers: {
        'Content-Type': contentType(filename),
        'Cache-Control': 'private, max-age=86400',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
