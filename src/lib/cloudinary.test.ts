import { uploadBuffer } from './cloudinary'

jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: jest.fn((_opts: unknown, cb: (err: unknown, result: unknown) => void) => {
        const mockResult = { secure_url: 'https://res.cloudinary.com/test/image/upload/v1/primr_documents/abc123.png' }
        process.nextTick(() => cb(null, mockResult))
        return { end: jest.fn() }
      }),
    },
  },
}))

describe('uploadBuffer', () => {
  it('returns a stable HTTPS URL on success', async () => {
    const buf = Buffer.from('fake-png-data')
    const url = await uploadBuffer(buf, 'png', 'test-asset')
    expect(url).toMatch(/^https:\/\/res\.cloudinary\.com\//)
  })

  it('rejects when cloudinary returns an error', async () => {
    const { v2: cloudinary } = require('cloudinary')
    cloudinary.uploader.upload_stream.mockImplementationOnce(
      (_opts: unknown, cb: (err: unknown, result: unknown) => void) => {
        process.nextTick(() => cb(new Error('upload failed'), null))
        return { end: jest.fn() }
      }
    )
    const buf = Buffer.from('fake-png-data')
    await expect(uploadBuffer(buf, 'png', 'fail-asset')).rejects.toThrow('upload failed')
  })
})
