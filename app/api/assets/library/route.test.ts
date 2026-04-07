import { GET } from './route'
import { NextRequest } from 'next/server'

jest.mock('@/session', () => ({
  getSession: jest.fn().mockResolvedValue({ user: { id: 'user-abc' } }),
}))

jest.mock('fs/promises', () => ({
  readdir: jest.fn(),
}))

import { readdir } from 'fs/promises'
const mockReaddir = readdir as jest.MockedFunction<typeof readdir>

function makeRequest(lessonId?: string): NextRequest {
  const url = lessonId
    ? `http://localhost/api/assets/library?lessonId=${lessonId}`
    : 'http://localhost/api/assets/library'
  return new NextRequest(url)
}

describe('GET /api/assets/library', () => {
  it('returns 400 when lessonId is missing', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(400)
  })

  it('returns empty images when directory does not exist', async () => {
    mockReaddir.mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
    const res = await GET(makeRequest('lesson-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.images).toEqual([])
  })

  it('returns only original files (not variant suffixes)', async () => {
    mockReaddir.mockResolvedValueOnce([
      'abc123.png',
      'abc123_thumb.png',
      'abc123_small.png',
      'abc123_medium.png',
      'abc123_large.png',
      'def456.jpg',
      'def456_thumb.jpg',
      'def456_small.jpg',
      'def456_medium.jpg',
      'def456_large.jpg',
    ] as unknown as Awaited<ReturnType<typeof readdir>>)

    const res = await GET(makeRequest('lesson-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.images).toHaveLength(2)
    expect(body.images[0].url).toBe('/api/assets/user-abc/lesson-1/abc123.png')
    expect(body.images[0].variants.thumb).toBe('/api/assets/user-abc/lesson-1/abc123_thumb.png')
    expect(body.images[0].variants.large).toBe('/api/assets/user-abc/lesson-1/abc123_large.png')
    expect(body.images[1].url).toBe('/api/assets/user-abc/lesson-1/def456.jpg')
  })

  it('returns png variant URLs for gif originals', async () => {
    mockReaddir.mockResolvedValueOnce([
      'gif789.gif',
      'gif789_thumb.png',
      'gif789_small.png',
      'gif789_medium.png',
      'gif789_large.png',
    ] as unknown as Awaited<ReturnType<typeof readdir>>)

    const res = await GET(makeRequest('lesson-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.images).toHaveLength(1)
    expect(body.images[0].url).toBe('/api/assets/user-abc/lesson-1/gif789.gif')
    // Variants are PNG even though the original is GIF
    expect(body.images[0].variants.thumb).toBe('/api/assets/user-abc/lesson-1/gif789_thumb.png')
    expect(body.images[0].variants.large).toBe('/api/assets/user-abc/lesson-1/gif789_large.png')
  })
})
