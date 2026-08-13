
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { MapPin as MapPinIcon, LocateFixed, Move, Paintbrush, Eraser, Undo2, X, ZoomIn, ZoomOut, Minus, Plus, ImagePlus, Check, Trash2 } from "lucide-react"
import { usePartyRoster } from "../party/usePartyServer"
import { useMapPanZoom } from "./useMapPanZoom"
import { useMapBoard, PIN_COLORS, DEFAULT_PIN_COLOR, type StrokePoint } from "./useMapBoard"
import { MapPinViewer } from "./MapPinViewer"
import { uploadUserImage, loadUserImages, type GalleryImage } from "../imageGallery"
import { PortraitModal } from "../character/modals/PortraitModal"

// Served straight from public/ (like favicon.svg — see index.html) rather
// than imported, since Vite copies public/ assets as-is instead of
// fingerprinting them through the module graph.
const hjollandUrl = "/hjolland.svg"

const MAP_W = 2400
const MAP_H = 1804
const PIN_SIZE = 40
const PIN_ICON_SIZE = 45
const TOKEN_SIZE = 40
const LABEL_SIZE_KEY = "fables-map-label-size"
const MIN_LABEL_SIZE = 8
const MAX_LABEL_SIZE = 20
const BRUSH_SIZE_KEY = "fables-map-brush-size"
const MIN_BRUSH_SIZE = 2
const MAX_BRUSH_SIZE = 80

function drawStroke(ctx: CanvasRenderingContext2D, color: string, size: number, erase: boolean, points: StrokePoint[]) {
  ctx.globalCompositeOperation = erase ? "destination-out" : "source-over"
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = size
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  if (points.length === 1) {
    ctx.beginPath()
    ctx.arc(points[0].x, points[0].y, size / 2, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y)
  ctx.stroke()
}

export function MapOverlay({
  partyCode, currentUserId, currentUserName, isDM, onClose,
}: {
  partyCode: string
  currentUserId: string
  currentUserName: string
  isDM: boolean
  onClose: () => void
}) {
  const { members, dmUserId } = usePartyRoster(partyCode)
  const {
    pins, notes, tokens, strokes, createPin, movePin, renamePin, recolorPin, deletePin, addNote, editNote, deleteNote,
    moveToken, placeHereToken, createTracker, renameTracker, deleteTracker, addStroke, deleteStroke,
  } = useMapBoard(partyCode, currentUserId)
  const pz = useMapPanZoom({ x: 0, y: 0 })

  // "move" gates pin/tracker dragging behind a deliberate toggle — without
  // it, a stray drag while just trying to click one open was repositioning
  // it, which was annoying. The "here" token is unaffected: it's meant to be
  // freely draggable at all times. "paint" click-drags a freehand brush
  // stroke instead of panning. "track" click-places a new image tracker.
  const [mode, setMode] = useState<"idle" | "drop" | "move" | "paint" | "track">("idle")
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null)
  const [pinNameDraft, setPinNameDraft] = useState("")
  const [pinColorDraft, setPinColorDraft] = useState(DEFAULT_PIN_COLOR)
  const [pendingTracker, setPendingTracker] = useState<{ x: number; y: number } | null>(null)
  const [trackerNameDraft, setTrackerNameDraft] = useState("")
  const [trackerImageUrl, setTrackerImageUrl] = useState("")
  const [uploadingTrackerImage, setUploadingTrackerImage] = useState(false)
  const [showTrackerImagePicker, setShowTrackerImagePicker] = useState(false)
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([])
  const [galleryLoading, setGalleryLoading] = useState(false)
  const [openTrackerMenuId, setOpenTrackerMenuId] = useState<string | null>(null)
  const [trackerRenameDraft, setTrackerRenameDraft] = useState("")
  const [brushColor, setBrushColor] = useState(DEFAULT_PIN_COLOR)
  const [erasing, setErasing] = useState(false)
  const [brushSize, setBrushSize] = useState(() => {
    try { return Number(localStorage.getItem(BRUSH_SIZE_KEY)) || 14 } catch { return 14 }
  })
  const [openPinId, setOpenPinId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [labelSize, setLabelSize] = useState(() => {
    try { return Number(localStorage.getItem(LABEL_SIZE_KEY)) || 10 } catch { return 10 }
  })
  const dragStart = useRef<{ x: number; y: number } | null>(null)
  const paintCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const currentStroke = useRef<StrokePoint[] | null>(null)
  const trackerImageInputRef = useRef<HTMLInputElement | null>(null)

  const openPin = pins.find(p => p.id === openPinId) ?? null
  const myLastStroke = [...strokes].reverse().find(s => s.owner_id === currentUserId)
  const hereToken = tokens.find(t => t.kind === "here") ?? null
  const trackerTokens = tokens.filter(t => t.kind === "tracker")

  function resolveOwnerName(ownerId: string) {
    if (ownerId === currentUserId) return "You"
    if (ownerId === dmUserId) return "Dungeon Master"
    return members.find(m => m.userId === ownerId)?.name ?? "Party member"
  }

  function adjustLabelSize(delta: number) {
    setLabelSize(prev => {
      const next = Math.min(MAX_LABEL_SIZE, Math.max(MIN_LABEL_SIZE, prev + delta))
      try { localStorage.setItem(LABEL_SIZE_KEY, String(next)) } catch { /* ignore */ }
      return next
    })
  }

  function adjustBrushSize(delta: number) {
    setBrushSize(prev => {
      const next = Math.min(MAX_BRUSH_SIZE, Math.max(MIN_BRUSH_SIZE, prev + delta))
      try { localStorage.setItem(BRUSH_SIZE_KEY, String(next)) } catch { /* ignore */ }
      return next
    })
  }

  // Redraws the whole paint layer from the synced stroke list — runs on
  // initial load and whenever a stroke arrives (from us or, live, from
  // anyone else in the party). Cheap at the stroke counts a tabletop map
  // actually accumulates, so a full clear+redraw is simpler and more
  // obviously correct than patching in just the delta.
  useEffect(() => {
    const canvas = paintCanvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, MAP_W, MAP_H)
    for (const s of strokes) drawStroke(ctx, s.color, s.size, s.erase, s.points)
    ctx.globalCompositeOperation = "source-over"
  }, [strokes])

  // Live drawing during an active gesture writes straight to the canvas
  // (same "direct DOM write during a gesture" philosophy useMapPanZoom uses
  // for pan/drag) — only committed to Supabase, and to the `strokes` array
  // that drives the effect above, once the stroke is released.
  function beginStroke(worldX: number, worldY: number) {
    currentStroke.current = [{ x: worldX, y: worldY }]
    const ctx = paintCanvasRef.current?.getContext("2d")
    if (!ctx) return
    drawStroke(ctx, brushColor, brushSize, erasing, currentStroke.current)
  }
  function extendStroke(worldX: number, worldY: number) {
    const pts = currentStroke.current
    if (!pts) return
    const last = pts[pts.length - 1]
    pts.push({ x: worldX, y: worldY })
    const ctx = paintCanvasRef.current?.getContext("2d")
    if (!ctx) return
    ctx.globalCompositeOperation = erasing ? "destination-out" : "source-over"
    ctx.strokeStyle = brushColor
    ctx.lineWidth = brushSize
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.beginPath()
    ctx.moveTo(last.x, last.y)
    ctx.lineTo(worldX, worldY)
    ctx.stroke()
  }
  function endStroke() {
    const pts = currentStroke.current
    currentStroke.current = null
    if (pts && pts.length) addStroke(brushColor, brushSize, erasing, pts)
  }

  // Fit the map roughly into view the moment it opens instead of dropping
  // the player into a zoomed-to-1 corner of a 2400×1804 canvas.
  useLayoutEffect(() => {
    const rect = pz.surfaceRef.current?.getBoundingClientRect()
    if (!rect) return
    const fit = Math.min(rect.width / MAP_W, rect.height / MAP_H) * 0.92
    pz.setZoom(+fit.toFixed(2))
    pz.setPan({ x: (rect.width - MAP_W * fit) / 2, y: (rect.height - MAP_H * fit) / 2 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Escape closes whatever's topmost — the naming prompt, then an open pin,
  // then the whole map.
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key !== "Escape") return
      if (pendingPin) { setPendingPin(null); return }
      if (pendingTracker) { setPendingTracker(null); return }
      if (openTrackerMenuId) { setOpenTrackerMenuId(null); return }
      if (openPinId) { setOpenPinId(null); return }
      onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [pendingPin, pendingTracker, openTrackerMenuId, openPinId, onClose])

  // dragStart tracks the background mousedown/touchstart that a click needs
  // to trace back to before it's trusted as "drop a pin here" — pins/token
  // clear it in their own mousedown/touchstart (see below) since those stop
  // propagation before it would otherwise be set, so a drag-release that
  // happens to end up back over bare map never gets misread as a tap.
  function onSurfaceMouseDown(e: React.MouseEvent) {
    if (mode === "paint") {
      const { x, y } = pz.toWorld(e.clientX, e.clientY)
      beginStroke(x, y)
      return
    }
    dragStart.current = { x: e.clientX, y: e.clientY }
    pz.onSurfaceMouseDown(e)
  }
  function onSurfaceMouseMove(e: React.MouseEvent) {
    if (mode === "paint") {
      if (currentStroke.current) { const { x, y } = pz.toWorld(e.clientX, e.clientY); extendStroke(x, y) }
      return
    }
    pz.onSurfaceMouseMove(e)
  }
  function onSurfaceTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    if (mode === "paint") {
      if (t) { const { x, y } = pz.toWorld(t.clientX, t.clientY); beginStroke(x, y) }
      return
    }
    dragStart.current = t ? { x: t.clientX, y: t.clientY } : null
    pz.onSurfaceTouchStart(e)
  }
  function onSurfaceTouchMove(e: React.TouchEvent) {
    if (mode === "paint") {
      const t = e.touches[0]
      if (currentStroke.current && t) { const { x, y } = pz.toWorld(t.clientX, t.clientY); extendStroke(x, y) }
      return
    }
    pz.onSurfaceTouchMove(e)
  }
  function onSurfaceClick(e: React.MouseEvent) {
    if (mode !== "drop" && mode !== "track") return
    const start = dragStart.current
    dragStart.current = null
    if (!start || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 4) return
    const { x, y } = pz.toWorld(e.clientX, e.clientY)
    if (mode === "drop") {
      setPendingPin({ x: x - PIN_SIZE / 2, y: y - PIN_SIZE / 2 })
      setPinNameDraft("")
      setPinColorDraft(DEFAULT_PIN_COLOR)
    } else {
      setPendingTracker({ x: x - TOKEN_SIZE / 2, y: y - TOKEN_SIZE / 2 })
      setTrackerNameDraft("")
      setTrackerImageUrl("")
    }
  }
  async function confirmPendingPin() {
    const name = pinNameDraft.trim()
    if (!name || !pendingPin) return
    await createPin(name, pendingPin.x, pendingPin.y, pinColorDraft)
    setPendingPin(null)
    setPinNameDraft("")
    setMode("idle")
  }
  async function confirmPendingTracker() {
    const name = trackerNameDraft.trim()
    if (!name || !trackerImageUrl || !pendingTracker) return
    await createTracker(name, trackerImageUrl, pendingTracker.x, pendingTracker.y)
    setPendingTracker(null)
    setTrackerNameDraft("")
    setTrackerImageUrl("")
    setMode("idle")
  }
  // "Upload new" inside the gallery picker below — still goes through the
  // account's shared image storage (see imageGallery.ts), just reached via
  // the same gallery-picker UX every other picture picker in the app uses
  // (PortraitModal) rather than a bare file input.
  async function openTrackerImagePicker() {
    setShowTrackerImagePicker(true)
    setGalleryLoading(true)
    setGalleryImages(await loadUserImages(currentUserId))
    setGalleryLoading(false)
  }
  async function uploadTrackerImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingTrackerImage(true)
    const url = await uploadUserImage(currentUserId, file)
    if (url) setTrackerImageUrl(url)
    setUploadingTrackerImage(false)
    setShowTrackerImagePicker(false)
    e.target.value = ""
  }
  function onTrackerClick(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (pz.shouldSuppressClick(id)) return
    const t = trackerTokens.find(tt => tt.id === id)
    if (!t || (t.owner_id !== currentUserId && !isDM)) return
    setOpenTrackerMenuId(prev => prev === id ? null : id)
    setTrackerRenameDraft(t.name ?? "")
  }

  function onSurfaceUp() {
    if (currentStroke.current) { endStroke(); return }
    const moved = pz.onSurfaceMouseUp()
    setDraggingId(null)
    if (!moved) return
    if (tokens.some(t => t.id === moved.id)) moveToken(moved.id, moved.x, moved.y)
    else movePin(moved.id, moved.x, moved.y)
  }
  function onSurfaceTouchEnd() {
    if (currentStroke.current) { endStroke(); return }
    const moved = pz.onSurfaceTouchEnd()
    setDraggingId(null)
    if (!moved) return
    if (tokens.some(t => t.id === moved.id)) moveToken(moved.id, moved.x, moved.y)
    else movePin(moved.id, moved.x, moved.y)
  }

  function onPinClick(e: React.MouseEvent, pinId: string) {
    e.stopPropagation()
    if (pz.shouldSuppressClick(pinId)) return
    setOpenPinId(pinId)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Toolbar */}
      <div className="px-3.5 py-2 border-b border-border shrink-0 flex items-center gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden">
        <span className="text-sm font-bold text-foreground mr-1 shrink-0">Mountain Range Map</span>
        <button type="button" onClick={() => setMode(m => m === "drop" ? "idle" : "drop")}
          className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg transition-colors shrink-0 ${mode === "drop" ? "bg-violet-500/25 text-violet-200" : "bg-foreground/8 hover:bg-foreground/15 text-foreground/80"}`}>
          <MapPinIcon className="size-3.5" /> {mode === "drop" ? "Click the map to name a pin…" : "Drop Pin"}
        </button>
        <button type="button" onClick={() => setMode(m => m === "move" ? "idle" : "move")}
          title="Toggle whether pins can be dragged"
          className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg transition-colors shrink-0 ${mode === "move" ? "bg-violet-500/25 text-violet-200" : "bg-foreground/8 hover:bg-foreground/15 text-foreground/80"}`}>
          <Move className="size-3.5" /> {mode === "move" ? "Drag pins to reposition…" : "Move Pins"}
        </button>
        <button type="button" onClick={() => setMode(m => m === "track" ? "idle" : "track")}
          title="Drop a named, picture-backed marker — for tracking people, monsters, whatever needs tracking"
          className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg transition-colors shrink-0 ${mode === "track" ? "bg-violet-500/25 text-violet-200" : "bg-foreground/8 hover:bg-foreground/15 text-foreground/80"}`}>
          <ImagePlus className="size-3.5" /> {mode === "track" ? "Click the map to place a tracker…" : "Add Tracker"}
        </button>
        <button type="button" onClick={() => setMode(m => m === "paint" ? "idle" : "paint")}
          title="Freehand color-code regions of the map"
          className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg transition-colors shrink-0 ${mode === "paint" ? "bg-violet-500/25 text-violet-200" : "bg-foreground/8 hover:bg-foreground/15 text-foreground/80"}`}>
          <Paintbrush className="size-3.5" /> Paint
        </button>
        {mode === "paint" && (
          <div className="flex items-center gap-1.5 shrink-0">
            {PIN_COLORS.map(color => (
              <button key={color} type="button" onClick={() => { setBrushColor(color); setErasing(false) }} title={color}
                style={{ backgroundColor: color }}
                className={`size-5 rounded-full transition-transform ${!erasing && brushColor === color ? "ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110" : "hover:scale-110"}`} />
            ))}
            <input type="color" value={brushColor} title="Custom color"
              onChange={e => { setBrushColor(e.target.value); setErasing(false) }}
              className="size-6 rounded-md border border-border bg-transparent cursor-pointer p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-none" />
            <button type="button" onClick={() => setErasing(v => !v)} title="Eraser"
              className={`size-6 flex items-center justify-center rounded-lg transition-colors ${erasing ? "bg-violet-500/25 text-violet-200" : "bg-foreground/8 hover:bg-foreground/15 text-foreground/70"}`}>
              <Eraser className="size-3.5" />
            </button>
            <button type="button" onClick={() => adjustBrushSize(-2)} title="Smaller brush" disabled={brushSize <= MIN_BRUSH_SIZE}
              className="size-6 flex items-center justify-center rounded-lg bg-foreground/8 hover:bg-foreground/15 text-foreground/70 transition-colors disabled:opacity-30">
              <Minus className="size-3" />
            </button>
            <span className="text-[10px] text-muted-foreground/50 w-6 text-center tabular-nums" title="Brush size">{brushSize}</span>
            <button type="button" onClick={() => adjustBrushSize(2)} title="Larger brush" disabled={brushSize >= MAX_BRUSH_SIZE}
              className="size-6 flex items-center justify-center rounded-lg bg-foreground/8 hover:bg-foreground/15 text-foreground/70 transition-colors disabled:opacity-30">
              <Plus className="size-3" />
            </button>
            <button type="button" onClick={() => myLastStroke && deleteStroke(myLastStroke.id)} title="Undo your last stroke" disabled={!myLastStroke}
              className="size-6 flex items-center justify-center rounded-lg bg-foreground/8 hover:bg-foreground/15 text-foreground/70 transition-colors disabled:opacity-30">
              <Undo2 className="size-3.5" />
            </button>
          </div>
        )}
        <div className="flex-1" />
        <button type="button" onClick={() => adjustLabelSize(-1)} title="Smaller pin labels" disabled={labelSize <= MIN_LABEL_SIZE}
          className="size-7 flex items-center justify-center rounded-lg bg-foreground/8 hover:bg-foreground/15 text-foreground/70 transition-colors shrink-0 disabled:opacity-30">
          <Minus className="size-3.5" />
        </button>
        <span className="text-[10px] text-muted-foreground/50 shrink-0" title="Pin label text size">Aa</span>
        <button type="button" onClick={() => adjustLabelSize(1)} title="Larger pin labels" disabled={labelSize >= MAX_LABEL_SIZE}
          className="size-7 flex items-center justify-center rounded-lg bg-foreground/8 hover:bg-foreground/15 text-foreground/70 transition-colors shrink-0 disabled:opacity-30 mr-1">
          <Plus className="size-3.5" />
        </button>
        <button type="button" onClick={() => pz.zoomBy(-0.1)} className="size-7 flex items-center justify-center rounded-lg bg-foreground/8 hover:bg-foreground/15 text-foreground/70 transition-colors shrink-0">
          <ZoomOut className="size-3.5" />
        </button>
        <span className="text-[10px] text-muted-foreground/50 w-9 text-center tabular-nums shrink-0">{Math.round(pz.zoom * 100)}%</span>
        <button type="button" onClick={() => pz.zoomBy(0.1)} className="size-7 flex items-center justify-center rounded-lg bg-foreground/8 hover:bg-foreground/15 text-foreground/70 transition-colors shrink-0">
          <ZoomIn className="size-3.5" />
        </button>
        <button type="button" onClick={onClose} title="Close (Esc)"
          className="size-7 flex items-center justify-center rounded-lg bg-foreground/8 hover:bg-foreground/15 text-foreground/70 transition-colors shrink-0 ml-1">
          <X className="size-4" />
        </button>
      </div>

      {/* Canvas surface */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <div
          ref={pz.surfaceRef}
          className={`absolute inset-0 touch-none ${mode === "drop" || mode === "track" ? "cursor-crosshair" : mode === "paint" ? "cursor-cell" : "cursor-grab active:cursor-grabbing"}`}
          onMouseDown={onSurfaceMouseDown}
          onMouseMove={onSurfaceMouseMove}
          onMouseUp={onSurfaceUp}
          onMouseLeave={onSurfaceUp}
          onTouchStart={onSurfaceTouchStart}
          onTouchMove={onSurfaceTouchMove}
          onTouchEnd={onSurfaceTouchEnd}
          onWheel={pz.onWheel}
          onClick={onSurfaceClick}
        >
          <div
            ref={pz.contentRef}
            style={{ left: 0, top: 0, width: MAP_W, height: MAP_H, transformOrigin: "0 0", backgroundColor: "#030303" }}
            className="absolute shadow-4xl"
          >
            {/* Paint layer — sits under the linework so brush strokes show
                through the SVG's transparent gaps while the white art stays
                on top. One canvas, redrawn from the synced stroke list. */}
            <canvas ref={paintCanvasRef} width={MAP_W} height={MAP_H}
              style={{ position: "absolute", left: 0, top: 0, width: MAP_W, height: MAP_H, pointerEvents: "none" }} />

            <img src={hjollandUrl} alt="Hjolland" draggable={false}
              style={{ width: MAP_W, height: MAP_H, position: "absolute", left: 0, top: 0, userSelect: "none", pointerEvents: "none" }} />

            {/* Pins */}
            {pins.map(pin => {
              const dragging = draggingId === pin.id
              return (
                <div
                  key={pin.id}
                  ref={el => pz.setNodeEl(pin.id, el)}
                  onMouseDown={e => { if (mode !== "move") return; dragStart.current = null; setDraggingId(pin.id); pz.startNodeDrag(e, pin) }}
                  onTouchStart={e => { if (mode !== "move") return; dragStart.current = null; setDraggingId(pin.id); pz.startNodeDragTouch(e, pin) }}
                  onClick={e => onPinClick(e, pin.id)}
                  style={{
                    left: 0, top: 0, width: PIN_SIZE, height: PIN_SIZE,
                    transform: `translate3d(${pin.x}px, ${pin.y}px, 0)`,
                    willChange: dragging ? "transform" : undefined,
                    zIndex: dragging ? 10 : undefined,
                  }}
                  className={`group absolute select-none flex items-center justify-center ${mode === "move" ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
                  title={pin.name}
                >
                  <MapPinIcon size={PIN_ICON_SIZE} strokeWidth={2} color={pin.color} fill={pin.color} fillOpacity={0.6} className="drop-shadow-md" />
                  <span style={{ fontSize: labelSize }} className="absolute top-full mt-0.5 px-1.5 py-0.5 rounded-full bg-black/75 text-white font-semibold whitespace-nowrap pointer-events-none">
                    {pin.name}
                  </span>
                </div>
              )
            })}

            {/* "Currently here" token */}
            {hereToken && (
              <div
                ref={el => pz.setNodeEl(hereToken.id, el)}
                onMouseDown={e => { dragStart.current = null; setDraggingId(hereToken.id); pz.startNodeDrag(e, { id: hereToken.id, x: hereToken.x, y: hereToken.y }) }}
                onTouchStart={e => { dragStart.current = null; setDraggingId(hereToken.id); pz.startNodeDragTouch(e, { id: hereToken.id, x: hereToken.x, y: hereToken.y }) }}
                onClick={e => e.stopPropagation()}
                style={{
                  left: 0, top: 0, width: TOKEN_SIZE, height: TOKEN_SIZE,
                  transform: `translate3d(${hereToken.x}px, ${hereToken.y}px, 0)`,
                  willChange: draggingId === hereToken.id ? "transform" : undefined,
                  zIndex: draggingId === hereToken.id ? 11 : 9,
                }}
                className="group absolute cursor-grab active:cursor-grabbing select-none flex items-center justify-center rounded-full bg-sky-500 border-2 border-white shadow-lg"
                title={`Currently here${hereToken.updated_by ? ` — moved by ${resolveOwnerName(hereToken.updated_by)}` : ""}`}
              >
                <LocateFixed className="size-5 text-white" />
                <span className="absolute top-full mt-0.5 px-1.5 py-0.5 rounded-full bg-black/75 text-white text-[10px] font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  Currently here
                </span>
              </div>
            )}

            {!hereToken && (
              <button type="button"
                onClick={e => { e.stopPropagation(); placeHereToken(MAP_W / 2 - TOKEN_SIZE / 2, MAP_H / 2 - TOKEN_SIZE / 2) }}
                style={{ left: MAP_W / 2 - 60, top: MAP_H / 2 - 14 }}
                className="absolute px-2.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-[11px] font-semibold shadow-lg transition-colors">
                Place "currently here"
              </button>
            )}

            {/* Trackers — named, picture-backed markers for anyone/anything
                the party wants to keep tabs on. Draggable under the same
                "Move Pins" toggle as city pins; rename/delete popover is
                gated to the tracker's creator or the DM. */}
            {trackerTokens.map(t => {
              const dragging = draggingId === t.id
              const canManage = t.owner_id === currentUserId || isDM
              return (
                <div
                  key={t.id}
                  ref={el => pz.setNodeEl(t.id, el)}
                  onMouseDown={e => { if (mode !== "move") return; dragStart.current = null; setDraggingId(t.id); pz.startNodeDrag(e, t) }}
                  onTouchStart={e => { if (mode !== "move") return; dragStart.current = null; setDraggingId(t.id); pz.startNodeDragTouch(e, t) }}
                  onClick={e => onTrackerClick(e, t.id)}
                  style={{
                    left: 0, top: 0, width: TOKEN_SIZE, height: TOKEN_SIZE,
                    transform: `translate3d(${t.x}px, ${t.y}px, 0)`,
                    willChange: dragging ? "transform" : undefined,
                    zIndex: dragging ? 12 : 8,
                  }}
                  className={`group absolute select-none flex items-center justify-center ${mode === "move" ? "cursor-grab active:cursor-grabbing" : canManage ? "cursor-pointer" : "cursor-default"}`}
                  title={t.name ?? "Tracker"}
                >
                  <div className="size-full rounded-full border-2 border-white shadow-lg overflow-hidden bg-black/40">
                    <img src={t.image_url ?? ""} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                  <span className="absolute top-full mt-0.5 px-1.5 py-0.5 rounded-full bg-black/75 text-white text-[10px] font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    {t.name}
                  </span>
                  {openTrackerMenuId === t.id && (
                    <div style={{ left: "100%", top: 0 }} className="absolute z-20 ml-1.5 flex items-center gap-1.5 p-1.5 rounded-lg bg-popover text-popover-foreground border border-border shadow-xl" onClick={e => e.stopPropagation()}>
                      <input
                        autoFocus value={trackerRenameDraft} onChange={e => setTrackerRenameDraft(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") { renameTracker(t.id, trackerRenameDraft.trim() || t.name || ""); setOpenTrackerMenuId(null) }
                          if (e.key === "Escape") setOpenTrackerMenuId(null)
                        }}
                        className="text-xs bg-foreground/8 rounded-md px-2 py-1 outline-none w-28"
                      />
                      <button type="button" onClick={() => { renameTracker(t.id, trackerRenameDraft.trim() || t.name || ""); setOpenTrackerMenuId(null) }}
                        title="Save name" className="size-6 flex items-center justify-center rounded-md hover:bg-foreground/10 text-foreground/70">
                        <Check className="size-3.5" />
                      </button>
                      <button type="button" onClick={() => { deleteTracker(t.id); setOpenTrackerMenuId(null) }}
                        title="Remove tracker" className="size-6 flex items-center justify-center rounded-md hover:bg-red-500/20 text-foreground/70 hover:text-red-300">
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Name-this-pin prompt */}
        {pendingPin && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40" onClick={() => setPendingPin(null)}>
            <div className="bg-card border border-border rounded-xl p-4 w-72 shadow-xl" onClick={e => e.stopPropagation()}>
              <p className="text-xs font-semibold text-foreground mb-2">Name this location</p>
              <input
                autoFocus value={pinNameDraft} onChange={e => setPinNameDraft(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") confirmPendingPin(); if (e.key === "Escape") setPendingPin(null) }}
                placeholder="City name…"
                className="w-full text-sm bg-foreground/8 rounded-lg px-2.5 py-1.5 outline-none placeholder:text-muted-foreground/40 mb-3"
              />
              <div className="flex items-center gap-1.5 mb-3">
                {PIN_COLORS.map(color => (
                  <button key={color} type="button" onClick={() => setPinColorDraft(color)} title={color}
                    style={{ backgroundColor: color }}
                    className={`size-5 rounded-full transition-transform ${pinColorDraft === color ? "ring-2 ring-offset-2 ring-offset-card ring-foreground scale-110" : "hover:scale-110"}`} />
                ))}
                <input type="color" value={pinColorDraft} title="Custom color"
                  onChange={e => setPinColorDraft(e.target.value)}
                  className="size-6 rounded-md border border-border bg-transparent cursor-pointer p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-none" />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPendingPin(null)}
                  className="text-xs px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                <button type="button" onClick={confirmPendingPin} disabled={!pinNameDraft.trim()}
                  className="text-xs px-3 py-1.5 rounded-lg bg-foreground/15 hover:bg-foreground/25 text-foreground font-semibold disabled:opacity-30 transition-colors">Drop pin</button>
              </div>
            </div>
          </div>
        )}

        {/* New-tracker prompt */}
        {pendingTracker && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40" onClick={() => setPendingTracker(null)}>
            <div className="bg-card border border-border rounded-xl p-4 w-72 shadow-xl" onClick={e => e.stopPropagation()}>
              <p className="text-xs font-semibold text-foreground mb-2">New tracker</p>
              <input
                autoFocus value={trackerNameDraft} onChange={e => setTrackerNameDraft(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") confirmPendingTracker(); if (e.key === "Escape") setPendingTracker(null) }}
                placeholder="Who or what is this?"
                className="w-full text-sm bg-foreground/8 rounded-lg px-2.5 py-1.5 outline-none placeholder:text-muted-foreground/40 mb-3"
              />
              <button type="button" onClick={openTrackerImagePicker} disabled={uploadingTrackerImage}
                className="w-full flex items-center justify-center gap-2 text-xs px-2.5 py-2 rounded-lg bg-foreground/8 hover:bg-foreground/15 text-foreground/80 transition-colors mb-3 disabled:opacity-50">
                {trackerImageUrl ? (
                  <img src={trackerImageUrl} alt="" className="size-6 rounded-full object-cover" />
                ) : (
                  <ImagePlus className="size-3.5" />
                )}
                {uploadingTrackerImage ? "Uploading…" : trackerImageUrl ? "Change picture" : "Choose picture"}
              </button>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPendingTracker(null)}
                  className="text-xs px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                <button type="button" onClick={confirmPendingTracker} disabled={!trackerNameDraft.trim() || !trackerImageUrl}
                  className="text-xs px-3 py-1.5 rounded-lg bg-foreground/15 hover:bg-foreground/25 text-foreground font-semibold disabled:opacity-30 transition-colors">Add tracker</button>
              </div>
            </div>
          </div>
        )}

        {showTrackerImagePicker && (
          <PortraitModal
            title="Choose Tracker Image"
            currentPortrait={trackerImageUrl}
            galleryImages={galleryImages}
            galleryLoading={galleryLoading}
            onChoose={url => { setTrackerImageUrl(url); setShowTrackerImagePicker(false) }}
            onUploadClick={() => trackerImageInputRef.current?.click()}
            onClose={() => setShowTrackerImagePicker(false)}
          />
        )}
        <input ref={trackerImageInputRef} type="file" accept="image/*" className="hidden" onChange={uploadTrackerImage} />
      </div>

      {openPin && (
        <MapPinViewer
          pin={openPin}
          notes={notes.filter(n => n.pin_id === openPin.id)}
          currentUserId={currentUserId}
          isDM={isDM}
          onClose={() => setOpenPinId(null)}
          onRename={name => renamePin(openPin.id, name)}
          onChangeColor={color => recolorPin(openPin.id, color)}
          onDeletePin={() => { deletePin(openPin.id); setOpenPinId(null) }}
          onAddNote={content => addNote(openPin.id, currentUserName, content)}
          onEditNote={editNote}
          onDeleteNote={deleteNote}
        />
      )}
    </div>
  )
}
