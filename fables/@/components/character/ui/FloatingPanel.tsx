// ════════════════════════════════════════════════════════════════════════════
// FloatingPanel.tsx — draggable, resizable, always-on-top window
//
// Purely local/ephemeral — position and size live in the parent's state and
// reset whenever the panel is re-opened (nothing is persisted).
// ════════════════════════════════════════════════════════════════════════════

import { useRef } from "react"

interface FloatingPanelProps {
  title: string
  x: number
  y: number
  width?: number
  height?: number
  onMove: (x: number, y: number) => void
  onResize?: (width: number, height: number, x: number) => void  // omit to keep the panel fixed-size
  onClose: () => void
  children: React.ReactNode
}

const MIN_WIDTH  = 280
const MIN_HEIGHT = 200
const DEFAULT_WIDTH  = 420
const DEFAULT_HEIGHT = 480

export function FloatingPanel({ title, x, y, width, height, onMove, onResize, onClose, children }: FloatingPanelProps) {
  const dragState   = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)
  const resizeState = useRef<{ startX: number; startY: number; origX: number; origWidth: number; origHeight: number } | null>(null)

  const w = Math.min(width  ?? DEFAULT_WIDTH,  typeof window !== "undefined" ? window.innerWidth  - 16 : Infinity)
  const h = Math.min(height ?? DEFAULT_HEIGHT, typeof window !== "undefined" ? window.innerHeight - 16 : Infinity)

  // Keep the panel fully reachable on small (mobile) viewports
  function clamp(nx: number, ny: number) {
    const maxX = Math.max(0, window.innerWidth - w)
    const maxY = Math.max(0, window.innerHeight - h)
    return { x: Math.min(Math.max(0, nx), maxX), y: Math.min(Math.max(0, ny), maxY) }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragState.current = { startX: e.clientX, startY: e.clientY, origX: x, origY: y }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragState.current) return
    const dx = e.clientX - dragState.current.startX
    const dy = e.clientY - dragState.current.startY
    const { x: nx, y: ny } = clamp(dragState.current.origX + dx, dragState.current.origY + dy)
    onMove(nx, ny)
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    dragState.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  // Resize handle sits in the bottom-left corner: the right edge stays fixed,
  // so growing the panel leftward both widens it and shifts x left; the top
  // edge stays fixed, so growing it downward only changes height.
  function handleResizePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    resizeState.current = { startX: e.clientX, startY: e.clientY, origX: x, origWidth: w, origHeight: h }
  }

  function handleResizePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!resizeState.current || !onResize) return
    const { startX, startY, origX, origWidth, origHeight } = resizeState.current
    const dx = e.clientX - startX
    const dy = e.clientY - startY

    const rightEdge = origX + origWidth
    let newX     = origX + dx
    let newWidth = rightEdge - newX
    if (newWidth < MIN_WIDTH) { newWidth = MIN_WIDTH; newX = rightEdge - MIN_WIDTH }
    const maxWidth = window.innerWidth - 16
    if (newWidth > maxWidth) { newWidth = maxWidth; newX = rightEdge - maxWidth }
    if (newX < 0) { newX = 0; newWidth = rightEdge - newX }

    const newHeight = Math.max(MIN_HEIGHT, Math.min(window.innerHeight - 16, origHeight + dy))

    onResize(newWidth, newHeight, newX)
  }

  function handleResizePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    resizeState.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  return (
    <div
      className="fixed z-40 flex flex-col rounded-xl bg-zinc-900 ring-1 ring-white/15 shadow-2xl text-white"
      style={{ left: x, top: y, width: w, height: h }}
    >
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="flex items-center gap-2 px-3 py-2 border-b border-white/10 cursor-grab active:cursor-grabbing select-none shrink-0 rounded-t-xl bg-white/5 touch-none"
      >
        <span className="text-sm font-bold text-white truncate flex-1">{title}</span>
        <button type="button" onClick={onClose} onPointerDown={e => e.stopPropagation()}
          className="size-6 flex items-center justify-center rounded-md hover:bg-white/10 text-white/50 hover:text-white text-xs transition-colors shrink-0">
          ✕
        </button>
      </div>
      <div className="overflow-y-auto p-3 flex-1 min-h-0">
        {children}
      </div>
      {onResize && (
        <div
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          onPointerCancel={handleResizePointerUp}
          title="Drag to resize"
          className="absolute bottom-0 left-0 size-4 cursor-nesw-resize touch-none flex items-end justify-start text-white/25 hover:text-white/60 transition-colors"
        >
          <svg viewBox="0 0 10 10" className="size-2.5 mb-0.5 ml-0.5">
            <path d="M0 10 L10 10 L10 0" stroke="currentColor" strokeWidth="1.4" fill="none" />
            <path d="M0 6 L6 6 L6 0" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.7" />
          </svg>
        </div>
      )}
    </div>
  )
}
