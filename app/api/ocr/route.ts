import { z } from 'zod'
import { auth } from '@/lib/auth'
import { transcribePage } from '@/lib/ocr'
import { checkBudget, recordUsage, BudgetExceededError } from '@/lib/usage'
import { checkRateLimit, recordRateLimit, RateLimitError } from '@/lib/ratelimit'

// 5 MB in base64 chars (~6.7M), rounded up with padding
const MAX_BASE64_CHARS = 7_000_000
const MAX_PAGES = parseInt(process.env.MAX_PAGES_PER_BATCH ?? '30', 10)
const CONCURRENCY = parseInt(process.env.OCR_CONCURRENCY ?? '5', 10)

const VALID_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'] as const

const pageSchema = z.object({
  index: z.number().int().min(0),
  base64: z.string().max(MAX_BASE64_CHARS, 'Image exceeds 5 MB limit'),
  mimeType: z.enum(VALID_MIME),
})

const requestSchema = z.object({
  pages: z.array(pageSchema).min(1).max(MAX_PAGES),
})

type PageInput = z.infer<typeof pageSchema>

// ─── Retry helper ─────────────────────────────────────────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  baseDelayMs = 1000
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      if (attempt === retries) throw err

      const status = (err as { status?: number }).status ?? 0
      const isRetryable = status === 429 || (status >= 500 && status <= 599)
      if (!isRetryable) throw err

      const delay = baseDelayMs * Math.pow(4, attempt) + Math.random() * 500
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  // TypeScript needs this even though the loop always returns/throws
  throw new Error('unreachable')
}

// ─── Promise pool ─────────────────────────────────────────────────────────────

async function runPool(
  tasks: Array<() => Promise<void>>,
  limit: number
): Promise<void> {
  const executing = new Set<Promise<void>>()
  for (const task of tasks) {
    const p: Promise<void> = task().finally(() => executing.delete(p))
    executing.add(p)
    if (executing.size >= limit) await Promise.race(executing)
  }
  await Promise.all(executing)
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // 1. Auth
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id

  // 2. Parse + validate
  let parsed: z.infer<typeof requestSchema>
  try {
    const body = await req.json()
    parsed = requestSchema.parse(body)
  } catch (err) {
    const message = err instanceof z.ZodError ? err.errors[0]?.message : 'Invalid request'
    return Response.json({ error: message }, { status: 400 })
  }

  const { pages } = parsed

  // 3. Rate limit
  try {
    checkRateLimit(userId, pages.length)
  } catch (err) {
    if (err instanceof RateLimitError) {
      return Response.json({ error: err.message }, { status: 429 })
    }
    throw err
  }

  // 4. Budget check
  try {
    await checkBudget()
  } catch (err) {
    if (err instanceof BudgetExceededError) {
      return Response.json({ error: err.message }, { status: 402 })
    }
    throw err
  }

  // 5. Stream NDJSON results
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function emit(obj: object) {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
      }

      let totalInput = 0
      let totalOutput = 0
      let lastModel = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001'

      const tasks = pages.map((page: PageInput) => async () => {
        let result: Awaited<ReturnType<typeof transcribePage>>

        try {
          result = await withRetry(() =>
            transcribePage(page.base64, page.mimeType)
          )
        } catch (err) {
          emit({
            type: 'error',
            index: page.index,
            message: err instanceof Error ? err.message : 'Transcription failed',
          })
          return
        }

        totalInput += result.inputTokens
        totalOutput += result.outputTokens
        lastModel = result.model

        // Record per-page usage
        await recordUsage(userId, result.inputTokens, result.outputTokens, result.model)

        emit({ type: 'page', index: page.index, markdown: result.markdown })
      })

      try {
        await runPool(tasks, CONCURRENCY)
      } finally {
        emit({ type: 'done', inputTokens: totalInput, outputTokens: totalOutput, model: lastModel })
        controller.close()
      }
    },
  })

  // Record rate limit only after we've started processing
  recordRateLimit(userId, pages.length)

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
