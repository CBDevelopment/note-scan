import { describe, it, expect } from 'vitest'
import { stitchPages, derivedTitle } from '../stitch'

describe('stitchPages', () => {
  it('returns pages in index order regardless of result arrival order', () => {
    const results = [
      { index: 2, markdown: 'Page three' },
      { index: 0, markdown: 'Page one' },
      { index: 1, markdown: 'Page two' },
    ]
    const out = stitchPages(results, 3)
    expect(out).toBe('Page one\n\nPage two\n\nPage three')
  })

  it('inserts an error placeholder for failed pages', () => {
    const results = [
      { index: 0, markdown: 'First page.' },
      { index: 1, error: 'timeout' },
      { index: 2, markdown: 'Third page.' },
    ]
    const out = stitchPages(results, 3)
    expect(out).toContain('[Page 2 failed to transcribe]')
    expect(out).toContain('First page.')
    expect(out).toContain('Third page.')
  })

  it('joins mid-sentence continuation with a space', () => {
    const results = [
      { index: 0, markdown: 'The quick brown fox' },
      { index: 1, markdown: 'jumped over the lazy dog.' },
    ]
    const out = stitchPages(results, 2)
    expect(out).toBe('The quick brown fox jumped over the lazy dog.')
  })

  it('joins with double newline when prev ends with punctuation', () => {
    const results = [
      { index: 0, markdown: 'First paragraph.' },
      { index: 1, markdown: 'Second paragraph.' },
    ]
    const out = stitchPages(results, 2)
    expect(out).toBe('First paragraph.\n\nSecond paragraph.')
  })

  it('skips blank pages', () => {
    const results = [
      { index: 0, markdown: 'First.' },
      { index: 1, markdown: '' },
      { index: 2, markdown: 'Third.' },
    ]
    const out = stitchPages(results, 3)
    expect(out).toBe('First.\n\nThird.')
  })

  it('strips VLM preamble', () => {
    const results = [
      { index: 0, markdown: "Here's the transcription:\n\nActual content" },
    ]
    expect(stitchPages(results, 1)).toBe('Actual content')
  })

  it('strips wrapping code fences', () => {
    const results = [
      { index: 0, markdown: '```\nActual content\n```' },
    ]
    expect(stitchPages(results, 1)).toBe('Actual content')
  })

  it('handles missing page indices gracefully', () => {
    // total=3 but only pages 0 and 2 returned
    const results = [
      { index: 0, markdown: 'First.' },
      { index: 2, markdown: 'Third.' },
    ]
    const out = stitchPages(results, 3)
    expect(out).toBe('First.\n\nThird.')
  })

  it('returns empty string for all-failed batch', () => {
    const results = [
      { index: 0, error: 'timeout' },
      { index: 1, error: 'timeout' },
    ]
    // Error placeholders are still included
    const out = stitchPages(results, 2)
    expect(out).toContain('[Page 1 failed')
    expect(out).toContain('[Page 2 failed')
  })
})

describe('derivedTitle', () => {
  it('extracts first heading', () => {
    const content = '# Meeting Notes\n\nSome content here.'
    expect(derivedTitle(content)).toBe('Meeting Notes')
  })

  it('uses first 6 words when no heading', () => {
    const content = 'Today we discussed the project timeline and deliverables.'
    expect(derivedTitle(content)).toBe('Today we discussed the project timeline')
  })

  it('returns Untitled scan for empty content', () => {
    expect(derivedTitle('')).toBe('Untitled scan')
    expect(derivedTitle('   \n  ')).toBe('Untitled scan')
  })

  it('prefers heading over plain text even if heading is not first line', () => {
    const content = 'Some preamble\n\n## Section Title\n\nBody text'
    expect(derivedTitle(content)).toBe('Section Title')
  })
})
