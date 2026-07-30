'use client'
import { useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import { downloadBlob, toPlainText, slugify } from '@/lib/export'

interface ExportBarProps {
  content: string
  title: string
  scanId?: string  // present when viewing a saved scan (Phase 7)
}

export function ExportBar({ content, title, scanId: _scanId }: ExportBarProps) {
  const { toast } = useToast()
  const [showOverflow, setShowOverflow] = useState(false)
  const [gdocLoading, setGdocLoading] = useState(false)
  const [docxLoading, setDocxLoading] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content)
      toast('Copied to clipboard')
    } catch {
      toast('Copy failed — try selecting all text manually', { type: 'error' })
    }
  }

  function handleDownloadMd() {
    const blob = new Blob([content], { type: 'text/markdown; charset=utf-8' })
    downloadBlob(blob, `${slugify(title)}.md`)
  }

  function handleDownloadTxt() {
    const plain = toPlainText(content)
    const blob = new Blob([plain], { type: 'text/plain; charset=utf-8' })
    downloadBlob(blob, `${slugify(title)}.txt`)
    setShowOverflow(false)
  }

  async function handleGoogleDocs() {
    setGdocLoading(true)
    try {
      const res = await fetch('/api/export/gdoc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      })
      if (res.status === 403) {
        toast('Google sign-in expired — please sign out and sign back in', { type: 'error' })
        return
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Export failed')
      }
      const { url } = await res.json()
      toast('Saved to Google Docs', { action: { label: 'Open', href: url } })
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Export failed', { type: 'error' })
    } finally {
      setGdocLoading(false)
    }
  }

  async function handleDocx() {
    setDocxLoading(true)
    try {
      const res = await fetch('/api/export/docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Export failed')
      }
      const blob = await res.blob()
      downloadBlob(blob, `${slugify(title)}.docx`)
      toast('Downloaded Word document')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Export failed', { type: 'error' })
    } finally {
      setDocxLoading(false)
    }
  }

  return (
    <div className="relative flex items-center gap-2 flex-wrap">
      <ExportButton onClick={handleCopy} label="Copy all" icon={<CopyIcon />} />

      <ExportButton
        onClick={handleGoogleDocs}
        label="Save to Google Docs"
        icon={<DocsIcon />}
        loading={gdocLoading}
      />

      <ExportButton
        onClick={handleDocx}
        label="Download .docx"
        icon={<DocxIcon />}
        loading={docxLoading}
      />

      <ExportButton onClick={handleDownloadMd} label="Download .md" icon={<FileIcon />} />

      {/* Overflow menu for .txt */}
      <div className="relative">
        <button
          onClick={() => setShowOverflow((v) => !v)}
          aria-label="More export options"
          className="flex items-center justify-center w-9 h-9 rounded-lg border border-rule text-ink-muted hover:bg-wash transition-colors"
        >
          <MoreIcon />
        </button>
        {showOverflow && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowOverflow(false)} />
            <div className="absolute bottom-full right-0 mb-1 z-20 min-w-[140px] rounded-lg border border-rule bg-paper shadow-lg py-1">
              <button
                onClick={handleDownloadTxt}
                className="w-full text-left px-4 py-2 text-sm text-ink hover:bg-wash transition-colors"
              >
                Download .txt
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ExportButton({
  onClick,
  label,
  icon,
  loading = false,
}: {
  onClick: () => void
  label: string
  icon: React.ReactNode
  loading?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-rule text-sm font-medium text-ink hover:bg-wash transition-colors disabled:opacity-50 disabled:cursor-wait"
    >
      {icon}
      {label}
    </button>
  )
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function DocsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14,2 14,8 20,8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10,9 9,9 8,9" />
    </svg>
  )
}

function DocxIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14,2 14,8 20,8" />
    </svg>
  )
}

function FileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="13,2 13,9 20,9" />
    </svg>
  )
}

function MoreIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
    </svg>
  )
}
