'use client'
import { useEffect, useRef, useState } from 'react'
import { CameraCapture } from '@/components/CameraCapture'
import { ExportBar } from '@/components/ExportBar'
import { PageStrip } from '@/components/PageStrip'
import { ProgressPanel } from '@/components/ProgressPanel'
import { TranscriptEditor, type TranscriptEditorHandle } from '@/components/TranscriptEditor'
import { useToast } from '@/components/ui/Toast'
import { releasePage, type PreparedPage } from '@/lib/image'
import { stitchPages, derivedTitle, type PageResult } from '@/lib/stitch'

export type ScanPhase = 'capture' | 'transcribing' | 'review'

const SESSION_KEY = 'notescan:draft'

interface DraftDocument {
  title: string
  content: string
  pageCount: number
  model: string
}

export function ScanFlow() {
  const { toast } = useToast()
  const [phase, setPhase] = useState<ScanPhase>('capture')
  const [pages, setPages] = useState<PreparedPage[]>([])
  const [results, setResults] = useState<PageResult[]>([])
  const [draft, setDraft] = useState<DraftDocument | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Restore draft from session storage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY)
    if (saved) {
      try {
        const doc = JSON.parse(saved) as DraftDocument
        setDraft(doc)
        setPhase('review')
        toast('Restored your previous session')
      } catch {
        sessionStorage.removeItem(SESSION_KEY)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Warn before leaving if there's unsaved work
  useEffect(() => {
    const hasWork =
      (phase === 'capture' && pages.length > 0) ||
      phase === 'transcribing' ||
      (phase === 'review' && draft !== null)

    const handler = (e: BeforeUnloadEvent) => {
      if (hasWork) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [phase, pages.length, draft])

  function handlePagesAdded(newPages: PreparedPage[]) {
    setPages((prev) => [...prev, ...newPages])
  }

  function handleRemovePage(index: number) {
    setPages((prev) => {
      const removed = prev[index]
      releasePage(removed)
      return prev.filter((_, i) => i !== index)
    })
  }

  function handleReorder(fromIndex: number, toIndex: number) {
    setPages((prev) => {
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
  }

  function handleError(message: string) {
    toast(message, { type: 'error' })
  }

  async function handleTranscribe() {
    if (pages.length === 0) return
    setPhase('transcribing')
    setResults([])

    const ctrl = new AbortController()
    abortRef.current = ctrl

    const payload = pages.map((p, i) => ({
      index: i,
      base64: p.base64,
      mimeType: p.mimeType,
    }))

    const pageResults: PageResult[] = []
    const completedMarkdowns: Record<number, string> = {}

    try {
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pages: payload }),
        signal: ctrl.signal,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Server error ${res.status}`)
      }

      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const event = JSON.parse(line)
            if (event.type === 'page') {
              completedMarkdowns[event.index] = event.markdown
              pageResults.push({ index: event.index, markdown: event.markdown })
              setResults([...pageResults])
            } else if (event.type === 'error') {
              pageResults.push({ index: event.index, error: event.message })
              setResults([...pageResults])
            } else if (event.type === 'done') {
              // finalize
            }
          } catch {
            // malformed line, skip
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        toast('Transcription cancelled')
        setPhase('capture')
        return
      }
      toast((err as Error).message, { type: 'error' })
      setPhase('capture')
      return
    }

    // Stitch results in page order
    const stitched = stitchPages(pageResults, pages.length)
    const titleText = derivedTitle(stitched)

    const doc: DraftDocument = {
      title: titleText,
      content: stitched,
      pageCount: pages.length,
      model: process.env.NEXT_PUBLIC_OCR_MODEL ?? 'claude-haiku-4-5',
    }

    sessionStorage.setItem(SESSION_KEY, JSON.stringify(doc))
    setDraft(doc)

    // Release image memory — images are done
    pages.forEach(releasePage)
    setPages([])

    setPhase('review')
  }

  function handleCancel() {
    abortRef.current?.abort()
  }

  function handleNewScan() {
    sessionStorage.removeItem(SESSION_KEY)
    setDraft(null)
    setResults([])
    setPages([])
    setPhase('capture')
  }

  const completedSet = new Set(results.filter((r) => r.markdown !== undefined).map((r) => r.index))
  const failedSet = new Set(results.filter((r) => r.error !== undefined).map((r) => r.index))

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Main area */}
      <div className="flex-1 overflow-y-auto">
        {phase === 'capture' && (
          <CaptureState
            pages={pages}
            onPagesAdded={handlePagesAdded}
            onError={handleError}
            onRemove={handleRemovePage}
            onReorder={handleReorder}
            onTranscribe={handleTranscribe}
          />
        )}

        {phase === 'transcribing' && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 flex items-start justify-center p-6">
              <ProgressPanel
                total={pages.length}
                completed={completedSet.size}
                failed={failedSet.size}
                onCancel={handleCancel}
              />
            </div>
            <PageStrip
              pages={pages}
              completedIndices={completedSet}
              failedIndices={failedSet}
              readOnly
            />
          </div>
        )}

        {phase === 'review' && draft && (
          <ReviewState
            draft={draft}
            onDraftChange={(updated) => {
              setDraft(updated)
              sessionStorage.setItem(SESSION_KEY, JSON.stringify(updated))
            }}
            onNewScan={handleNewScan}
          />
        )}
      </div>
    </div>
  )
}

// ─── Capture state ────────────────────────────────────────────────────────────

interface CaptureStateProps {
  pages: PreparedPage[]
  onPagesAdded: (pages: PreparedPage[]) => void
  onError: (msg: string) => void
  onRemove: (i: number) => void
  onReorder: (from: number, to: number) => void
  onTranscribe: () => void
}

function CaptureState({ pages, onPagesAdded, onError, onRemove, onReorder, onTranscribe }: CaptureStateProps) {
  return (
    <div className="flex flex-col min-h-full">
      {/* Camera controls */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 py-10">
        <CameraCapture onPagesAdded={onPagesAdded} onError={onError} />

        {pages.length > 0 && (
          <p className="label">
            {pages.length} {pages.length === 1 ? 'page' : 'pages'}
          </p>
        )}
      </div>

      {/* Page strip + transcribe button */}
      {pages.length > 0 && (
        <div className="sticky bottom-0 bg-paper border-t border-rule">
          <PageStrip
            pages={pages}
            onRemove={onRemove}
            onReorder={onReorder}
          />
          <div className="px-4 pb-safe-bottom pb-4">
            <button
              onClick={onTranscribe}
              className="w-full rounded-xl bg-accent text-paper font-medium py-3.5 text-base transition-opacity hover:bg-accent/90 disabled:opacity-40"
              disabled={pages.length === 0}
            >
              Transcribe {pages.length} {pages.length === 1 ? 'page' : 'pages'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Review state ─────────────────────────────────────────────────────────────

interface ReviewStateProps {
  draft: DraftDocument
  onDraftChange: (d: DraftDocument) => void
  onNewScan: () => void
}

function ReviewState({ draft, onDraftChange, onNewScan }: ReviewStateProps) {
  const editorRef = useRef<TranscriptEditorHandle>(null)
  const [jumpIndex, setJumpIndex] = useState(0)

  const wordCount = draft.content.trim() ? draft.content.trim().split(/\s+/).length : 0
  const uncertaintyCount = (draft.content.match(/\[\?]/g) ?? []).length

  function handleUncertaintyClick() {
    editorRef.current?.jumpToUncertainty(jumpIndex)
    setJumpIndex((i) => i + 1)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4 w-full">
      {/* Title + new scan */}
      <div className="flex items-start gap-3">
        <input
          type="text"
          value={draft.title}
          onChange={(e) => onDraftChange({ ...draft, title: e.target.value })}
          placeholder="Untitled scan"
          className="flex-1 text-xl font-semibold text-ink bg-transparent border-0 focus:outline-none placeholder-ink-muted min-w-0"
        />
        <button
          onClick={onNewScan}
          className="shrink-0 text-sm text-ink-muted hover:text-ink transition-colors mt-1"
        >
          New scan
        </button>
      </div>

      {/* Status line */}
      <div className="flex items-center gap-2 text-ink-muted" style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        <span>{draft.pageCount} {draft.pageCount === 1 ? 'page' : 'pages'}</span>
        <span>·</span>
        <span>{wordCount.toLocaleString()} words</span>
        <span>·</span>
        {uncertaintyCount > 0 ? (
          <button
            onClick={handleUncertaintyClick}
            className="text-flag hover:opacity-75 transition-opacity"
          >
            {uncertaintyCount} uncertain {uncertaintyCount === 1 ? 'reading' : 'readings'}
          </button>
        ) : (
          <span>No uncertain readings</span>
        )}
      </div>

      {/* Editor */}
      <TranscriptEditor
        ref={editorRef}
        value={draft.content}
        onChange={(content) => onDraftChange({ ...draft, content })}
      />

      {/* Export */}
      <ExportBar content={draft.content} title={draft.title} />
    </div>
  )
}

