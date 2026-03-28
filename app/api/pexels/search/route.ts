import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/session'
import { canUsePexels } from '@/lib/models'

interface PexelsPhoto {
  id: number
  src: { tiny: string; medium: string; large: string }
  photographer: string
}

interface PexelsResponse {
  photos: PexelsPhoto[]
  next_page?: string
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { plan, internalRole } = session.user
  if (!canUsePexels(plan, internalRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const query = typeof body.query === 'string' ? body.query.trim() : ''
  if (!query) {
    return NextResponse.json({ error: 'query is required' }, { status: 400 })
  }
  if (query.length > 200) {
    return NextResponse.json({ error: 'query too long' }, { status: 400 })
  }
  const page = typeof body.page === 'number' && body.page >= 1 ? Math.floor(body.page) : 1

  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Pexels not configured' }, { status: 503 })
  }

  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=15&orientation=landscape&page=${page}`
  const res = await fetch(url, { headers: { Authorization: apiKey } })

  if (!res.ok) {
    return NextResponse.json({ error: 'Pexels search failed' }, { status: 502 })
  }

  const data: PexelsResponse = await res.json()
  const photos = data.photos.map(p => ({
    id: p.id,
    tiny: p.src.tiny,
    medium: p.src.medium,
    large: p.src.large,
    photographer: p.photographer,
  }))

  return NextResponse.json({ photos, hasMore: !!data.next_page })
}
