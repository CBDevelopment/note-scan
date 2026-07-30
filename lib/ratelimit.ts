// In-memory sliding window rate limiter.
// Single-container only — no Redis needed at this scale.

interface Bucket {
  timestamp: number
  pages: number
}

const hourlyBuckets = new Map<string, Bucket[]>()
const dailyBuckets = new Map<string, Bucket[]>()

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

export class RateLimitError extends Error {
  constructor(
    message: string,
    public resetAt?: Date
  ) {
    super(message)
    this.name = 'RateLimitError'
  }
}

function sumPages(buckets: Bucket[], windowMs: number): number {
  const cutoff = Date.now() - windowMs
  return buckets.filter((b) => b.timestamp > cutoff).reduce((acc, b) => acc + b.pages, 0)
}

function prune(buckets: Bucket[], windowMs: number): Bucket[] {
  const cutoff = Date.now() - windowMs
  return buckets.filter((b) => b.timestamp > cutoff)
}

export function checkRateLimit(userId: string, pageCount: number): void {
  const maxHourly = parseInt(process.env.RATE_LIMIT_PAGES_PER_HOUR ?? '60', 10)
  const maxDaily = parseInt(process.env.RATE_LIMIT_PAGES_PER_DAY ?? '300', 10)

  const hourly = prune(hourlyBuckets.get(userId) ?? [], HOUR_MS)
  const daily = prune(dailyBuckets.get(userId) ?? [], DAY_MS)

  const usedHourly = sumPages(hourly, HOUR_MS)
  const usedDaily = sumPages(daily, DAY_MS)

  if (usedHourly + pageCount > maxHourly) {
    const oldest = hourly.find((b) => b.timestamp > Date.now() - HOUR_MS)
    const resetAt = oldest ? new Date(oldest.timestamp + HOUR_MS) : new Date(Date.now() + HOUR_MS)
    throw new RateLimitError(
      `Hourly limit of ${maxHourly} pages reached (${usedHourly} used). Resets at ${resetAt.toLocaleTimeString()}.`,
      resetAt
    )
  }

  if (usedDaily + pageCount > maxDaily) {
    throw new RateLimitError(
      `Daily limit of ${maxDaily} pages reached (${usedDaily} used). Resets tomorrow.`
    )
  }
}

export function recordRateLimit(userId: string, pageCount: number): void {
  const entry: Bucket = { timestamp: Date.now(), pages: pageCount }

  const hourly = prune(hourlyBuckets.get(userId) ?? [], HOUR_MS)
  hourlyBuckets.set(userId, [...hourly, entry])

  const daily = prune(dailyBuckets.get(userId) ?? [], DAY_MS)
  dailyBuckets.set(userId, [...daily, entry])
}
