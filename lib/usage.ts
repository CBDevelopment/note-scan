import { gte, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { usage } from '@/lib/db/schema'

// Cost in cents per million tokens
const MODEL_RATES: Record<string, { inputCentsPerMtok: number; outputCentsPerMtok: number }> = {
  'claude-haiku-4-5': { inputCentsPerMtok: 100, outputCentsPerMtok: 500 },
  'claude-haiku-4-5-20251001': { inputCentsPerMtok: 100, outputCentsPerMtok: 500 },
  'claude-sonnet-4-6': { inputCentsPerMtok: 300, outputCentsPerMtok: 1500 },
  'claude-opus-4-8': { inputCentsPerMtok: 1500, outputCentsPerMtok: 7500 },
  'mistral-small-latest': { inputCentsPerMtok: 20, outputCentsPerMtok: 60 },
  'gemini-1.5-flash': { inputCentsPerMtok: 3, outputCentsPerMtok: 12 },
}

const DEFAULT_RATES = { inputCentsPerMtok: 100, outputCentsPerMtok: 500 }

export function computeCostCents(
  inputTokens: number,
  outputTokens: number,
  model: string
): number {
  const rates = MODEL_RATES[model] ?? DEFAULT_RATES
  return (
    (inputTokens * rates.inputCentsPerMtok + outputTokens * rates.outputCentsPerMtok) /
    1_000_000
  )
}

export class BudgetExceededError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BudgetExceededError'
  }
}

export async function checkBudget(): Promise<void> {
  const now = new Date()
  const monthStartMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)

  const rows = await db
    .select({ total: sql<number>`sum(${usage.costCents})` })
    .from(usage)
    .where(gte(usage.createdAt, monthStartMs))

  const totalCents = rows[0]?.total ?? 0
  const budgetCents = parseInt(process.env.MONTHLY_BUDGET_CENTS ?? '2000', 10)

  if (totalCents >= budgetCents) {
    const spent = (totalCents / 100).toFixed(2)
    const budget = (budgetCents / 100).toFixed(0)
    throw new BudgetExceededError(
      `Monthly transcription budget ($${budget}) has been reached ($${spent} used). Try again next month.`
    )
  }
}

export async function recordUsage(
  userId: string,
  inputTokens: number,
  outputTokens: number,
  model: string
): Promise<void> {
  const costCents = computeCostCents(inputTokens, outputTokens, model)
  await db.insert(usage).values({
    userId,
    inputTokens,
    outputTokens,
    costCents,
    createdAt: Date.now(),
  })
}

export async function getMonthlyUsageSummary() {
  const now = new Date()
  const monthStartMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  const budgetCents = parseInt(process.env.MONTHLY_BUDGET_CENTS ?? '2000', 10)

  const rows = await db
    .select({ total: sql<number>`sum(${usage.costCents})` })
    .from(usage)
    .where(gte(usage.createdAt, monthStartMs))

  const totalCents = rows[0]?.total ?? 0
  return {
    spentCents: totalCents,
    budgetCents,
    percentUsed: Math.round((totalCents / budgetCents) * 100),
  }
}
