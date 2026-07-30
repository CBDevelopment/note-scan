import Anthropic from '@anthropic-ai/sdk'
import type { OcrResult } from './index'
import { buildPrompt } from './prompt'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001'

export async function transcribeWithAnthropic(
  imageBase64: string,
  mimeType: string,
  previousPageTail?: string
): Promise<OcrResult> {
  const prompt = buildPrompt(previousPageTail)

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: prompt,
          },
        ],
      },
    ],
  })

  const markdown =
    response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('') ?? ''

  return {
    markdown,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    model: response.model,
  }
}
