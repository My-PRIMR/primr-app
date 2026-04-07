import sharp from 'sharp'
import { VARIANT_WIDTHS } from './image-size-config'
import type { ImageSize } from './image-size-config'

export interface ImageVariants {
  small: Buffer
  medium: Buffer
  large: Buffer
}

const SIZES: ImageSize[] = ['small', 'medium', 'large']

/**
 * Generate small/medium/large variants from an image buffer.
 * Each variant is width-constrained to VARIANT_WIDTHS[size], never upscaled.
 * Output format matches the input MIME type (jpeg or png); gif is converted to png.
 */
export async function generateVariants(
  input: Buffer,
  mimeType: string
): Promise<ImageVariants> {
  const isJpeg = mimeType === 'image/jpeg'
  const variants = await Promise.all(
    SIZES.map(async (size) => {
      const maxWidth = VARIANT_WIDTHS[size]
      let pipeline = sharp(input).resize({ width: maxWidth, withoutEnlargement: true })
      pipeline = isJpeg ? pipeline.jpeg({ quality: 85 }) : pipeline.png({ compressionLevel: 8 })
      return pipeline.toBuffer()
    })
  )
  return { small: variants[0], medium: variants[1], large: variants[2] }
}
