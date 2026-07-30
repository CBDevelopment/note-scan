export interface PageResult {
  index: number
  markdown?: string
  error?: string
}

export function stitchPages(results: PageResult[], total: number): string {
  const byIndex = new Map(results.map((r) => [r.index, r]))
  const parts: string[] = []

  for (let i = 0; i < total; i++) {
    const r = byIndex.get(i)
    if (!r) continue

    if (r.error) {
      parts.push(`[Page ${i + 1} failed to transcribe]`)
      continue
    }

    const text = (r.markdown ?? '').trim()
    if (!text) continue // blank page

    // Strip leading VLM preamble
    const cleaned = text.replace(/^(here('s| is)|transcription)[^\n]*\n?/i, '').trim()
    // Strip wrapping code fences
    const unfenced = cleaned.replace(/^```[^\n]*\n?([\s\S]*?)```\s*$/, '$1').trim()

    if (!unfenced) continue

    if (parts.length > 0) {
      const prev = parts[parts.length - 1]
      const prevEnd = prev.trimEnd().slice(-1)
      const curStart = unfenced[0]
      // Join with space if prev ends mid-sentence and current starts lowercase
      if (!'.!?'.includes(prevEnd) && curStart === curStart.toLowerCase() && /[a-z]/.test(curStart)) {
        parts[parts.length - 1] = prev.trimEnd() + ' ' + unfenced
      } else {
        parts.push(unfenced)
      }
    } else {
      parts.push(unfenced)
    }
  }

  return parts.join('\n\n')
}

export function derivedTitle(content: string): string {
  const lines = content.split('\n').filter((l) => l.trim())
  if (!lines.length) return 'Untitled scan'

  const heading = lines.find((l) => /^#{1,3}\s/.test(l))
  if (heading) return heading.replace(/^#+\s*/, '').slice(0, 80)

  const words = lines[0].replace(/[#*`>-]/g, '').trim().split(/\s+/).slice(0, 6)
  return words.join(' ') || 'Untitled scan'
}
