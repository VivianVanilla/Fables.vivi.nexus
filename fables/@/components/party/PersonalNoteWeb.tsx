// ════════════════════════════════════════════════════════════════════════════
// PersonalNoteWeb.tsx — a small imitation of Obsidian's graph view: every
// note you own shows up here automatically (nothing to create or import),
// connected wherever one note's content actually references another via
// [[Name]]. Drag a card to rearrange the layout, or drag its corner to
// resize it and read as much as you need (both remembered) — same
// interaction as the familiar popout window. There's nothing to delete or
// manually connect here; it's a live reflection of your notes, not a
// separate thing you curate. Delete or unlink a note from the sidebar
// instead, and it disappears from here too.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from "react"
import { useUserContext } from "../../../src/contexts/UserContext"
import { useNavigation } from "../../../src/contexts/NavigationContext"
import { safeParseJson } from "../character-utils"
import { extractWikilinkNames } from "./wikilinks"
import { useCanvasPanZoom } from "./useCanvasPanZoom"
import { Markdown } from "../ui/Markdown"

const NODE_W = 200
const NODE_H = 120
const MIN_W = 160
const MIN_H = 90
const MAX_W = 640
const MAX_H = 520
const GRID_COLS = 5
const GRID_SPACING_X = 240
const GRID_SPACING_Y = 160

interface WebNote {
  id: string
  name: string
  content: string
  x: number
  y: number
  w: number
  h: number
  hasSavedPosition: boolean
}

export function PersonalNoteWeb({ onClose }: { onClose: () => void }) {
  const { objects, updateObject } = useUserContext()
  const { openObjectId } = useNavigation()
  const pz = useCanvasPanZoom()

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [resizing, setResizing] = useState<{ id: string; w: number; h: number } | null>(null)
  const resizeGesture = useRef<{ id: string; startX: number; startY: number; origW: number; origH: number } | null>(null)
  const persistedGridSlot = useRef<Set<string>>(new Set())

  const notes = useMemo(() => objects.filter(o => o.type === "note"), [objects])

  // Saved webX/webY/webW/webH if the note has them; otherwise a deterministic
  // grid slot (stable by id order) and default size, so unpositioned notes
  // don't jump around on re-render.
  const positioned: WebNote[] = useMemo(() => {
    let gridIndex = 0
    return notes.map(n => {
      const data = safeParseJson(n.data) as { content?: string; webX?: number; webY?: number; webW?: number; webH?: number }
      const hasSavedPosition = data.webX != null && data.webY != null
      let x = data.webX ?? 0
      let y = data.webY ?? 0
      if (!hasSavedPosition) {
        x = (gridIndex % GRID_COLS) * GRID_SPACING_X + 40
        y = Math.floor(gridIndex / GRID_COLS) * GRID_SPACING_Y + 40
        gridIndex++
      }
      return { id: n.id, name: n.name, content: data.content ?? "", x, y, w: data.webW ?? NODE_W, h: data.webH ?? NODE_H, hasSavedPosition }
    })
  }, [notes])

  // Freshly-assigned grid slots get written back once so the layout is
  // stable across reloads instead of being recomputed (and potentially
  // shifting) every time this view mounts.
  useEffect(() => {
    positioned.forEach(note => {
      if (note.hasSavedPosition || persistedGridSlot.current.has(note.id)) return
      persistedGridSlot.current.add(note.id)
      const original = notes.find(n => n.id === note.id)
      if (!original) return
      const data = safeParseJson(original.data) as Record<string, unknown>
      updateObject(note.id, { data: { ...data, webX: note.x, webY: note.y } as unknown as JSON }).catch(e => console.error(e))
    })
  }, [positioned, notes, updateObject])

  // Connections are entirely derived from [[links]] in content — nothing to
  // draw or delete manually.
  const edges = useMemo(() => {
    const byNameLower = new Map(positioned.map(n => [n.name.toLowerCase(), n]))
    const seen = new Set<string>()
    const result: { a: string; b: string }[] = []
    positioned.forEach(n => {
      for (const linkName of extractWikilinkNames(n.content)) {
        const target = byNameLower.get(linkName)
        if (!target || target.id === n.id) continue
        const key = [n.id, target.id].sort().join("~")
        if (seen.has(key)) continue
        seen.add(key)
        result.push({ a: n.id, b: target.id })
      }
    })
    return result
  }, [positioned])

  function persistPosition(id: string, x: number, y: number) {
    const note = notes.find(n => n.id === id)
    if (!note) return
    const data = safeParseJson(note.data) as Record<string, unknown>
    updateObject(id, { data: { ...data, webX: x, webY: y } as unknown as JSON }).catch(e => console.error(e))
  }
  function persistSize(id: string, w: number, h: number) {
    const note = notes.find(n => n.id === id)
    if (!note) return
    const data = safeParseJson(note.data) as Record<string, unknown>
    updateObject(id, { data: { ...data, webW: w, webH: h } as unknown as JSON }).catch(e => console.error(e))
  }

  function onNodeMouseDown(e: React.MouseEvent, note: WebNote) {
    setDraggingId(note.id)
    pz.startNodeDrag(e, note)
  }
  function onNodeTouchStart(e: React.TouchEvent, note: WebNote) {
    setDraggingId(note.id)
    pz.startNodeDragTouch(e, note)
  }
  function onNodeClick(e: React.MouseEvent, note: WebNote) {
    e.stopPropagation()
    if (pz.shouldSuppressClick(note.id)) return
    openObjectId(note.id)
  }
  function goToNoteByName(name: string) {
    const match = positioned.find(n => n.name.toLowerCase() === name.toLowerCase())
    if (match) openObjectId(match.id)
  }
  function onSurfaceUp() {
    const moved = pz.onSurfaceMouseUp()
    setDraggingId(null)
    if (moved) persistPosition(moved.id, moved.x, moved.y)
  }
  function onSurfaceTouchEnd() {
    const moved = pz.onSurfaceTouchEnd()
    setDraggingId(null)
    if (moved) persistPosition(moved.id, moved.x, moved.y)
  }

  // Same drag-the-corner resize interaction as the familiar popout window
  // (see FloatingPanel.tsx) — Pointer Events unify mouse/touch/pen, and the
  // delta is divided by the current canvas zoom since the card lives inside
  // the pan/zoom-transformed layer, not screen space.
  function handleResizePointerDown(e: React.PointerEvent, note: WebNote) {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    resizeGesture.current = { id: note.id, startX: e.clientX, startY: e.clientY, origW: note.w, origH: note.h }
    setResizing({ id: note.id, w: note.w, h: note.h })
  }
  function handleResizePointerMove(e: React.PointerEvent) {
    const g = resizeGesture.current
    if (!g) return
    const dx = (e.clientX - g.startX) / pz.zoom
    const dy = (e.clientY - g.startY) / pz.zoom
    const w = Math.min(MAX_W, Math.max(MIN_W, g.origW + dx))
    const h = Math.min(MAX_H, Math.max(MIN_H, g.origH + dy))
    setResizing({ id: g.id, w, h })
  }
  function handleResizePointerUp(e: React.PointerEvent) {
    const g = resizeGesture.current
    if (g && resizing) persistSize(g.id, resizing.w, resizing.h)
    resizeGesture.current = null
    setResizing(null)
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 border-b border-border shrink-0 bg-card">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-foreground/70 hover:text-foreground hover:bg-foreground/5 transition-colors text-left"
        >
          <span className="text-base leading-none">←</span>
          <span>Note Web</span>
        </button>
        <span className="text-[10px] text-muted-foreground/40 ml-auto mr-3">
          {positioned.length} note{positioned.length !== 1 ? "s" : ""} · {edges.length} link{edges.length !== 1 ? "s" : ""} · {Math.round(pz.zoom * 100)}%
        </span>
      </div>

      <div className="flex-1 min-h-0 bg-card relative">
        <div
          ref={pz.surfaceRef}
          className="absolute inset-0 overflow-hidden bg-muted/40 cursor-grab active:cursor-grabbing touch-none"
          onMouseDown={pz.onSurfaceMouseDown}
          onMouseMove={pz.onSurfaceMouseMove}
          onMouseUp={onSurfaceUp}
          onMouseLeave={onSurfaceUp}
          onTouchStart={pz.onSurfaceTouchStart}
          onTouchMove={pz.onSurfaceTouchMove}
          onTouchEnd={onSurfaceTouchEnd}
          onWheel={pz.onWheel}
        >
          <div
            ref={pz.contentRef}
            style={{
              left: 0, top: 0, width: 8000, height: 8000,
              transformOrigin: "0 0",
              backgroundImage: "radial-gradient(circle, var(--color-border) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
            className="absolute"
          >
            <svg className="absolute overflow-visible pointer-events-none" style={{ left: 0, top: 0, width: 8000, height: 8000 }}>
              {edges.map(edge => {
                const a = positioned.find(n => n.id === edge.a)
                const b = positioned.find(n => n.id === edge.b)
                if (!a || !b) return null
                return (
                  <line key={`${edge.a}~${edge.b}`} x1={a.x + a.w / 2} y1={a.y + a.h / 2} x2={b.x + b.w / 2} y2={b.y + b.h / 2}
                    stroke="var(--color-muted-foreground)" strokeOpacity={0.35} strokeWidth={1.5} />
                )
              })}
            </svg>

            {positioned.map(note => {
              const size = resizing?.id === note.id ? resizing : { w: note.w, h: note.h }
              const active = draggingId === note.id || resizing?.id === note.id
              return (
                <div
                  key={note.id}
                  ref={el => pz.setNodeEl(note.id, el)}
                  onMouseDown={e => onNodeMouseDown(e, note)}
                  onTouchStart={e => onNodeTouchStart(e, note)}
                  onClick={e => onNodeClick(e, note)}
                  style={{
                    left: 0, top: 0, width: size.w, height: size.h,
                    transform: `translate3d(${note.x}px, ${note.y}px, 0)`,
                    transition: active ? "none" : "box-shadow 0.15s ease, border-color 0.15s ease",
                    zIndex: active ? 10 : undefined,
                  }}
                  className="group absolute rounded-xl border border-white/10 bg-zinc-900 shadow-md overflow-hidden cursor-pointer select-none hover:shadow-lg hover:border-violet-400/50"
                >
                  <div className="p-2.5 flex flex-col h-full">
                    <p className="text-xs font-semibold text-white truncate mb-1 shrink-0">{note.name || "Untitled"}</p>
                    <div className="flex-1 min-h-0 overflow-y-auto" onMouseDown={e => e.stopPropagation()}>
                      {note.content.trim()
                        ? <Markdown text={note.content} tone="dark" size="xs" onNoteLink={goToNoteByName} />
                        : <p className="text-[10px] text-white/30 italic">Empty note.</p>}
                    </div>
                  </div>
                  <div
                    onPointerDown={e => handleResizePointerDown(e, note)}
                    onPointerMove={handleResizePointerMove}
                    onPointerUp={handleResizePointerUp}
                    onPointerCancel={handleResizePointerUp}
                    title="Drag to resize"
                    className="absolute bottom-0 right-0 size-4 cursor-nwse-resize touch-none flex items-end justify-end text-white/25 hover:text-white/60 transition-colors"
                  >
                    <svg viewBox="0 0 10 10" className="size-2.5 mb-0.5 mr-0.5">
                      <path d="M10 0 L10 10 L0 10" stroke="currentColor" strokeWidth="1.4" fill="none" />
                      <path d="M10 4 L4 10" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.7" />
                    </svg>
                  </div>
                </div>
              )
            })}

            {positioned.length === 0 && (
              <div style={{ left: 40, top: 40 }} className="absolute text-xs text-muted-foreground/40 italic w-72">
                No notes yet — create one from the sidebar and it'll show up here automatically.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
