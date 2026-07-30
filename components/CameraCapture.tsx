'use client'
import { useRef, useState } from 'react'
import { preparePage, type PreparedPage } from '@/lib/image'
import { Spinner } from '@/components/ui/Spinner'

interface CameraCaptureProps {
  onPagesAdded: (pages: PreparedPage[]) => void
  onError: (message: string) => void
}

export function CameraCapture({ onPagesAdded, onError }: CameraCaptureProps) {
  const [processing, setProcessing] = useState(false)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const filesInputRef = useRef<HTMLInputElement>(null)

  async function processFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setProcessing(true)

    const results: PreparedPage[] = []
    const errors: string[] = []

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/') && !file.name.match(/\.(heic|heif)$/i)) {
        errors.push(`"${file.name}" is not an image`)
        continue
      }
      try {
        const id = crypto.randomUUID()
        const page = await preparePage(file, id)
        results.push(page)
      } catch (err) {
        errors.push(err instanceof Error ? err.message : `Failed to process "${file.name}"`)
      }
    }

    setProcessing(false)

    if (results.length > 0) onPagesAdded(results)
    if (errors.length > 0) onError(errors.join('\n'))

    // Reset inputs so the same file can be re-selected
    if (cameraInputRef.current) cameraInputRef.current.value = ''
    if (filesInputRef.current) filesInputRef.current.value = ''
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => processFiles(e.target.files)}
      />
      <input
        ref={filesInputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => processFiles(e.target.files)}
      />

      {/* Primary: Camera */}
      <button
        onClick={() => cameraInputRef.current?.click()}
        disabled={processing}
        className="flex items-center justify-center gap-2 w-full max-w-xs rounded-xl bg-accent text-paper font-medium px-6 py-4 text-base transition-opacity disabled:opacity-50 hover:bg-accent/90"
      >
        {processing ? (
          <>
            <Spinner className="w-5 h-5" />
            Processing…
          </>
        ) : (
          <>
            <CameraIcon />
            Take photo
          </>
        )}
      </button>

      {/* Secondary: File picker */}
      <button
        onClick={() => filesInputRef.current?.click()}
        disabled={processing}
        className="text-sm text-ink-muted hover:text-ink transition-colors disabled:opacity-50"
      >
        Choose files from device
      </button>
    </div>
  )
}

function CameraIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}
