'use client'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

// Must exactly match textarea: font, size, line-height, padding, word-wrap
const EDITOR_STYLE: React.CSSProperties = {
  fontFamily: "'Inter', system-ui, sans-serif",
  fontSize: '17px',
  lineHeight: '1.65',
  padding: '24px',
  wordWrap: 'break-word',
  overflowWrap: 'break-word',
  whiteSpace: 'pre-wrap',
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function highlightUncertainty(text: string): string {
  return escapeHtml(text).replace(/\[\?]/g, '<mark class="ns-flag">[?]</mark>')
}

export interface TranscriptEditorHandle {
  jumpToUncertainty: (index: number) => void
}

interface TranscriptEditorProps {
  value: string
  onChange: (v: string) => void
  className?: string
}

export const TranscriptEditor = forwardRef<TranscriptEditorHandle, TranscriptEditorProps>(
  ({ value, onChange, className = '' }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const backdropRef = useRef<HTMLDivElement>(null)

    // Auto-grow: set height from scrollHeight so the page scrolls, not the textarea
    useEffect(() => {
      const ta = textareaRef.current
      if (!ta) return
      ta.style.height = 'auto'
      ta.style.height = ta.scrollHeight + 'px'
    }, [value])

    useImperativeHandle(ref, () => ({
      jumpToUncertainty(jumpIndex: number) {
        const marks = backdropRef.current?.querySelectorAll<HTMLElement>('mark.ns-flag')
        if (!marks || marks.length === 0) return
        const idx = jumpIndex % marks.length
        const mark = marks[idx]

        // Scroll the mark into view (backdrop is in flow, so page-level scroll works)
        mark.scrollIntoView({ behavior: 'smooth', block: 'center' })

        // Also place textarea selection on the matching [?]
        const ta = textareaRef.current
        if (!ta) return
        const pattern = /\[\?]/g
        let m: RegExpExecArray | null
        let i = 0
        while ((m = pattern.exec(value)) !== null) {
          if (i === idx) {
            ta.focus()
            ta.setSelectionRange(m.index, m.index + 3)
            break
          }
          i++
        }
      },
    }))

    return (
      <>
        {/* Flag color for [?] marks — scoped to this component */}
        <style>{`.ns-flag { color: #C2410C; background: transparent; font-weight: 500; }`}</style>

        <div className={`relative border border-rule rounded-lg overflow-hidden ${className}`}>
          {/* Highlight backdrop — same flow layout as the textarea, pointer-events none */}
          <div
            ref={backdropRef}
            aria-hidden
            style={{ ...EDITOR_STYLE, color: 'transparent', position: 'absolute', inset: 0, pointerEvents: 'none' }}
            dangerouslySetInnerHTML={{ __html: highlightUncertainty(value) + '\n' }}
          />

          {/* Editable surface — background transparent so backdrop shows through */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            spellCheck
            style={{ ...EDITOR_STYLE, minHeight: '50vh', width: '100%', background: 'transparent', resize: 'none', display: 'block', position: 'relative', zIndex: 1 }}
            className="text-ink focus:outline-none focus:ring-2 focus:ring-accent focus:ring-inset"
          />
        </div>
      </>
    )
  }
)

TranscriptEditor.displayName = 'TranscriptEditor'
