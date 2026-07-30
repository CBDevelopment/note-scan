import { google, type docs_v1 } from 'googleapis'

type GDocsRequest = docs_v1.Schema$Request

// ─── Inline markdown parser ───────────────────────────────────────────────────

export interface Run {
  text: string
  bold?: boolean
  italic?: boolean
}

export function parseInlineRuns(raw: string): Run[] {
  const runs: Run[] = []
  // Order matters: *** before ** before *
  const re = /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*/g
  let last = 0
  let m: RegExpExecArray | null

  while ((m = re.exec(raw)) !== null) {
    if (m.index > last) runs.push({ text: raw.slice(last, m.index) })
    if (m[1]) runs.push({ text: m[1], bold: true, italic: true })
    else if (m[2]) runs.push({ text: m[2], bold: true })
    else if (m[3]) runs.push({ text: m[3], italic: true })
    last = m.index + m[0].length
  }

  if (last < raw.length) runs.push({ text: raw.slice(last) })
  return runs.length ? runs : [{ text: raw }]
}

// ─── Document-level element ───────────────────────────────────────────────────

export type ElementType = 'heading' | 'paragraph' | 'bullet' | 'numbered'

export interface DocElement {
  type: ElementType
  level?: number        // 1–3 for headings
  indent: number        // nesting depth for lists
  runs: Run[]
  // plainText has leading \t chars for indented list items so Google Docs
  // detects nesting automatically in createParagraphBullets.
  plainText: string
}

export function parseMarkdown(content: string): DocElement[] {
  const elements: DocElement[] = []

  for (const line of content.split('\n')) {
    if (!line.trim()) continue

    let m: RegExpMatchArray | null

    if ((m = line.match(/^(#{1,3})\s+(.*)/))) {
      const runs = parseInlineRuns(m[2])
      elements.push({ type: 'heading', level: m[1].length, indent: 0, runs, plainText: runs.map(r => r.text).join('') })
      continue
    }

    if ((m = line.match(/^(\s*)[-*+]\s+(.*)/))) {
      const indent = Math.floor(m[1].length / 2)
      const runs = parseInlineRuns(m[2])
      elements.push({ type: 'bullet', indent, runs, plainText: '\t'.repeat(indent) + runs.map(r => r.text).join('') })
      continue
    }

    if ((m = line.match(/^(\s*)\d+[.)]\s+(.*)/))) {
      const indent = Math.floor(m[1].length / 2)
      const runs = parseInlineRuns(m[2])
      elements.push({ type: 'numbered', indent, runs, plainText: '\t'.repeat(indent) + runs.map(r => r.text).join('') })
      continue
    }

    const runs = parseInlineRuns(line)
    elements.push({ type: 'paragraph', indent: 0, runs, plainText: runs.map(r => r.text).join('') })
  }

  return elements
}

// ─── Converter ────────────────────────────────────────────────────────────────

export function markdownToGoogleDocsRequests(content: string): GDocsRequest[] {
  const elements = parseMarkdown(content)
  if (elements.length === 0) return []

  const requests: GDocsRequest[] = []

  // Calculate character start positions for each element (body starts at 1)
  let pos = 1
  const positions: number[] = elements.map(el => {
    const p = pos
    pos += el.plainText.length + 1 // +1 for the \n separator
    return p
  })

  const fullText = elements.map(el => el.plainText).join('\n') + '\n'

  // Step 1: insert all plain text in one shot
  requests.push({ insertText: { location: { index: 1 }, text: fullText } })

  // Collect style requests; we reverse them later so indices aren't shifted.
  const styleRequests: GDocsRequest[] = []

  // Step 2a: paragraph-level styles (headings)
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i]
    if (el.type !== 'heading') continue
    const start = positions[i]
    const end = start + el.plainText.length
    styleRequests.push({
      updateParagraphStyle: {
        range: { startIndex: start, endIndex: end + 1 },
        paragraphStyle: { namedStyleType: `HEADING_${el.level}` as 'HEADING_1' | 'HEADING_2' | 'HEADING_3' },
        fields: 'namedStyleType',
      },
    })
  }

  // Step 2b: inline text styles (bold, italic)
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i]
    let runPos = positions[i] + el.indent // skip leading tab chars
    for (const run of el.runs) {
      if (run.bold || run.italic) {
        const fields = [run.bold && 'bold', run.italic && 'italic'].filter(Boolean).join(',')
        styleRequests.push({
          updateTextStyle: {
            range: { startIndex: runPos, endIndex: runPos + run.text.length },
            textStyle: { bold: !!run.bold, italic: !!run.italic },
            fields,
          },
        })
      }
      runPos += run.text.length
    }
  }

  // Step 2c: bullet presets — applied per contiguous list group
  // Leading tabs in the text tell Google Docs which nesting level each item is.
  let i = 0
  while (i < elements.length) {
    const el = elements[i]
    if (el.type !== 'bullet' && el.type !== 'numbered') { i++; continue }

    // Collect the contiguous same-type list group (split bullet vs numbered)
    const groupType = el.type
    let j = i
    while (j < elements.length && elements[j].type === groupType) j++

    const groupStart = positions[i]
    const groupEnd = positions[j - 1] + elements[j - 1].plainText.length + 1
    // Use the first item's type for the preset
    const preset = el.type === 'numbered' ? 'NUMBERED_DECIMAL_ALPHA_ROMAN' : 'BULLET_DISC_CIRCLE_SQUARE'

    styleRequests.push({
      createParagraphBullets: {
        range: { startIndex: groupStart, endIndex: groupEnd },
        bulletPreset: preset as 'BULLET_DISC_CIRCLE_SQUARE' | 'NUMBERED_DECIMAL_ALPHA_ROMAN',
      },
    })

    i = j
  }

  // Reverse so styling runs from end-of-document backwards — indices stay valid
  requests.push(...styleRequests.reverse())

  return requests
}

// ─── Drive + Docs API call ────────────────────────────────────────────────────

export async function exportToGoogleDocs(
  oauth2: InstanceType<typeof google.auth.OAuth2>,
  title: string,
  content: string
): Promise<{ documentId: string; url: string }> {
  const drive = google.drive({ version: 'v3', auth: oauth2 })
  const docs = google.docs({ version: 'v1', auth: oauth2 })

  // Create the document (Drive API, drive.file scope is sufficient)
  const { data: file } = await drive.files.create({
    requestBody: { name: title, mimeType: 'application/vnd.google-apps.document' },
    fields: 'id',
  })
  const documentId = file.id!

  // Apply content and formatting
  const requests = markdownToGoogleDocsRequests(content)
  if (requests.length > 0) {
    await docs.documents.batchUpdate({ documentId, requestBody: { requests } })
  }

  return { documentId, url: `https://docs.google.com/document/d/${documentId}/edit` }
}
