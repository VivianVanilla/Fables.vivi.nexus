// ════════════════════════════════════════════════════════════════════════════
// CanvasNodeViewer.tsx — full-screen zoomable viewer for a canvas node,
// opened by clicking a note or image node on the Party Notes canvas.
// ════════════════════════════════════════════════════════════════════════════

import { useRef, useState } from "react"
import { ZoomIn, ZoomOut, RotateCcw, Pencil, Eye } from "lucide-react"
import { Markdown } from "../ui/Markdown"
import { MarkdownTextarea } from "../ui/MarkdownTextarea"
import type { CanvasNode } from "./useCanvas"

export function CanvasNodeViewer({ node, onClose, onSave, liveTitle, liveContent, onNoteLink }: {
  node: CanvasNode
  onClose: () => void
  onSave?: (patch: { content: string }) => void
  liveTitle?: string
  liveContent?: string
  onNoteLink?: (name: string) => void
}) {
  const displayTitle = liveTitle ?? node.title
  const displayContent = liveContent ?? node.content ?? ""

  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(displayContent)
  const dragging = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)

  function onMouseDown(e: React.MouseEvent) {
    if (scale <= 1) return
    dragging.current = { startX: e.clientX, startY: e.clientY, origX: pan.x, origY: pan.y }
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragging.current) return
    const dx = e.clientX - dragging.current.startX
    const dy = e.clientY - dragging.current.startY
    setPan({ x: dragging.current.origX + dx, y: dragging.current.origY + dy })
  }
  function onMouseUp() { dragging.current = null }

  function zoomBy(delta: number) {
    setScale(s => Math.min(4, Math.max(0.5, +(s + delta).toFixed(2))))
  }
  function reset() { setScale(1); setPan({ x: 0, y: 0 }) }

  function toggleEdit() {
    if (editing) onSave?.({ content: draft })
    setEditing(v => !v)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="flex items-center justify-between px-5 py-3 shrink-0" onClick={e => e.stopPropagation()}>
        <span className="text-sm font-semibold text-white">{displayTitle || "Untitled"}</span>
        <div className="flex items-center gap-1.5">
          {node.kind === "note" && onSave && (
            <button type="button" onClick={toggleEdit} title={editing ? "Preview" : "Edit note"}
              className="size-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
              {editing ? <Eye className="size-4" /> : <Pencil className="size-4" />}
            </button>
          )}
          <button type="button" onClick={() => zoomBy(-0.25)} className="size-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
            <ZoomOut className="size-4" />
          </button>
          <span className="text-xs text-white/60 w-10 text-center tabular-nums">{Math.round(scale * 100)}%</span>
          <button type="button" onClick={() => zoomBy(0.25)} className="size-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
            <ZoomIn className="size-4" />
          </button>
          <button type="button" onClick={reset} className="size-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
            <RotateCcw className="size-3.5" />
          </button>
          <button type="button" onClick={onClose} className="ml-2 text-white/60 hover:text-white text-lg leading-none px-1">✕</button>
        </div>
      </div>

      <div
        className={`flex-1 min-h-0 overflow-hidden flex items-center justify-center ${scale > 1 ? "cursor-grab active:cursor-grabbing" : ""}`}
        onClick={e => e.stopPropagation()}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <div
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, transition: dragging.current ? "none" : "transform 0.12s ease-out" }}
          className="max-w-3xl w-full mx-6"
        >
          {node.kind === "image" && node.image_url ? (
            <img src={node.image_url} alt={displayTitle} className="max-w-full max-h-[75vh] mx-auto rounded-lg select-none" draggable={false} />
          ) : editing ? (
            <div className="bg-zinc-900 rounded-xl p-4 max-h-[75vh] overflow-y-auto" onMouseDown={e => e.stopPropagation()}>
              <MarkdownTextarea
                value={draft}
                onChange={setDraft}
                autoFocus
                className="w-full min-h-64 bg-transparent outline-none text-sm text-white/85 placeholder:text-white/20 resize-none leading-relaxed font-mono"
                wrapperClassName="flex flex-col gap-1"
                variant="light"
              />
            </div>
          ) : (
            <div className="bg-zinc-900 rounded-xl p-6 max-h-[75vh] overflow-y-auto select-text">
              {displayContent.trim() ? <Markdown text={displayContent} tone="dark" size="sm" onNoteLink={onNoteLink} /> : <p className="text-sm text-white/40 italic">Empty note.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
