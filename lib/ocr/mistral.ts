import type { OcrResult } from './index'

export async function transcribeWithMistral(
  _imageBase64: string,
  _mimeType: string,
  _previousPageTail?: string
): Promise<OcrResult> {
  if (!process.env.MISTRAL_API_KEY) {
    throw new Error('MISTRAL_API_KEY is not configured')
  }
  // Stub — implement when comparing providers
  throw new Error('Mistral adapter not yet implemented')
}
