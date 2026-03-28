import { extractYouTubeUrls, buildPublicId } from './pipeline'

describe('extractYouTubeUrls', () => {
  it('finds youtube.com/watch URLs in text', () => {
    const text = 'See https://www.youtube.com/watch?v=dQw4w9WgXcQ for details.'
    expect(extractYouTubeUrls(text)).toEqual(['https://www.youtube.com/watch?v=dQw4w9WgXcQ'])
  })

  it('finds youtu.be short URLs in text', () => {
    const text = 'Watch at https://youtu.be/dQw4w9WgXcQ today'
    expect(extractYouTubeUrls(text)).toEqual(['https://youtu.be/dQw4w9WgXcQ'])
  })

  it('returns empty array when no YouTube URLs present', () => {
    expect(extractYouTubeUrls('No links here.')).toEqual([])
  })

  it('deduplicates repeated URLs', () => {
    const text = 'https://youtu.be/abc https://youtu.be/abc'
    expect(extractYouTubeUrls(text)).toHaveLength(1)
  })
})

describe('buildPublicId', () => {
  it('returns a string with lessonId prefix', () => {
    const id = buildPublicId('lesson-abc', 3, 0)
    expect(id).toMatch(/^lesson-abc_p3_i0/)
  })
})
