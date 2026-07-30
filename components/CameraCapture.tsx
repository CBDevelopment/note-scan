'use client'
import { useRef, useState, useEffect, useCallback } from 'react'
import { preparePage, type PreparedPage } from '@/lib/image'
import { Spinner } from '@/components/ui/Spinner'

interface CameraCaptureProps {
  onPagesAdded: (pages: PreparedPage[]) => void
  onError: (message: string) => void
}

export function CameraCapture({ onPagesAdded, onError }: CameraCaptureProps) {
  const [processing, setProcessing] = useState(false)
  const [webcamOpen, setWebcamOpen] = useState(false)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const filesInputRef = useRef<HTMLInputElement>(null)

  async function processFiles(files: FileList | File[] | null) {
    if (!files || (files as FileList | File[]).length === 0) return
    setProcessing(true)

    const results: PreparedPage[] = []
    const errors: string[] = []

    for (const file of Array.from(files as FileList)) {
      if (!file.type.startsWith('image/') && !file.name.match(/\.(heic|heif)$/i)) {
        errors.push(`"${file.name}" is not an image`)
        continue
      }
      try {
        const page = await preparePage(file, crypto.randomUUID())
        results.push(page)
      } catch (err) {
        errors.push(err instanceof Error ? err.message : `Failed to process "${file.name}"`)
      }
    }

    setProcessing(false)
    if (results.length > 0) onPagesAdded(results)
    if (errors.length > 0) onError(errors.join('\n'))

    if (cameraInputRef.current) cameraInputRef.current.value = ''
    if (filesInputRef.current) filesInputRef.current.value = ''
  }

  async function processBlob(blob: Blob) {
    setProcessing(true)
    try {
      const file = new File([blob], 'webcam.jpg', { type: 'image/jpeg' })
      const page = await preparePage(file, crypto.randomUUID())
      onPagesAdded([page])
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to process photo')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <>
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

        {/* Webcam button */}
        <button
          onClick={() => setWebcamOpen(true)}
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
              Use webcam
            </>
          )}
        </button>

        {/* File picker */}
        <button
          onClick={() => filesInputRef.current?.click()}
          disabled={processing}
          className="text-sm text-ink-muted hover:text-ink transition-colors disabled:opacity-50"
        >
          Choose files from device
        </button>
      </div>

      {webcamOpen && (
        <WebcamModal
          onCapture={(blob) => { setWebcamOpen(false); processBlob(blob) }}
          onClose={() => setWebcamOpen(false)}
        />
      )}
    </>
  )
}

// ─── Webcam modal ──────────────────────────────────────────────────────────────

interface WebcamModalProps {
  onCapture: (blob: Blob) => void
  onClose: () => void
}

function WebcamModal({ onCapture, onClose }: WebcamModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    let cancelled = false

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => setReady(true)
        }
      })
      .catch(() => {
        if (!cancelled) setError('Camera access denied. Allow camera access in your browser and try again.')
      })

    return () => {
      cancelled = true
      stop()
    }
  }, [stop])

  function capture() {
    const video = videoRef.current
    if (!video) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)

    canvas.toBlob((blob) => {
      if (blob) { stop(); onCapture(blob) }
    }, 'image/jpeg', 0.92)
  }

  function handleClose() {
    stop()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/60">
        <span className="text-paper text-sm font-medium">Position your notes in frame</span>
        <button onClick={handleClose} className="text-paper/70 hover:text-paper transition-colors p-1">
          <CloseIcon />
        </button>
      </div>

      {/* Video */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="max-h-full max-w-full object-contain"
        />
        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner className="w-8 h-8 text-paper" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center px-8 text-center">
            <p className="text-paper text-sm">{error}</p>
          </div>
        )}
      </div>

      {/* Capture button */}
      <div className="flex items-center justify-center py-8 bg-black/60">
        <button
          onClick={capture}
          disabled={!ready}
          aria-label="Take photo"
          className="w-16 h-16 rounded-full border-4 border-paper bg-paper/20 hover:bg-paper/40 transition-colors disabled:opacity-40 flex items-center justify-center"
        >
          <div className="w-10 h-10 rounded-full bg-paper" />
        </button>
      </div>
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

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
