import sharp from 'sharp'
import { VARIANT_WIDTHS, THUMB_WIDTH } from './image-size-config'
import type { ImageSize } from './image-size-config'

export interface ImageVariants {
  thumb: Buffer
  small: Buffer
  medium: Buffer
  large: Buffer
}

const SIZES: ImageSize[] = ['small', 'medium', 'large']

/**
 * Generate thumb/small/medium/large variants from an image buffer.
 * Each variant is width-constrained, never upscaled.
 * Output format matches the input MIME type (jpeg or png); gif is converted to png.
 */
export async function generateVariants(
  input: Buffer,
  mimeType: string
): Promise<ImageVariants> {
  const isJpeg = mimeType === 'image/jpeg'

  const makeVariant = (maxWidth: number) => {
    let pipeline = sharp(input).resize({ width: maxWidth, withoutEnlargement: true })
    pipeline = isJpeg ? pipeline.jpeg({ quality: 85 }) : pipeline.png({ compressionLevel: 8 })
    return pipeline.toBuffer()
  }

  const [thumb, small, medium, large] = await Promise.all([
    makeVariant(THUMB_WIDTH),
    ...SIZES.map(size => makeVariant(VARIANT_WIDTHS[size])),
  ])

  return { thumb, small, medium, large }
}
