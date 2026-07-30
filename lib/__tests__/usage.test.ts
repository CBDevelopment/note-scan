import { describe, it, expect } from 'vitest'
import { computeCostCents } from '../usage'

describe('computeCostCents', () => {
  it('computes haiku costs correctly', () => {
    // 1M input + 1M output at $1/$5 per Mtok = 600 cents total
    expect(computeCostCents(1_000_000, 1_000_000, 'claude-haiku-4-5-20251001')).toBeCloseTo(600)
  })

  it('handles small token counts', () => {
    // 1000 input tokens at $1/Mtok = 1000 * 100 / 1_000_000 = 0.1 cents
    expect(computeCostCents(1000, 0, 'claude-haiku-4-5-20251001')).toBeCloseTo(0.1)
  })

  it('defaults to haiku rates for unknown model', () => {
    const known = computeCostCents(5000, 2000, 'claude-haiku-4-5-20251001')
    const unknown = computeCostCents(5000, 2000, 'some-future-model')
    expect(unknown).toBeCloseTo(known)
  })

  it('uses correct rates for each provider', () => {
    // Haiku: 100 cents input, 500 cents output per Mtok
    const haiku = computeCostCents(1_000_000, 0, 'claude-haiku-4-5-20251001')
    expect(haiku).toBeCloseTo(100)

    // Mistral-small: 20 cents input per Mtok
    const mistral = computeCostCents(1_000_000, 0, 'mistral-small-latest')
    expect(mistral).toBeCloseTo(20)
  })

  it('budget boundary: 1 cent cap', () => {
    // A realistic small transcription: ~500 input, ~300 output tokens
    const cost = computeCostCents(500, 300, 'claude-haiku-4-5-20251001')
    expect(cost).toBeGreaterThan(0)
    expect(cost).toBeLessThan(1) // well under 1 cent for a single page
  })
})
