import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join, resolve, normalize } from 'path'
import { createHash } from 'crypto'
import { getSession } from '@/session'
import { generateVariants } from '@/lib/image-variants'

const ALLOWED_TYPES: Record<string, string> = {
  'image/png':  'png',
  'image/jpeg': 'jpg',
  'image/gif':  'gif',
}

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id

  const formData = await req.formData()
  const file = formData.get('file')
  const lessonId = formData.get('lessonId')

  if (typeof lessonId !== 'string' || !lessonId.trim()) {
    return NextResponse.json({ error: 'lessonId is required' }, { status: 400 })
  }

  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const mimeType = file.type
  const ext = ALLOWED_TYPES[mimeType]
  if (!ext) {
    return NextResponse.json(
      { error: 'Unsupported file type. Only PNG, JPEG, and GIF are allowed.' },
      { status: 400 }
    )
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  if (bytes.length > MAX_BYTES) {
    return NextResponse.json(
      { error: 'File size exceeds the 10 MB limit.' },
      { status: 400 }
    )
  }

  const hash = createHash('sha256').update(bytes).digest('hex')
  const filename = `${hash}.${ext}`

  const stashRoot = resolve(process.cwd(), 'uploads', 'assets')
  const lessonDir = resolve(join(stashRoot, userId, lessonId))
  // Guard against path traversal
  if (!lessonDir.startsWith(normalize(stashRoot))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await mkdir(lessonDir, { recursive: true })
  await writeFile(join(lessonDir, filename), bytes)

  // Generate and write variants (gif converted to png via sharp)
  const variantMime = mimeType === 'image/gif' ? 'image/png' : mimeType
  const variantExt  = variantMime === 'image/jpeg' ? 'jpg' : 'png'
  const variants = await generateVariants(bytes, variantMime)

  await Promise.all(
    (['thumb', 'small', 'medium', 'large'] as const).map((size) =>
      writeFile(join(lessonDir, `${hash}_${size}.${variantExt}`), variants[size])
    )
  )

  const base = `/api/assets/${userId}/${lessonId}/${hash}`
  return NextResponse.json({
    url: `${base}.${ext}`,
    variants: {
      thumb:  `${base}_thumb.${variantExt}`,
      small:  `${base}_small.${variantExt}`,
      medium: `${base}_medium.${variantExt}`,
      large:  `${base}_large.${variantExt}`,
    },
  })
}
