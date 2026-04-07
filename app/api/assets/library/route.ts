import { NextRequest, NextResponse } from 'next/server'
import { readdir } from 'fs/promises'
import { join, resolve, normalize } from 'path'
import { getSession } from '@/session'

const VARIANT_SUFFIXES = ['_thumb', '_small', '_medium', '_large']
const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.gif']

function isOriginal(filename: string): boolean {
  const extIdx = filename.lastIndexOf('.')
  if (extIdx === -1) return false
  const ext = filename.slice(extIdx)
  if (!ALLOWED_EXTENSIONS.includes(ext)) return false
  const base = filename.slice(0, extIdx)
  return !VARIANT_SUFFIXES.some(suffix => base.endsWith(suffix))
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id

  const { searchParams } = new URL(req.url)
  const lessonId = searchParams.get('lessonId')
  if (!lessonId) {
    return NextResponse.json({ error: 'lessonId is required' }, { status: 400 })
  }

  const stashRoot = resolve(process.cwd(), 'uploads', 'assets')
  const lessonDir = resolve(join(stashRoot, userId, lessonId))
  if (!lessonDir.startsWith(normalize(stashRoot))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let filenames: string[]
  try {
    filenames = (await readdir(lessonDir)) as string[]
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ images: [] })
    }
    throw err
  }

  const images = filenames
    .filter(isOriginal)
    .map((filename) => {
      const extIdx = filename.lastIndexOf('.')
      const base = filename.slice(0, extIdx)
      const ext = filename.slice(extIdx + 1)
      const prefix = `/api/assets/${userId}/${lessonId}/${base}`
      return {
        url: `/api/assets/${userId}/${lessonId}/${filename}`,
        variants: {
          thumb:  `${prefix}_thumb.${ext}`,
          small:  `${prefix}_small.${ext}`,
          medium: `${prefix}_medium.${ext}`,
          large:  `${prefix}_large.${ext}`,
        },
      }
    })

  return NextResponse.json({ images })
}
