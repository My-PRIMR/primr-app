import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join, resolve, normalize } from 'path'
import { getSession } from '@/session'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params

  // path[0] = userId, path[1] = filename
  if (path.length !== 2) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const [userId, filename] = path

  // Only allow .png files (all extracted images are saved as PNG)
  if (!filename.endsWith('.png')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Auth: the requesting user must own this asset
  const session = await getSession()
  const sessionUserId = session?.user?.id ?? null
  const internalRole = session?.user?.internalRole ?? null
  if (sessionUserId !== userId && internalRole == null) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Resolve file path and guard against path traversal
  const stashRoot = resolve(process.cwd(), 'uploads', 'assets')
  const filePath = resolve(join(stashRoot, userId, filename))
  if (!filePath.startsWith(normalize(stashRoot))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const data = await readFile(filePath)
    return new NextResponse(data, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'private, max-age=86400',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
