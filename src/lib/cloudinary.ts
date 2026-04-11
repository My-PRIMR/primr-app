import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export type UploadFormat = 'png' | 'jpg' | 'webp' | 'pdf' | 'gif'

/**
 * Upload a Buffer to Cloudinary under the primr_documents folder.
 * Returns the stable HTTPS URL.
 * @deprecated Prefer uploadBufferToLesson for lesson images.
 */
export function uploadBuffer(
  buf: Buffer,
  format: UploadFormat,
  publicId: string
): Promise<string> {
  const resource_type = format === 'pdf' ? 'raw' : 'image'
  // Don't pass `format` for raw resources — Cloudinary ignores it for raw
  // uploads but it can cause delivery errors when appended to the URL.
  const uploadOpts = resource_type === 'raw'
    ? { folder: 'primr_documents', public_id: publicId, resource_type } as const
    : { folder: 'primr_documents', public_id: publicId, format, resource_type } as const
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      uploadOpts,
      (err, result) => {
        if (err || !result) return reject(err ?? new Error('Cloudinary upload returned no result'))
        resolve(result.secure_url)
      }
    )
    stream.end(buf)
  })
}

/**
 * Upload a Buffer to Cloudinary under primr_lessons/{lessonId}/{filename}.
 * Returns the stable HTTPS URL.
 */
export function uploadBufferToLesson(
  buf: Buffer,
  format: UploadFormat,
  lessonId: string,
  filename: string
): Promise<string> {
  const publicId = `primr_lessons/${lessonId}/${filename}`
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { public_id: publicId, format, resource_type: 'image' },
      (err, result) => {
        if (err || !result) return reject(err ?? new Error('Cloudinary upload returned no result'))
        resolve(result.secure_url)
      }
    )
    stream.end(buf)
  })
}
