/**
 * Unit tests for the upload route handler.
 * Mocks fs/promises and image-variants to avoid real disk I/O.
 */
import { POST } from './route'
import { NextRequest } from 'next/server'

jest.mock('@/session', () => ({
  getSession: jest.fn().mockResolvedValue({ user: { id: 'user-abc' } }),
}))

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/image-variants', () => ({
  generateVariants: jest.fn().mockResolvedValue({
    thumb:  Buffer.from('thumb'),
    small:  Buffer.from('small'),
    medium: Buffer.from('medium'),
    large:  Buffer.from('large'),
  }),
}))

function makeRequest(formData: FormData): NextRequest {
  return new NextRequest('http://localhost/api/assets/upload', {
    method: 'POST',
    body: formData,
  })
}

describe('POST /api/assets/upload', () => {
  it('returns 400 when lessonId is missing', async () => {
    const fd = new FormData()
    fd.append('file', new Blob([Buffer.from('x')], { type: 'image/png' }), 'x.png')
    const res = await POST(makeRequest(fd))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/lessonId/i)
  })

  it('returns 400 for disallowed MIME type', async () => {
    const fd = new FormData()
    fd.append('file', new Blob([Buffer.from('hello')], { type: 'text/plain' }), 'file.txt')
    fd.append('lessonId', 'lesson-1')
    const res = await POST(makeRequest(fd))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/type/i)
  })

  it('returns 400 when file exceeds 10 MB', async () => {
    const big = Buffer.alloc(11 * 1024 * 1024)
    const fd = new FormData()
    fd.append('file', new Blob([big], { type: 'image/png' }), 'big.png')
    fd.append('lessonId', 'lesson-1')
    const res = await POST(makeRequest(fd))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/size/i)
  })

  it('returns url and variants for a valid PNG upload', async () => {
    const fd = new FormData()
    fd.append('file', new Blob([Buffer.from('fakepng')], { type: 'image/png' }), 'photo.png')
    fd.append('lessonId', 'lesson-1')
    const res = await POST(makeRequest(fd))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toMatch(/^\/api\/assets\/user-abc\/lesson-1\//)
    expect(body.url).toMatch(/\.png$/)
    expect(body.variants.thumb).toMatch(/\.png$/)
    expect(body.variants.small).toMatch(/\.png$/)
    expect(body.variants.medium).toMatch(/\.png$/)
    expect(body.variants.large).toMatch(/\.png$/)
  })
})
