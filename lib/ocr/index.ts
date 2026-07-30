import { transcribeWithAnthropic } from './anthropic'
import { transcribeWithMistral } from './mistral'
import { transcribeWithGemini } from './gemini'

export interface OcrResult {
  markdown: string
  inputTokens: number
  outputTokens: number
  model: string
}

export async function transcribePage(
  imageBase64: string,
  mimeType: string,
  opts?: { previousPageTail?: string }
): Promise<OcrResult> {
  const provider = process.env.OCR_PROVIDER ?? 'anthropic'

  switch (provider) {
    case 'anthropic':
      return transcribeWithAnthropic(imageBase64, mimeType, opts?.previousPageTail)
    case 'mistral':
      return transcribeWithMistral(imageBase64, mimeType, opts?.previousPageTail)
    case 'gemini':
      return transcribeWithGemini(imageBase64, mimeType, opts?.previousPageTail)
    default:
      throw new Error(`Unknown OCR_PROVIDER: "${provider}". Valid values: anthropic, mistral, gemini`)
  }
}
