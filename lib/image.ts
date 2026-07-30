const MAX_LONG_EDGE = 1600
const JPEG_QUALITY = 0.85

export interface PreparedPage {
  id: string
  base64: string
  mimeType: 'image/jpeg'
  previewUrl: string  // object URL — revoke when page is removed
  filename: string
  sizeKb: number
}

export async function preparePage(file: File, id: string): Promise<PreparedPage> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error(
      `Cannot decode "${file.name}". ` +
      (file.name.match(/\.(heic|heif)$/i)
        ? 'HEIC format is not supported on this browser — try sharing as JPEG from Photos.'
        : 'The image format could not be read.')
    )
  }

  const { width, height } = bitmap
  const scale = Math.min(1, MAX_LONG_EDGE / Math.max(width, height))
  const w = Math.round(width * scale)
  const h = Math.round(height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error(`Failed to compress "${file.name}"`))
          return
        }
        const previewUrl = URL.createObjectURL(blob)
        const reader = new FileReader()
        reader.onload = () => {
          const dataUrl = reader.result as string
          const base64 = dataUrl.split(',')[1]
          resolve({
            id,
            base64,
            mimeType: 'image/jpeg',
            previewUrl,
            filename: file.name,
            sizeKb: Math.round(blob.size / 1024),
          })
        }
        reader.onerror = () => reject(new Error(`Failed to read "${file.name}"`))
        reader.readAsDataURL(blob)
      },
      'image/jpeg',
      JPEG_QUALITY
    )
  })
}

export function releasePage(page: PreparedPage) {
  URL.revokeObjectURL(page.previewUrl)
}
