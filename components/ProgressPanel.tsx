'use client'

interface ProgressPanelProps {
  total: number
  completed: number
  failed: number
  onCancel: () => void
}

export function ProgressPanel({ total, completed, failed, onCancel }: ProgressPanelProps) {
  const done = completed + failed
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <p className="text-ink font-medium">
        Transcribing {done} of {total} pages
      </p>
      <div className="w-full max-w-xs bg-rule rounded-full h-1.5">
        <div
          className="bg-accent h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${(done / total) * 100}%` }}
        />
      </div>
      <button
        onClick={onCancel}
        className="text-sm text-ink-muted hover:text-ink transition-colors mt-2"
      >
        Cancel
      </button>
    </div>
  )
}
