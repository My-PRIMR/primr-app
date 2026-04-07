import { generateVariants } from './image-variants'
import sharp from 'sharp'

// Create a minimal 100x100 PNG buffer for testing
async function makePng(w: number, h: number): Promise<Buffer> {
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: 100, g: 150, b: 200 } } })
    .png()
    .toBuffer()
}

describe('generateVariants', () => {
  it('generates small, medium, large variants from a large image', async () => {
    const input = await makePng(2000, 1000)
    const result = await generateVariants(input, 'image/png')
    expect(result.small).toBeDefined()
    expect(result.medium).toBeDefined()
    expect(result.large).toBeDefined()

    const smallMeta = await sharp(result.small).metadata()
    const mediumMeta = await sharp(result.medium).metadata()
    const largeMeta = await sharp(result.large).metadata()

    expect(smallMeta.width).toBeLessThanOrEqual(320)
    expect(mediumMeta.width).toBeLessThanOrEqual(640)
    expect(largeMeta.width).toBeLessThanOrEqual(1280)
  })

  it('does not upscale an image smaller than the variant width', async () => {
    const input = await makePng(200, 100)
    const result = await generateVariants(input, 'image/png')
    const smallMeta = await sharp(result.small).metadata()
    expect(smallMeta.width).toBeLessThanOrEqual(200)
  })

  it('outputs jpeg for jpeg input', async () => {
    const input = await sharp({ create: { width: 400, height: 400, channels: 3, background: { r: 0, g: 0, b: 0 } } })
      .jpeg().toBuffer()
    const result = await generateVariants(input, 'image/jpeg')
    const meta = await sharp(result.small).metadata()
    expect(meta.format).toBe('jpeg')
  })

  it('generates a thumb variant at 100px max width', async () => {
    const input = await makePng(2000, 1000)
    const result = await generateVariants(input, 'image/png')
    expect(result.thumb).toBeDefined()
    const thumbMeta = await sharp(result.thumb).metadata()
    expect(thumbMeta.width).toBeLessThanOrEqual(100)
  })
})
