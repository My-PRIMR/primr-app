export type ImageSize = 'small' | 'medium' | 'large'

export interface ImageSizeConfig {
  /** Which size variants to offer in the UI. Empty = no size selector. */
  sizes: ImageSize[]
}

export const IMAGE_SIZE_CONFIG: Record<string, ImageSizeConfig> = {
  hero:              { sizes: [] },
  narrative:         { sizes: ['small', 'medium', 'large'] },
  'step-navigator':  { sizes: [] },
}

/** Max pixel widths for each variant (width-constrained, aspect ratio preserved). */
export const VARIANT_WIDTHS: Record<ImageSize, number> = {
  small:  320,
  medium: 640,
  large:  1280,
}

export const THUMB_WIDTH = 100
