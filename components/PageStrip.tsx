'use client'
import { useRef, useState } from 'react'
import type { PreparedPage } from '@/lib/image'

interface PageStripProps {
  pages: PreparedPage[]
  completedIndices?: Set<number>
  failedIndices?: Set<number>
  onRemove?: (index: number) => void
  onReorder?: (fromIndex: number, toIndex: number) => void
  onTileClick?: (index: number) => void
  readOnly?: boolean
}

export function PageStrip({
  pages,
  completedIndices = new Set(),
  failedIndices = new Set(),
  onRemove,
  onReorder,
  onTileClick,
  readOnly = false,
}: PageStripProps) {
  const dragSrcIdx = useRef<number | null>(null)
  const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null)
  const touchDragIdx = useRef<number | null>(null)
  const stripRef = useRef<HTMLDivElement>(null)

  const handleDragStart = (idx: number, e: React.DragEvent) => {
    dragSrcIdx.current = idx
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (idx: number, e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dropTargetIdx !== idx) setDropTargetIdx(idx)
  }

  const handleDrop = (toIdx: number, e: React.DragEvent) => {
    e.preventDefault()
    const fromIdx = dragSrcIdx.current
    if (fromIdx !== null && fromIdx !== toIdx) {
      onReorder?.(fromIdx, toIdx)
    }
    dragSrcIdx.current = null
    setDropTargetIdx(null)
  }

  const handleDragEnd = () => {
    dragSrcIdx.current = null
    setDropTargetIdx(null)
  }

  const handleTouchStart = (idx: number, e: React.TouchEvent) => {
    touchDragIdx.current = idx
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchDragIdx.current === null) return
    e.preventDefault()
    const touch = e.touches[0]
    const el = document.elementFromPoint(touch.clientX, touch.clientY)
    const tile = el?.closest('[data-tile]')
    if (tile) {
      const idx = Number(tile.getAttribute('data-tile'))
      if (!isNaN(idx) && dropTargetIdx !== idx) setDropTargetIdx(idx)
    }
  }

  const handleTouchEnd = () => {
    const fromIdx = touchDragIdx.current
    if (fromIdx !== null && dropTargetIdx !== null && fromIdx !== dropTargetIdx) {
      onReorder?.(fromIdx, dropTargetIdx)
    }
    touchDragIdx.current = null
    setDropTargetIdx(null)
  }

  if (pages.length === 0) return null

  return (
    <div
      ref={stripRef}
      className="flex gap-2 overflow-x-auto px-4 py-3 bg-wash border-t border-rule"
      style={{ scrollbarWidth: 'thin' }}
    >
      {pages.map((page, idx) => {
        const isCompleted = completedIndices.has(idx)
        const isFailed = failedIndices.has(idx)
        const isDragTarget = dropTargetIdx === idx
        const isDragging = dragSrcIdx.current === idx || touchDragIdx.current === idx

        return (
          <div
            key={page.id}
            data-tile={idx}
            draggable={!readOnly}
            onDragStart={(e) => !readOnly && handleDragStart(idx, e)}
            onDragOver={(e) => !readOnly && handleDragOver(idx, e)}
            onDrop={(e) => !readOnly && handleDrop(idx, e)}
            onDragEnd={handleDragEnd}
            onTouchStart={(e) => !readOnly && handleTouchStart(idx, e)}
            onTouchMove={(e) => !readOnly && handleTouchMove(e)}
            onTouchEnd={handleTouchEnd}
            onClick={() => onTileClick?.(idx)}
            className={[
              'relative w-[72px] h-[72px] shrink-0 rounded-lg overflow-hidden',
              !readOnly ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
              isDragTarget ? 'ring-2 ring-accent ring-offset-1' : '',
              isDragging ? 'opacity-40' : '',
              'transition-opacity select-none',
            ].join(' ')}
          >
            {/* Thumbnail */}
            <img
              src={page.previewUrl}
              alt={`Page ${idx + 1}`}
              className="w-full h-full object-cover"
              draggable={false}
            />

            {/* Completion wipe overlay — fills bottom-to-top */}
            {isCompleted && (
              <div className="absolute inset-0 bg-accent/20 pointer-events-none" />
            )}

            {/* Failure tint */}
            {isFailed && (
              <div className="absolute inset-0 bg-flag/30 pointer-events-none" />
            )}

            {/* Transcription wipe animation */}
            {!isCompleted && !isFailed && completedIndices.size > 0 && (
              <div className="absolute inset-0 flex items-end pointer-events-none">
                <div className="w-full h-1 bg-accent/60 animate-pulse" />
              </div>
            )}

            {/* Page number */}
            <span className="absolute bottom-1 left-1 font-mono text-[9px] uppercase tracking-wider text-paper bg-black/50 px-1 rounded leading-4">
              {idx + 1}
            </span>

            {/* Remove button — hidden in readOnly/transcribing */}
            {!readOnly && onRemove && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove(idx)
                }}
                aria-label={`Remove page ${idx + 1}`}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 text-paper text-xs flex items-center justify-center hover:bg-black/70 transition-colors leading-none"
              >
                ×
              </button>
            )}

            {/* Failed icon */}
            {isFailed && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-flag text-lg font-bold drop-shadow">!</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
