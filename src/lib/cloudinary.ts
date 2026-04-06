import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export type UploadFormat = 'png' | 'jpg' | 'webp' | 'pdf'

/**
 * Upload a Buffer to Cloudinary under the primr_documents folder.
 * Returns the stable HTTPS URL.
 */
export function uploadBuffer(
  buf: Buffer,
  format: UploadFormat,
  publicId: string
): Promise<string> {
  const resource_type = format === 'pdf' ? 'raw' : 'image'
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'primr_documents', public_id: publicId, format, resource_type },
      (err, result) => {
        if (err || !result) return reject(err ?? new Error('Cloudinary upload returned no result'))
        resolve(result.secure_url)
      }
    )
    stream.end(buf)
  })
}
