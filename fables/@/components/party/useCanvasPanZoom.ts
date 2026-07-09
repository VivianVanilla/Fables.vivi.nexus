// ════════════════════════════════════════════════════════════════════════════
// useCanvasPanZoom.ts — pan/zoom/drag mechanics for the Party Notes board
// (NoteWebBoard / PartyNotesCanvas).
//
// Perf note: pan and node-drag write DIRECTLY to the DOM (via contentRef /
// per-node refs) on every move event instead of going through React state.
// Driving a `setState` off every touchmove was the actual cause of "laggy on
// mobile" — each one re-ran the whole board's render (every node, every
// edge) just to move one thing a few pixels. React state is only touched
// once, when the gesture ends, to persist the final position.
// ════════════════════════════════════════════════════════════════════════════

import { useLayoutEffect, useRef, useState } from "react"

const DRAG_THRESHOLD = 4 // px of movement before a mousedown counts as a drag, not a click

export function useCanvasPanZoom(initial: { x: number; y: number } = { x: 40, y: 40 }) {
  const [pan, setPan] = useState(initial)
  const [zoom, setZoom] = useState(1)

  const surfaceRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null) // the transformed layer — pan+zoom written here directly during a gesture

  // Live values during an active gesture — kept in sync with `pan`/`zoom`
  // state whenever those change from outside a gesture (mount, wheel zoom,
  // programmatic reset) so the next gesture starts from the right place.
  const panRef = useRef(initial)
  const zoomRef = useRef(1)

  function applyTransform() {
    if (contentRef.current) {
      contentRef.current.style.transform = `translate(${panRef.current.x}px, ${panRef.current.y}px) scale(${zoomRef.current})`
    }
  }
  useLayoutEffect(() => { panRef.current = pan; applyTransform() }, [pan])
  useLayoutEffect(() => { zoomRef.current = zoom; applyTransform() }, [zoom])

  const panGesture = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)
  const nodeDrag = useRef<{
    id: string; startX: number; startY: number; origX: number; origY: number
    moved: boolean; curX: number; curY: number; el: HTMLElement | null
  } | null>(null)
  const pinch = useRef<{ startDist: number; startZoom: number } | null>(null)
  const justDraggedId = useRef<string | null>(null)
  const nodeEls = useRef(new Map<string, HTMLDivElement>())

  // Attach to each node's root element: `ref={el => setNodeEl(node.id, el)}`
  function setNodeEl(id: string, el: HTMLDivElement | null) {
    if (el) nodeEls.current.set(id, el); else nodeEls.current.delete(id)
  }

  function toWorld(clientX: number, clientY: number) {
    const rect = surfaceRef.current?.getBoundingClientRect()
    const left = rect?.left ?? 0
    const top = rect?.top ?? 0
    return { x: (clientX - left - panRef.current.x) / zoomRef.current, y: (clientY - top - panRef.current.y) / zoomRef.current }
  }

  // ── Shared core (driven by either mouse or touch coordinates) ────────────
  function beginPan(clientX: number, clientY: number) {
    panGesture.current = { startX: clientX, startY: clientY, origX: panRef.current.x, origY: panRef.current.y }
  }
  function movePan(clientX: number, clientY: number) {
    if (!panGesture.current) return
    const dx = clientX - panGesture.current.startX
    const dy = clientY - panGesture.current.startY
    panRef.current = { x: panGesture.current.origX + dx, y: panGesture.current.origY + dy }
    applyTransform()
  }
  function endPan() {
    if (!panGesture.current) return
    panGesture.current = null
    setPan({ ...panRef.current }) // commit once
  }

  function beginNodeDrag(id: string, clientX: number, clientY: number, origX: number, origY: number) {
    nodeDrag.current = { id, startX: clientX, startY: clientY, origX, origY, moved: false, curX: origX, curY: origY, el: nodeEls.current.get(id) ?? null }
  }
  function moveNodeDrag(clientX: number, clientY: number) {
    const d = nodeDrag.current
    if (!d) return
    const dx = (clientX - d.startX) / zoomRef.current
    const dy = (clientY - d.startY) / zoomRef.current
    if (!d.moved && Math.hypot(clientX - d.startX, clientY - d.startY) > DRAG_THRESHOLD) d.moved = true
    d.curX = d.origX + dx
    d.curY = d.origY + dy
    if (d.el) d.el.style.transform = `translate3d(${d.curX}px, ${d.curY}px, 0)`
  }
  // Returns the moved node's final position so the caller can persist it —
  // and remembers that id briefly so the click event right after release
  // can be told to ignore itself (see shouldSuppressClick).
  function endDrag(): { id: string; x: number; y: number } | null {
    let result: { id: string; x: number; y: number } | null = null
    if (nodeDrag.current && nodeDrag.current.moved) {
      result = { id: nodeDrag.current.id, x: nodeDrag.current.curX, y: nodeDrag.current.curY }
      justDraggedId.current = result.id
    }
    panGesture.current = null
    nodeDrag.current = null
    return result
  }

  // ── Mouse ──────────────────────────────────────────────────────────────
  function onSurfaceMouseDown(e: React.MouseEvent) {
    // No `target === currentTarget` check here on purpose: the pannable
    // content sits in an absolutely-positioned wrapper that covers the
    // entire surface, so `target` is essentially never the surface element
    // itself even over empty space — that check silently disabled panning
    // altogether. Nodes already call stopPropagation() in their own
    // mousedown handler, so anything that reaches here genuinely is a
    // background drag.
    beginPan(e.clientX, e.clientY)
  }
  function onSurfaceMouseMove(e: React.MouseEvent) {
    if (panGesture.current) movePan(e.clientX, e.clientY)
    else if (nodeDrag.current) moveNodeDrag(e.clientX, e.clientY)
  }
  function onSurfaceMouseUp(): { id: string; x: number; y: number } | null {
    endPan()
    return endDrag()
  }
  function startNodeDrag(e: React.MouseEvent, node: { id: string; x: number; y: number }) {
    e.stopPropagation()
    beginNodeDrag(node.id, e.clientX, e.clientY, node.x, node.y)
  }

  // ── Touch — single finger pans/drags, two fingers pinch-zoom ─────────────
  function onSurfaceTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]]
      pinch.current = { startDist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), startZoom: zoomRef.current }
      panGesture.current = null
      return
    }
    if (e.touches.length === 1) beginPan(e.touches[0].clientX, e.touches[0].clientY)
  }
  function onSurfaceTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && pinch.current) {
      e.preventDefault()
      const [a, b] = [e.touches[0], e.touches[1]]
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      const ratio = dist / pinch.current.startDist
      zoomRef.current = Math.min(2.5, Math.max(0.3, +(pinch.current.startZoom * ratio).toFixed(2)))
      applyTransform()
      return
    }
    if (e.touches.length === 1) {
      const t = e.touches[0]
      if (panGesture.current) movePan(t.clientX, t.clientY)
      else if (nodeDrag.current) moveNodeDrag(t.clientX, t.clientY)
    }
  }
  function onSurfaceTouchEnd(): { id: string; x: number; y: number } | null {
    if (pinch.current) { pinch.current = null; setZoom(zoomRef.current) } // commit pinch result once
    endPan()
    return endDrag()
  }
  function startNodeDragTouch(e: React.TouchEvent, node: { id: string; x: number; y: number }) {
    e.stopPropagation()
    const t = e.touches[0]
    beginNodeDrag(node.id, t.clientX, t.clientY, node.x, node.y)
  }

  // Call from a node's onClick. Returns true (and clears the flag) exactly
  // once, right after that node was actually dragged — so the click that
  // the browser fires on release doesn't also pop the viewer open.
  function shouldSuppressClick(nodeId: string): boolean {
    if (justDraggedId.current === nodeId) {
      justDraggedId.current = null
      return true
    }
    return false
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault()
    setZoom(z => Math.min(2.5, Math.max(0.3, +(z - e.deltaY * 0.001).toFixed(2))))
  }

  function zoomBy(delta: number) {
    setZoom(z => Math.min(2.5, Math.max(0.3, +(z + delta).toFixed(2))))
  }

  return {
    pan, setPan, zoom, setZoom,
    surfaceRef, contentRef, setNodeEl, toWorld,
    onSurfaceMouseDown, onSurfaceMouseMove, onSurfaceMouseUp,
    onSurfaceTouchStart, onSurfaceTouchMove, onSurfaceTouchEnd,
    startNodeDrag, startNodeDragTouch, shouldSuppressClick,
    onWheel, zoomBy,
  }
}
