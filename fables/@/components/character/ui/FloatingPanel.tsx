// ════════════════════════════════════════════════════════════════════════════
// FloatingPanel.tsx — draggable, always-on-top window
//
// Purely local/ephemeral — position lives in the parent's state and resets
// whenever the panel is re-opened (nothing is persisted).
// ════════════════════════════════════════════════════════════════════════════

import { useRef } from "react"

interface FloatingPanelProps {
  title: string
  x: number
  y: number
  onMove: (x: number, y: number) => void
  onClose: () => void
  children: React.ReactNode
}

export function FloatingPanel({ title, x, y, onMove, onClose, children }: FloatingPanelProps) {
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)
  const panelRef   = useRef<HTMLDivElement>(null)

  // Keep the panel fully reachable on small (mobile) viewports
  function clamp(nx: number, ny: number) {
    const rect = panelRef.current?.getBoundingClientRect()
    const w = rect?.width ?? 320
    const h = rect?.height ?? 160
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

  return (
    <div
      ref={panelRef}
      className="fixed z-40 flex flex-col rounded-xl bg-zinc-900 ring-1 ring-white/15 shadow-2xl w-[min(420px,calc(100vw-2rem))] max-h-[80vh] text-white"
      style={{ left: x, top: y }}
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
    </div>
  )
}
