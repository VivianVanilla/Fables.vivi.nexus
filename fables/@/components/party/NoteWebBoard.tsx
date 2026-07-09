// ════════════════════════════════════════════════════════════════════════════
// NoteWebBoard.tsx — the Party Notes spiderweb board surface (PartyNotesCanvas).
// Note-kind nodes are LIVE links to a real note in `objects`:
// - Anyone with access to the board can move a node and draw/delete
//   connections.
// - Only the node's owner can edit its content or unlink/delete it — except
//   the DM, who can delete (unlink) anything on a party board.
// - A "New Note" always creates a real, owned note object first, then links
//   it in — dragging in an existing note from the sidebar links it directly,
//   no copy involved.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react"
import { FileText, Image as ImageIcon, Link2, Trash2 } from "lucide-react"
import { useUserContext } from "../../../src/contexts/UserContext"
import { loadUserImages } from "../imageGallery"
import { uniqueName } from "../character-utils"
import { NOTE_DRAG_TYPE } from "./partyTypes"
import { useCanvas, type BoardKey, type CanvasNode } from "./useCanvas"
import { useCanvasPanZoom } from "./useCanvasPanZoom"
import { CanvasNodeViewer } from "./CanvasNodeViewer"

const NODE_W = 176
const NODE_H = 112

export function NoteWebBoard({
  boardKey, currentUserId, isDM = false, resolveOwnerName, title, leftAccessory,
}: {
  boardKey: BoardKey
  currentUserId: string
  isDM?: boolean
  resolveOwnerName?: (ownerId: string) => string
  title: string
  leftAccessory?: React.ReactNode
}) {
  const { objects, createObject, updateObject } = useUserContext()
  const { nodes, edges, linkedNotes, missingRefIds, patchLinkedNote, createNode, moveNode, deleteNode, createEdge, deleteEdge } = useCanvas(boardKey, currentUserId)
  const pz = useCanvasPanZoom()

  // A note deleted from the sidebar (or anywhere else) should disappear from
  // the board too — useCanvas flags its ref_object_id as missing the moment
  // it notices (via realtime DELETE, or the next linked-notes fetch), and
  // this just unlinks the now-dead node client-side. The underlying note
  // object was already gone; this never deletes it again.
  useEffect(() => {
    if (missingRefIds.size === 0) return
    nodes.forEach(n => {
      if (n.ref_object_id && missingRefIds.has(n.ref_object_id)) deleteNode(n.id)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missingRefIds, nodes])

  const [connectMode, setConnectMode] = useState(false)
  const [connectFrom, setConnectFrom] = useState<string | null>(null)
  const [viewerNodeId, setViewerNodeId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [showImagePicker, setShowImagePicker] = useState(false)
  const [pickerImages, setPickerImages] = useState<string[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)
  const [freshEdgeIds, setFreshEdgeIds] = useState<Set<string>>(new Set())
  const [creatingNote, setCreatingNote] = useState(false)
  // Set once at gesture start, cleared once at gesture end — not a per-move
  // update, so it doesn't fight the direct-DOM-write dragging itself does.
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null)

  const viewerNode = nodes.find(n => n.id === viewerNodeId) ?? null

  function noteDisplay(node: CanvasNode) {
    if (node.ref_object_id && linkedNotes[node.ref_object_id]) {
      return linkedNotes[node.ref_object_id]
    }
    return { name: node.title || "Untitled", content: node.content ?? "" }
  }

  // ── Node drag / click ─────────────────────────────────────────────────────
  function onNodeMouseDown(e: React.MouseEvent, node: CanvasNode) {
    if (connectMode) return
    setDraggingNodeId(node.id)
    pz.startNodeDrag(e, node)
  }
  function onNodeTouchStart(e: React.TouchEvent, node: CanvasNode) {
    if (connectMode) return
    setDraggingNodeId(node.id)
    pz.startNodeDragTouch(e, node)
  }
  function onNodeClick(e: React.MouseEvent, node: CanvasNode) {
    e.stopPropagation()
    if (pz.shouldSuppressClick(node.id)) return
    if (connectMode) {
      if (!connectFrom) { setConnectFrom(node.id) }
      else if (connectFrom !== node.id) {
        createEdge(connectFrom, node.id).then(row => {
          if (row) {
            setFreshEdgeIds(prev => new Set(prev).add(row.id))
            setTimeout(() => setFreshEdgeIds(prev => { const n = new Set(prev); n.delete(row.id); return n }), 700)
          }
        })
        setConnectFrom(null)
        setConnectMode(false)
      }
      return
    }
    setViewerNodeId(node.id)
  }
  function onSurfaceUp() {
    const moved = pz.onSurfaceMouseUp()
    setDraggingNodeId(null)
    if (moved) moveNode(moved.id, moved.x, moved.y)
  }
  function onSurfaceTouchEnd() {
    const moved = pz.onSurfaceTouchEnd()
    setDraggingNodeId(null)
    if (moved) moveNode(moved.id, moved.x, moved.y)
  }

  // ── Create nodes ──────────────────────────────────────────────────────────
  async function createNoteNode(atX = 140, atY = 140) {
    if (creatingNote) return
    setCreatingNote(true)
    try {
      const name = uniqueName("New Note", objects.filter(o => o.type === "note").map(o => o.name))
      const note = await createObject({ name, type: "note", data: { content: "" } })
      const { x, y } = pz.toWorld(atX, atY)
      await createNode({ kind: "note", title: note.name, ref_object_id: note.id, x, y })
    } catch (e) { console.error(e) }
    setCreatingNote(false)
  }

  const loadPickerImages = async () => {
    setPickerLoading(true)
    const imgs = await loadUserImages(currentUserId)
    setPickerImages(imgs.map(i => i.publicUrl))
    setPickerLoading(false)
  }
  async function openImagePicker() { setShowImagePicker(true); await loadPickerImages() }
  function pickImage(url: string) {
    setShowImagePicker(false)
    const { x, y } = pz.toWorld(180, 180)
    createNode({ kind: "image", title: "Image", image_url: url, x, y })
  }

  // ── Drop a personal note in from the sidebar — links it live, no copy ────
  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const raw = e.dataTransfer.getData(NOTE_DRAG_TYPE)
    if (!raw) return
    let ref: { objectId?: string; name?: string }
    try { ref = JSON.parse(raw) } catch { return }
    if (!ref.objectId) return
    const note = objects.find(o => o.id === ref.objectId)
    if (!note) return
    if (nodes.some(n => n.ref_object_id === note.id)) return // already linked on this board
    const { x, y } = pz.toWorld(e.clientX, e.clientY)
    createNode({ kind: "note", title: note.name, ref_object_id: note.id, x, y })
  }

  async function saveLinkedNote(refId: string, content: string) {
    const existing = linkedNotes[refId]
    const nextData = { ...(existing?.data ?? {}), content }
    patchLinkedNote(refId, content) // instant — don't wait on the realtime round-trip
    try { await updateObject(refId, { data: nextData as unknown as JSON }) }
    catch (e) { console.error(e) }
  }

  function canModify(node: CanvasNode) {
    return node.owner_id === currentUserId || isDM
  }

  function edgeMidpoint(a: CanvasNode, b: CanvasNode) {
    return { x: (a.x + NODE_W / 2 + b.x + NODE_W / 2) / 2, y: (a.y + NODE_H / 2 + b.y + NODE_H / 2) / 2 }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 relative">
      {/* Toolbar — horizontally scrollable so it degrades gracefully on narrow phones instead of clipping */}
      <div className="px-3.5 py-2 border-b border-border shrink-0 flex items-center gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden">
        {leftAccessory}
        <span className="text-sm font-bold text-foreground mr-1 shrink-0">{title}</span>
        <button type="button" onClick={() => createNoteNode()} disabled={creatingNote}
          className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg bg-foreground/8 hover:bg-foreground/15 text-foreground/80 transition-colors disabled:opacity-40 shrink-0">
          <FileText className="size-3.5" /> New Note
        </button>
        <button type="button" onClick={openImagePicker}
          className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg bg-foreground/8 hover:bg-foreground/15 text-foreground/80 transition-colors shrink-0">
          <ImageIcon className="size-3.5" /> Image
        </button>
        <button type="button" onClick={() => { setConnectMode(v => !v); setConnectFrom(null) }}
          className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg transition-colors shrink-0 ${connectMode ? "bg-violet-500/25 text-violet-200" : "bg-foreground/8 hover:bg-foreground/15 text-foreground/80"}`}>
          <Link2 className="size-3.5" /> {connectMode ? (connectFrom ? "Pick target node…" : "Pick source node…") : "Connect"}
        </button>
        <div className="flex-1" />
        <span className="text-[10px] text-muted-foreground/40">{Math.round(pz.zoom * 100)}%</span>
      </div>

      {/* Canvas surface */}
      <div
        ref={pz.surfaceRef}
        className={`flex-1 min-h-0 relative overflow-hidden bg-muted/40 cursor-grab active:cursor-grabbing touch-none ${dragOver ? "ring-2 ring-inset ring-violet-400/50" : ""}`}
        onMouseDown={pz.onSurfaceMouseDown}
        onMouseMove={pz.onSurfaceMouseMove}
        onMouseUp={onSurfaceUp}
        onMouseLeave={onSurfaceUp}
        onTouchStart={pz.onSurfaceTouchStart}
        onTouchMove={pz.onSurfaceTouchMove}
        onTouchEnd={onSurfaceTouchEnd}
        onWheel={pz.onWheel}
        onDragOver={e => { if (e.dataTransfer.types.includes(NOTE_DRAG_TYPE)) { e.preventDefault(); setDragOver(true) } }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        {/* Pan/zoom is written straight to this element's transform by the
            hook (see useCanvasPanZoom) — no React state round-trip per frame.
            The dotted background lives here too (fixed size, not zoom-scaled
            in JS) so it visually scales for free via the same transform. */}
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
          {/* Edges */}
          <svg className="absolute overflow-visible pointer-events-none" style={{ left: 0, top: 0, width: 8000, height: 8000 }}>
            {edges.map(edge => {
              const a = nodes.find(n => n.id === edge.from_node_id)
              const b = nodes.find(n => n.id === edge.to_node_id)
              if (!a || !b) return null
              const mid = edgeMidpoint(a, b)
              const fresh = freshEdgeIds.has(edge.id)
              return (
                <g key={edge.id}>
                  <line x1={a.x + NODE_W / 2} y1={a.y + NODE_H / 2} x2={b.x + NODE_W / 2} y2={b.y + NODE_H / 2}
                    stroke="var(--color-muted-foreground)" strokeOpacity={0.35} strokeWidth={2}
                    strokeDasharray={fresh ? 400 : undefined}
                    strokeDashoffset={fresh ? 400 : 0}
                    style={fresh ? { animation: "party-edge-draw 0.6s ease-out forwards" } : undefined} />
                  <circle cx={mid.x} cy={mid.y} r={7} fill="var(--color-card)" stroke="var(--color-border)"
                    className="cursor-pointer pointer-events-auto hover:fill-red-500/70 transition-colors"
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); deleteEdge(edge.id) }} />
                </g>
              )
            })}
          </svg>

          {/* Nodes */}
          {nodes.map(node => {
            const display = node.kind === "note" ? noteDisplay(node) : null
            const dragging = draggingNodeId === node.id
            return (
              <div
                key={node.id}
                ref={el => pz.setNodeEl(node.id, el)}
                onMouseDown={e => onNodeMouseDown(e, node)}
                onTouchStart={e => onNodeTouchStart(e, node)}
                onClick={e => onNodeClick(e, node)}
                style={{
                  left: 0, top: 0, width: NODE_W, height: NODE_H,
                  transform: `translate3d(${node.x}px, ${node.y}px, 0)`,
                  transition: dragging ? "none" : "box-shadow 0.15s ease, border-color 0.15s ease",
                  willChange: dragging ? "transform" : undefined,
                  zIndex: dragging ? 10 : undefined,
                }}
                className={`group absolute rounded-xl border bg-card shadow-md overflow-hidden cursor-pointer select-none hover:shadow-lg ${connectFrom === node.id ? "border-violet-400 ring-2 ring-violet-400/50 animate-pulse" : "border-border"}`}
              >
                {node.kind === "image" && node.image_url ? (
                  <img src={node.image_url} alt={node.title} className="w-full h-full object-cover" draggable={false} />
                ) : (
                  <div className="p-2.5 flex flex-col h-full">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <p className="text-xs font-semibold text-foreground truncate">{display?.name || "Untitled"}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground/60 line-clamp-4 whitespace-pre-wrap flex-1 overflow-hidden">
                      {display?.content?.trim() || "Empty note."}
                    </p>
                    {resolveOwnerName && (
                      <span className="mt-1 self-start text-[8px] px-1.5 py-0.5 rounded-full bg-foreground/8 text-muted-foreground/70 truncate max-w-full">
                        {resolveOwnerName(node.owner_id)}
                      </span>
                    )}
                  </div>
                )}
                {canModify(node) && (
                  // Always visible on touch devices — :hover never fires reliably from a
                  // tap, so a hover-only affordance is effectively unreachable on mobile.
                  <button type="button" onClick={e => { e.stopPropagation(); deleteNode(node.id) }} title="Remove from board"
                    className="absolute top-1 right-1 size-5 flex items-center justify-center rounded-md bg-black/50 text-white/70 hover:text-red-300 opacity-0 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100 transition-opacity">
                    <Trash2 className="size-3" />
                  </button>
                )}
                {node.kind === "image" && (
                  <span className="absolute bottom-1 left-1.5 text-[9px] px-1.5 py-0.5 rounded-full bg-black/50 text-white/80 truncate max-w-[80%]">{node.title}</span>
                )}
              </div>
            )
          })}

          {nodes.length === 0 && (
            <div style={{ left: 40, top: 40 }} className="absolute text-xs text-muted-foreground/40 italic w-72">
              Empty board — drag a note in from the sidebar, or use "New Note" / "Image" above.
            </div>
          )}
        </div>
      </div>

      {viewerNode && (
        <CanvasNodeViewer
          node={viewerNode}
          liveTitle={viewerNode.kind === "note" ? noteDisplay(viewerNode).name : undefined}
          liveContent={viewerNode.kind === "note" ? noteDisplay(viewerNode).content : undefined}
          onClose={() => setViewerNodeId(null)}
          onSave={canModify(viewerNode) && viewerNode.ref_object_id
            ? patch => saveLinkedNote(viewerNode.ref_object_id as string, patch.content)
            : undefined}
        />
      )}

      {showImagePicker && (
        <div className="absolute inset-0 z-20 flex flex-col bg-card/98 backdrop-blur rounded-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <span className="text-sm font-semibold text-foreground">Pick a profile image</span>
            <button type="button" onClick={() => setShowImagePicker(false)}
              className="text-muted-foreground hover:text-foreground text-lg leading-none">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {pickerLoading && <p className="text-xs text-muted-foreground/50 text-center mt-8">Loading…</p>}
            {!pickerLoading && pickerImages.length === 0 && (
              <p className="text-xs text-muted-foreground/40 italic text-center mt-8 px-4">
                No profile images yet — upload one from Profile Settings first.
              </p>
            )}
            <div className="grid grid-cols-3 gap-2">
              {pickerImages.map(url => (
                <button key={url} type="button" onClick={() => pickImage(url)}
                  className="aspect-square rounded-xl overflow-hidden hover:ring-2 hover:ring-foreground/50 transition-all">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
