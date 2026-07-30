import { describe, it, expect } from 'vitest'
import { parseInlineRuns, parseMarkdown, markdownToGoogleDocsRequests } from '../google/docs'

// ─── Inline parser ────────────────────────────────────────────────────────────

describe('parseInlineRuns', () => {
  it('returns plain text unchanged', () => {
    expect(parseInlineRuns('hello world')).toEqual([{ text: 'hello world' }])
  })

  it('parses bold', () => {
    const runs = parseInlineRuns('say **hello** there')
    expect(runs).toEqual([
      { text: 'say ' },
      { text: 'hello', bold: true },
      { text: ' there' },
    ])
  })

  it('parses italic', () => {
    const runs = parseInlineRuns('say *hello* there')
    expect(runs).toEqual([
      { text: 'say ' },
      { text: 'hello', italic: true },
      { text: ' there' },
    ])
  })

  it('parses bold-italic', () => {
    const runs = parseInlineRuns('***important***')
    expect(runs).toEqual([{ text: 'important', bold: true, italic: true }])
  })

  it('handles adjacent formatting', () => {
    const runs = parseInlineRuns('**a** and *b*')
    expect(runs.find(r => r.bold)?.text).toBe('a')
    expect(runs.find(r => r.italic)?.text).toBe('b')
  })
})

// ─── Document-level parser ────────────────────────────────────────────────────

describe('parseMarkdown', () => {
  it('parses H1 heading', () => {
    const [el] = parseMarkdown('# My Heading')
    expect(el.type).toBe('heading')
    expect(el.level).toBe(1)
    expect(el.plainText).toBe('My Heading')
  })

  it('parses H2 and H3', () => {
    const els = parseMarkdown('## Two\n### Three')
    expect(els[0].level).toBe(2)
    expect(els[1].level).toBe(3)
  })

  it('parses unordered bullet', () => {
    const [el] = parseMarkdown('- Item one')
    expect(el.type).toBe('bullet')
    expect(el.indent).toBe(0)
    expect(el.plainText).toBe('Item one')
  })

  it('parses nested bullet with leading tab', () => {
    const els = parseMarkdown('- Parent\n  - Child')
    expect(els[0].indent).toBe(0)
    expect(els[0].plainText).toBe('Parent')
    expect(els[1].indent).toBe(1)
    expect(els[1].plainText).toBe('\tChild')
  })

  it('parses numbered list', () => {
    const [el] = parseMarkdown('1. First item')
    expect(el.type).toBe('numbered')
    expect(el.indent).toBe(0)
    expect(el.plainText).toBe('First item')
  })

  it('skips blank lines', () => {
    const els = parseMarkdown('Line one\n\nLine two')
    expect(els).toHaveLength(2)
  })

  it('parses paragraph', () => {
    const [el] = parseMarkdown('Just a paragraph.')
    expect(el.type).toBe('paragraph')
    expect(el.plainText).toBe('Just a paragraph.')
  })
})

// ─── Full converter ───────────────────────────────────────────────────────────

describe('markdownToGoogleDocsRequests', () => {
  it('returns empty for empty content', () => {
    expect(markdownToGoogleDocsRequests('')).toEqual([])
    expect(markdownToGoogleDocsRequests('   \n  ')).toEqual([])
  })

  it('first request inserts all plain text at index 1', () => {
    const reqs = markdownToGoogleDocsRequests('# Title\n\nSome text.')
    const insert = reqs[0]
    expect(insert.insertText?.location?.index).toBe(1)
    expect(insert.insertText?.text).toContain('Title')
    expect(insert.insertText?.text).toContain('Some text.')
  })

  it('plain text does not contain markdown syntax characters', () => {
    const reqs = markdownToGoogleDocsRequests('**bold** and *italic*')
    const text = reqs[0].insertText?.text ?? ''
    expect(text).not.toContain('**')
    expect(text).not.toContain('*')
    expect(text).toContain('bold')
    expect(text).toContain('italic')
  })

  it('emits updateParagraphStyle HEADING_1 for # heading', () => {
    const reqs = markdownToGoogleDocsRequests('# Title')
    const headingReq = reqs.find(r => r.updateParagraphStyle?.paragraphStyle?.namedStyleType === 'HEADING_1')
    expect(headingReq).toBeDefined()
  })

  it('emits updateParagraphStyle HEADING_2 for ## heading', () => {
    const reqs = markdownToGoogleDocsRequests('## Section')
    const headingReq = reqs.find(r => r.updateParagraphStyle?.paragraphStyle?.namedStyleType === 'HEADING_2')
    expect(headingReq).toBeDefined()
  })

  it('emits createParagraphBullets BULLET_DISC_CIRCLE_SQUARE for - items', () => {
    const reqs = markdownToGoogleDocsRequests('- Alpha\n- Beta')
    const bulletReq = reqs.find(r => r.createParagraphBullets?.bulletPreset === 'BULLET_DISC_CIRCLE_SQUARE')
    expect(bulletReq).toBeDefined()
  })

  it('emits createParagraphBullets NUMBERED_DECIMAL_ALPHA_ROMAN for 1. items', () => {
    const reqs = markdownToGoogleDocsRequests('1. First\n2. Second')
    const numReq = reqs.find(r => r.createParagraphBullets?.bulletPreset === 'NUMBERED_DECIMAL_ALPHA_ROMAN')
    expect(numReq).toBeDefined()
  })

  it('emits updateTextStyle with bold:true for **text**', () => {
    const reqs = markdownToGoogleDocsRequests('Some **bold** text.')
    const boldReq = reqs.find(r => r.updateTextStyle?.textStyle?.bold === true)
    expect(boldReq).toBeDefined()
  })

  it('emits updateTextStyle with italic:true for *text*', () => {
    const reqs = markdownToGoogleDocsRequests('Some *italic* text.')
    const italicReq = reqs.find(r => r.updateTextStyle?.textStyle?.italic === true)
    expect(italicReq).toBeDefined()
  })

  it('nested bullet has leading tab in inserted text', () => {
    const reqs = markdownToGoogleDocsRequests('- Parent\n  - Child')
    const text = reqs[0].insertText?.text ?? ''
    expect(text).toContain('\tChild')
    expect(text).toContain('Parent')
  })

  it('styling requests appear after the insertText request', () => {
    const reqs = markdownToGoogleDocsRequests('# Title\n\n- Item')
    expect(reqs[0].insertText).toBeDefined()
    // All requests after index 0 are styling
    const styleReqs = reqs.slice(1)
    expect(styleReqs.length).toBeGreaterThan(0)
  })

  it('styling requests have indices in reverse order (end before start)', () => {
    const reqs = markdownToGoogleDocsRequests('# H1\n## H2\n### H3')
    const headingReqs = reqs.filter(r => r.updateParagraphStyle?.paragraphStyle?.namedStyleType)
    const starts = headingReqs.map(r => r.updateParagraphStyle!.range!.startIndex!)
    // Should be descending (reverse order) so later indices come first
    for (let i = 1; i < starts.length; i++) {
      expect(starts[i]).toBeLessThan(starts[i - 1])
    }
  })

  it('mixed document: heading + nested bullets + numbered + bold', () => {
    const md = `# Meeting Notes

- Alpha item
  - **Bold nested**
- Beta item

1. Step one
2. Step two`

    const reqs = markdownToGoogleDocsRequests(md)
    const text = reqs[0].insertText?.text ?? ''

    expect(text).toContain('Meeting Notes')
    expect(text).toContain('Alpha item')
    expect(text).toContain('\tBold nested')
    expect(text).toContain('Beta item')
    expect(text).toContain('Step one')

    expect(reqs.some(r => r.updateParagraphStyle?.paragraphStyle?.namedStyleType === 'HEADING_1')).toBe(true)
    expect(reqs.some(r => r.createParagraphBullets?.bulletPreset === 'BULLET_DISC_CIRCLE_SQUARE')).toBe(true)
    expect(reqs.some(r => r.createParagraphBullets?.bulletPreset === 'NUMBERED_DECIMAL_ALPHA_ROMAN')).toBe(true)
    expect(reqs.some(r => r.updateTextStyle?.textStyle?.bold === true)).toBe(true)
  })
})
