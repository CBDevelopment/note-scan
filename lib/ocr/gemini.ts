import type { OcrResult } from './index'

export async function transcribeWithGemini(
  _imageBase64: string,
  _mimeType: string,
  _previousPageTail?: string
): Promise<OcrResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured')
  }
  // Stub — implement when comparing providers
  throw new Error('Gemini adapter not yet implemented')
}
