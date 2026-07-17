// ----- Imports -----
import * as React from "react"
import { GripVertical, ImageIcon, Pin, XIcon, ChevronRight, Search, PanelRight, CalendarClock, Info } from "lucide-react"

// ----- UI & Helper Imports -----
import { SearchForm } from "@/components/search-form"
import { VersionSwitcher } from "@/components/version-switcher"
import { Sidebar, SidebarContent, SidebarHeader, SidebarRail } from "@/components/ui/sidebar"
import { useUserContext } from "../../src/contexts/UserContext"
import type { userInfo } from "../types/userInfo"
import { buildObjectTree, applyDrop, moveToRoot, isNoNesting, isPinned, getItemData, getCreatedDate } from "@/components/sidebar-utils"
import type { SidebarObject, DropTarget, DropPosition } from "@/components/sidebar-utils"
import { supabase } from "../../src/supabase"
import { NOTE_DRAG_TYPE } from "@/components/party/partyTypes"

const BUCKET = "fableimages"

// ----- Types & Metadata -----
type ObjectType = "folder" | "note" | "character" | "monster" | "campaign"

const typeMeta: Record<ObjectType, { label: string }> = {
  folder: { label: "Folder" },
  note: { label: "Note" },
  character: { label: "Character" },
  monster: { label: "Monster" },
  campaign: { label: "Campaign" },
}

// Tag-style color per object type — shown as a small colored pill next to
// every sidebar item instead of plain uppercase text.
const typeColors: Record<ObjectType, string> = {
  folder: "bg-amber-500/15 text-amber-400",
  note: "bg-emerald-500/15 text-emerald-400",
  character: "bg-violet-500/15 text-violet-400",
  monster: "bg-red-500/15 text-red-400",
  campaign: "bg-sky-500/15 text-sky-400",
}

const LONG_PRESS_MS = 500

// Formats a YYYY-MM-DD (or ISO timestamp — the first 10 characters are the
// same shape) as a calendar date without reinterpreting it through UTC.
// `new Date("2024-06-01")` parses as UTC midnight, which `toLocaleDateString`
// then renders a day early in timezones behind UTC — reading the Y/M/D
// digits directly and building a local Date avoids that round-trip.
function formatDateOnly(dateStr: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr)
  if (!m) return dateStr
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
}

// ----- Component -----
interface BgImage {
  name: string
  publicUrl: string
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  onSelectObject?: (obj: SidebarObject | null) => void
  onShowRosterSidebar?: (obj: SidebarObject) => void
}

export function AppSidebar({ onSelectObject, onShowRosterSidebar, ...props }: AppSidebarProps) {
  const { user, objects, loading, updateObject, deleteObject, batchUpdateObjects } = useUserContext()
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({})
  const [searchQuery, setSearchQuery] = React.useState("")

  // Background image picker state
  const [bgPickerItem, setBgPickerItem] = React.useState<SidebarObject | null>(null)
  const [bgImages, setBgImages] = React.useState<BgImage[]>([])

  // View Details panel state
  const [detailsItem, setDetailsItem] = React.useState<SidebarObject | null>(null)

  // Creation-date editor modal state
  const [dateEditItem, setDateEditItem] = React.useState<SidebarObject | null>(null)
  const [dateEditValue, setDateEditValue] = React.useState("")

  // Desktop drag state
  const [draggedId, setDraggedId] = React.useState<string | null>(null)
  const [dropTarget, setDropTarget] = React.useState<DropTarget | null>(null)
  const [isOverRoot, setIsOverRoot] = React.useState(false)

  // Touch drag state — use refs for perf-critical values updated on every move
  const touchDragIdRef = React.useRef<string | null>(null)
  const touchDropTargetRef = React.useRef<DropTarget | null>(null)
  const touchOverRootRef = React.useRef(false)
  const [touchDragId, setTouchDragId] = React.useState<string | null>(null) // only for re-render triggers
  const [touchDropTarget, setTouchDropTarget] = React.useState<DropTarget | null>(null)
  const [touchOverRoot, setTouchOverRoot] = React.useState(false)
  const [touchGhost, setTouchGhost] = React.useState<{ x: number; y: number; label: string } | null>(null)

  const [items, setItems] = React.useState<userInfo.Objects[]>([])
  const [contextMenu, setContextMenu] = React.useState<{ x: number; y: number; item: SidebarObject } | null>(null)

  // Refs
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const gripDragTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDraggable = React.useRef(false)
  const [draggableId, setDraggableId] = React.useState<string | null>(null)
  const longPressFired = React.useRef(false) // track if long press already triggered
  const itemRefs = React.useRef<Map<string, HTMLDivElement>>(new Map())
  const rootZoneRef = React.useRef<HTMLDivElement | null>(null)
  const ghostRef = React.useRef<{ x: number; y: number; label: string } | null>(null)

  React.useEffect(() => { setItems(objects) }, [objects])

  React.useEffect(() => {
    if (!contextMenu) return
    const handler = () => setContextMenu(null)
    window.addEventListener("click", handler)
    return () => window.removeEventListener("click", handler)
  }, [contextMenu])

  const tree = React.useMemo(
    () => buildObjectTree(items.filter(o => !o.type?.startsWith("doc_"))),
    [items]
  )
  const toggleGroup = (id: string) => setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }))

  // Search filters the flat list by name, then keeps every ancestor folder of
  // a match too — so a hit three folders deep is still reachable — and the
  // matched folders are force-expanded below instead of needing a manual click.
  const searchActive = searchQuery.trim().length > 0
  const visibleTree = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return tree
    const idMap = new Map(items.map(o => [o.id, o]))
    const keep = new Set<string>()
    items.filter(o => o.name.toLowerCase().includes(q)).forEach(match => {
      let cur: userInfo.Objects | undefined = match
      // A corrupted/circular parent_id chain (A's parent is B, B's parent is
      // A) would otherwise spin this loop forever and hang the tab — bail
      // out the moment we revisit an id we've already walked through.
      while (cur && !keep.has(cur.id)) {
        keep.add(cur.id)
        cur = cur.parent_id ? idMap.get(cur.parent_id) : undefined
      }
    })
    return buildObjectTree(items.filter(o => keep.has(o.id) && !o.type?.startsWith("doc_")))
  }, [items, searchQuery, tree])

  // ── Background image helpers ──────────────────────────────────────────────

  async function loadBgImages() {
    if (!user?.id) return
    const { data } = await supabase.storage
      .from(BUCKET)
      .list(`${user.id}`, { limit: 100 })
    if (!data) return
    const loaded = data
      .filter((f) => f.name !== ".emptyFolderPlaceholder")
      .map((f) => ({
        name: f.name,
        publicUrl: supabase.storage
          .from(BUCKET)
          .getPublicUrl(`${user.id}/${f.name}`).data.publicUrl,
      }))
    setBgImages(loaded)
  }

  function openBgPicker(item: SidebarObject) {
    setContextMenu(null)
    setBgPickerItem(item)
    loadBgImages()
  }

  async function applyBgImage(item: SidebarObject, url: string) {
    const currentData: any = typeof item.data === "string" ? JSON.parse(item.data ?? "{}") : (item.data ?? {})
    const newData = { ...currentData, backgroundImage: url }
    setBgPickerItem(null)
    await updateObject(item.id, { data: newData })
  }

  async function removeBgImage(item: SidebarObject) {
    const currentData: any = typeof item.data === "string" ? JSON.parse(item.data ?? "{}") : (item.data ?? {})
    const { backgroundImage: _removed, ...rest } = currentData
    setContextMenu(null)
    await updateObject(item.id, { data: rest })
  }

  // ── Shared: commit a drop ─────────────────────────────────────────────────

  const commitDrop = async (activeId: string, target: DropTarget | null, toRoot: boolean) => {
    if (toRoot) {
      const newItems = moveToRoot(items, activeId)
      if (newItems !== items) await persistChanges(newItems)
      return
    }
    if (!target) return
    const newItems = applyDrop(items, activeId, target)
    if (newItems !== items) await persistChanges(newItems)
  }

  // A reorder reindexes every sibling at that level.
  const persistChanges = async (newItems: userInfo.Objects[]) => {
    const previousItems = items
    setItems(newItems)
    const changed = newItems
      .filter((item) => {
        const original = previousItems.find((o) => o.id === item.id)
        return original && (original.parent_id !== item.parent_id || original.position !== item.position)
      })
      .map((item) => ({ id: item.id, parent_id: item.parent_id ?? null, position: item.position ?? 0 }))
    if (changed.length === 0) return
    try {
      await batchUpdateObjects(changed)
    } catch (error) {
      console.error("Error saving reorder:", error)
      setItems(previousItems)
    }
  }

  // ── Desktop drag ──────────────────────────────────────────────────────────

  const getDropPosition = (event: React.DragEvent<HTMLDivElement>, isFolder: boolean): DropPosition => {
    const rect = event.currentTarget.getBoundingClientRect()
    const pct = (event.clientY - rect.top) / rect.height
    if (isFolder) { if (pct < 0.25) return "before"; if (pct > 0.75) return "after"; return "inside" }
    return pct < 0.5 ? "before" : "after"
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, node: SidebarObject) => {
    e.preventDefault(); e.stopPropagation()
    if (!draggedId || draggedId === node.id) return
    setDropTarget({ id: node.id, position: getDropPosition(e, node.type === "folder") })
    setIsOverRoot(false)
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.stopPropagation()
    const activeId = draggedId; const target = dropTarget
    setDraggedId(null); setDropTarget(null)
    if (!activeId) return
    await commitDrop(activeId, target, false)
  }

  const handleDropToRoot = async () => {
    setIsOverRoot(false)
    const activeId = draggedId
    setDraggedId(null); setDropTarget(null)
    if (!activeId) return
    await commitDrop(activeId, null, true)
  }

  // ── Touch: long-press on text area → context menu ─────────────────────────

  const handleTextTouchStart = (e: React.TouchEvent<HTMLDivElement>, node: SidebarObject) => {
    // Don't start long press if a grip drag is already in progress
    if (touchDragIdRef.current) return
    longPressFired.current = false
    const touch = e.touches[0]
    const startX = touch.clientX
    const startY = touch.clientY

    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true
      setContextMenu({ x: startX, y: startY, item: node })
    }, LONG_PRESS_MS)
  }

  const handleTextTouchMove = () => {
    // Cancel long press if finger moves more than 8px
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const handleTextTouchEnd = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
  }

  // ── Touch: grip → drag ────────────────────────────────────────────────────

  const getDropPositionFromY = (rect: DOMRect, clientY: number, isFolder: boolean): DropPosition => {
    const pct = (clientY - rect.top) / rect.height
    if (isFolder) { if (pct < 0.25) return "before"; if (pct > 0.75) return "after"; return "inside" }
    return pct < 0.5 ? "before" : "after"
  }

  const resolveDropTargetFromPoint = (clientX: number, clientY: number): { target: DropTarget | null; overRoot: boolean } => {
    if (rootZoneRef.current) {
      const r = rootZoneRef.current.getBoundingClientRect()
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom)
        return { target: null, overRoot: true }
    }
    for (const [id, el] of itemRefs.current.entries()) {
      if (id === touchDragIdRef.current) continue
      const r = el.getBoundingClientRect()
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
        const node = items.find((i) => i.id === id)
        return { target: { id, position: getDropPositionFromY(r, clientY, node?.type === "folder") }, overRoot: false }
      }
    }
    return { target: null, overRoot: false }
  }

  const handleGripTouchStart = (e: React.TouchEvent<HTMLDivElement>, node: SidebarObject) => {
    e.stopPropagation() // prevent row long-press from firing
    // Also cancel any row long-press that may have started
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }

    const touch = e.touches[0]
    gripDragTimer.current = setTimeout(() => {
      touchDragIdRef.current = node.id
      ghostRef.current = { x: touch.clientX, y: touch.clientY, label: node.name }
      setTouchDragId(node.id)
      setTouchGhost({ x: touch.clientX, y: touch.clientY, label: node.name })
    }, LONG_PRESS_MS)
  }

  const handleGripTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    // If drag hasn't started yet, any movement cancels the timer
    if (!touchDragIdRef.current) {
      if (gripDragTimer.current) { clearTimeout(gripDragTimer.current); gripDragTimer.current = null }
      return
    }

    e.preventDefault() // block scroll only while actually dragging
    const touch = e.touches[0]

    // Update ghost position via ref + batched state (avoids excessive renders)
    ghostRef.current = { x: touch.clientX, y: touch.clientY, label: ghostRef.current?.label ?? "" }
    setTouchGhost({ ...ghostRef.current })

    const { target, overRoot } = resolveDropTargetFromPoint(touch.clientX, touch.clientY)
    touchDropTargetRef.current = target
    touchOverRootRef.current = overRoot
    setTouchDropTarget(target)
    setTouchOverRoot(overRoot)
  }

  const handleGripTouchEnd = async () => {
    if (gripDragTimer.current) { clearTimeout(gripDragTimer.current); gripDragTimer.current = null }

    const activeId = touchDragIdRef.current
    const target = touchDropTargetRef.current
    const toRoot = touchOverRootRef.current

    // Clear all touch state synchronously before async work
    touchDragIdRef.current = null
    touchDropTargetRef.current = null
    touchOverRootRef.current = false
    ghostRef.current = null
    setTouchDragId(null)
    setTouchGhost(null)
    setTouchDropTarget(null)
    setTouchOverRoot(false)

    if (!activeId) return
    await commitDrop(activeId, target, toRoot)
  }

  // ── Context Menu actions ──────────────────────────────────────────────────

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>, item: SidebarObject) => {
    e.preventDefault(); e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, item })
  }

  const handleRename = async (item: SidebarObject) => {
    setContextMenu(null)
    const nextName = window.prompt("Rename item", item.name)?.trim()
    if (!nextName || nextName === item.name) return
    const previousItems = items
    setItems((prev) => prev.map((entry) => entry.id === item.id ? { ...entry, name: nextName } : entry))
    try { await updateObject(item.id, { name: nextName }) } catch { setItems(previousItems) }
  }

  const handleDelete = async (item: SidebarObject) => {
    setContextMenu(null)
    const confirmation = window.prompt(`Type DELETE to confirm deleting "${item.name}"`, "")
    if (confirmation !== "DELETE") return
    const previousItems = items
    setItems((prev) => prev.filter((entry) => entry.id !== item.id))
    try { await deleteObject(item.id) } catch { setItems(previousItems) }
  }

  const handleSetRootFolder = async (item: SidebarObject) => {
    const currentData: any = typeof item.data === "string" ? JSON.parse(item.data ?? "{}") : (item.data ?? {})
    const isCurrentlyNoNesting = currentData?.noNesting === true
    const newData = { ...currentData, noNesting: !isCurrentlyNoNesting }
    const newItems = !isCurrentlyNoNesting ? moveToRoot(items, item.id) : items
    const previousItems = items
    setItems(newItems.map((i) => i.id === item.id ? { ...i, data: newData } : i))
    try {
      await updateObject(item.id, {
        data: newData,
        ...(!isCurrentlyNoNesting && newItems !== items ? {
          parent_id: null,
          position: newItems.find((i) => i.id === item.id)?.position ?? 0,
        } : {}),
      })
    } catch { setItems(previousItems) }
  }

  const handlePin = async (item: SidebarObject) => {
    setContextMenu(null)
    const currentData: any = typeof item.data === "string" ? JSON.parse(item.data ?? "{}") : (item.data ?? {})
    const newData = { ...currentData, pinned: !currentData?.pinned }
    const previousItems = items
    setItems((prev) => prev.map((entry) => entry.id === item.id ? { ...entry, data: newData } : entry))
    try { await updateObject(item.id, { data: newData }) } catch { setItems(previousItems) }
  }

  // A custom, user-editable creation date — distinct from the real (immutable,
  // DB-assigned) created_at — e.g. to date an in-fiction document. Stored in
  // `data` like pinned/backgroundImage/noNesting rather than as its own column.
  const openDateEditor = (item: SidebarObject) => {
    const currentData = getItemData(item)
    const existing: string = currentData?.customCreatedAt ?? getCreatedDate(item)?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)
    setDateEditValue(existing)
    setDateEditItem(item)
  }

  const saveCreatedDate = async () => {
    const item = dateEditItem
    if (!item || !dateEditValue) { setDateEditItem(null); return }
    setDateEditItem(null)
    const currentData = getItemData(item)
    const newData = { ...currentData, customCreatedAt: dateEditValue }
    const previousItems = items
    setItems((prev) => prev.map((entry) => entry.id === item.id ? { ...entry, data: newData } : entry))
    try { await updateObject(item.id, { data: newData }) } catch { setItems(previousItems) }
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  const activeDragId = draggedId ?? touchDragId
  const activeDropTarget = draggedId ? dropTarget : touchDropTarget

  const DropIndicator = ({ active }: { active: boolean }) => (
    <div className={`h-0.5 w-full rounded-full transition-opacity duration-75 ${active ? "opacity-100 bg-primary" : "opacity-0"}`} />
  )

  const renderItem = (node: SidebarObject, level = 0) => {
    const meta = typeMeta[(node.type as ObjectType) ?? "note"] || typeMeta.note
    const colorCls = typeColors[(node.type as ObjectType) ?? "note"] || typeColors.note
    const isFolder = node.type === "folder"
    const isOpen = searchActive ? true : (openGroups[node.id] ?? false)
    const isDragging = activeDragId === node.id
    const isDropBefore = activeDropTarget?.id === node.id && activeDropTarget.position === "before"
    const isDropAfter  = activeDropTarget?.id === node.id && activeDropTarget.position === "after"
    const isDropInside = activeDropTarget?.id === node.id && activeDropTarget.position === "inside"
    const nodeData: any = typeof node.data === "string" ? JSON.parse((node.data as string) ?? "{}") : (node.data ?? {})
    const bgImage: string | undefined = nodeData?.backgroundImage

    return (
      <div key={node.id} className="relative">
        <DropIndicator active={isDropBefore} />

        <div
          ref={(el) => { if (el) itemRefs.current.set(node.id, el); else itemRefs.current.delete(node.id) }}
          // Desktop drag — reorder is only active when the grip was mousedown'd;
          // notes are additionally always draggable so they can be dragged out
          // onto the Party Notes canvas (see PartyNotesCanvas.tsx) without the grip.
          draggable={draggableId === node.id || node.type === "note"}
          onDragStart={(e) => {
            if (draggableId === node.id) { setDraggedId(node.id); return }
            if (node.type === "note") {
              e.dataTransfer.setData(NOTE_DRAG_TYPE, JSON.stringify({ objectId: node.id, name: node.name }))
              e.dataTransfer.effectAllowed = "copy"
              return
            }
            e.preventDefault()
          }}
          onDragEnd={() => { isDraggable.current = false; setDraggableId(null); setDraggedId(null); setDropTarget(null) }}
          onDragOver={(e) => handleDragOver(e, node)}
          onDrop={handleDrop}
          onContextMenu={(e) => handleContextMenu(e, node)}
          style={{
            paddingLeft: level * 5,
            backgroundImage: bgImage
              ? `linear-gradient(rgba(11,18,32,0.72), rgba(11,18,32,0.72)), url(${bgImage})`
              : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
          className={`flex w-full items-center gap-2 rounded-md pr-2 py-1.5 text-sm transition-all
            hover:bg-sidebar-accent select-none
            ${isDragging ? "opacity-40" : "opacity-100"}
            ${isDropInside ? "ring-1 ring-primary bg-sidebar-accent" : ""}
             ${isFolder && isOpen && !bgImage ? "bg-sidebar-accent/60 rounded-md" : ""}
          `}
        >
          {/* Text area — long-press here opens context menu on mobile */}
          <div
            className={`min-w-0 flex-1 text-left p-1`}
            onTouchStart={(e) => handleTextTouchStart(e, node)}
            onTouchMove={handleTextTouchMove}
            onTouchEnd={handleTextTouchEnd}
            onClick={isFolder ? () => toggleGroup(node.id) : () => onSelectObject?.(node)}
          >
            <div className="flex items-center gap-1.5 truncate">
              {isFolder && (
                <ChevronRight className={`size-3 shrink-0 text-sidebar-foreground/40 transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`} />
              )}
              {isPinned(node) && <Pin className="size-2.5 shrink-0 text-primary/70" />}
              <span className="truncate text-sm font-medium leading-tight">{node.name}</span>
            </div>

            <div className="flex items-center gap-1.5 text-[9px] tracking-widest leading-tight mt-0.5">
              <span className={`px-1.5 py-0.5 rounded-full font-semibold uppercase ${colorCls}`}>{meta.label}</span>

              {isFolder && isNoNesting(node) && (
                <span className="rounded px-1 py-0.5 bg-sidebar-foreground/10 text-sidebar-foreground/50 tracking-normal normal-case">
                  no-nest
                </span>
              )}
            </div>
          </div>

          <div
            onMouseDown={() => { isDraggable.current = true; setDraggableId(node.id) }}
            onMouseUp={() => { isDraggable.current = false; setDraggableId(null) }}
            onTouchStart={(e) => handleGripTouchStart(e, node)}
            onTouchMove={handleGripTouchMove}
            onTouchEnd={handleGripTouchEnd}
            className="cursor-grab active:cursor-grabbing touch-none size-8 p-1 -ml-1"
            aria-label="GRippie"
          >
            <GripVertical className="size-5 m text-muted-foreground/50" />
          </div>
        </div>

        <DropIndicator active={isDropAfter} />

        {isFolder && isOpen && (
          <div className={`mt-0.5 mb-0.5 ${node.children.length > 0 ? "ml-4 border-l-2 border-sidebar-foreground/10 rounded-bl" : ""}`}>
            {node.children.length > 0
              ? node.children.map((child) => renderItem(child, level + 1))
              : (
                <div
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
                  onDrop={handleDrop}
                  className="py-2 text-center text-[10px] text-sidebar-foreground/30 italic select-none"
                  style={{ paddingLeft: (level + 0.5) * 16 + 8 }}
                >
                  Empty folder — drop items here
                </div>
              )
            }
          </div>
        )}
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <VersionSwitcher />
        <SearchForm />
      </SidebarHeader>
      <SidebarContent>
        <div className="relative px-2 pt-2">
          <Search className="absolute left-4.5 top-1/2 -translate-y-1/2 size-3.5 text-sidebar-foreground/35 pointer-events-none" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search your objects…"
            className="w-full rounded-md bg-sidebar-accent/40 pl-8 pr-2 py-1.5 text-xs text-sidebar-foreground placeholder:text-sidebar-foreground/35 outline-none focus:bg-sidebar-accent/70 transition-colors"
          />
        </div>
        <div
          className="space-y-0 px-2 py-2"
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null) }}
        >
          {loading ? (
            <div className="text-xs text-sidebar-foreground/70">Loading items…</div>
          ) : tree.length === 0 ? (
            <div className="text-xs text-sidebar-foreground/70">No objects found for this user.</div>
          ) : visibleTree.length === 0 ? (
            <div className="text-xs text-sidebar-foreground/50 italic">No matches for "{searchQuery.trim()}".</div>
          ) : (
            visibleTree.map((item) => renderItem(item))
          )}
        </div>

        {activeDragId && items.find((i) => i.id === activeDragId)?.parent_id && (
          <div
            ref={rootZoneRef}
            onDragOver={(e) => { e.preventDefault(); setIsOverRoot(true); setDropTarget(null) }}
            onDragLeave={() => setIsOverRoot(false)}
            onDrop={handleDropToRoot}
            className={`mx-2 mb-2 rounded-md border-2 border-dashed px-3 py-3 text-center text-xs transition-colors ${
              (isOverRoot || touchOverRoot)
                ? "border-primary bg-sidebar-accent text-sidebar-foreground"
                : "border-sidebar-foreground/20 text-sidebar-foreground/40"
            }`}
          >
            Drop here to move to root
          </div>
        )}
      </SidebarContent>

      {/* Touch drag ghost */}
      {touchGhost && (
        <div
          className="fixed z-50 pointer-events-none rounded-md bg-popover border border-border shadow-lg px-3 py-1.5 text-sm font-medium opacity-90"
          style={{ left: touchGhost.x + 12, top: touchGhost.y - 20 }}
        >
          {touchGhost.label}
        </div>
      )}

      {contextMenu ? (
        <div
          className="fixed z-50 rounded-md border border-border bg-popover p-1 shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y, minWidth: 160 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" onClick={() => handleRename(contextMenu.item)}
            className="block w-full rounded-md px-3 py-2 text-left text-sm text-sidebar-foreground hover:bg-accent hover:text-accent-foreground">
            Rename
          </button>
          <button type="button" onClick={() => handleDelete(contextMenu.item)}
            className="block w-full rounded-md px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10 hover:text-destructive">
            Delete
          </button>
          <div className="my-1 border-t border-border" />
          <button type="button"
            onClick={() => { setDetailsItem(contextMenu.item); setContextMenu(null) }}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-sidebar-foreground hover:bg-accent hover:text-accent-foreground">
            <Info className="size-3.5" />
            View Details
          </button>
          {contextMenu.item.type === "folder" && (
            <>
              <div className="my-1 border-t border-border" />
              <button type="button"
                onClick={() => { handleSetRootFolder(contextMenu.item); setContextMenu(null) }}
                className="block w-full rounded-md px-3 py-2 text-left text-sm text-sidebar-foreground hover:bg-accent hover:text-accent-foreground">
                {isNoNesting(contextMenu.item) ? "✓ No-Nesting (click to disable)" : "Set Folder to 'No Nesting'"}
              </button>
            </>
          )}
          {contextMenu.item.type === "campaign" && onShowRosterSidebar && (
            <>
              <div className="my-1 border-t border-border" />
              <button type="button"
                onClick={() => { onShowRosterSidebar(contextMenu.item); setContextMenu(null) }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-sidebar-foreground hover:bg-accent hover:text-accent-foreground">
                <PanelRight className="size-3.5" />
                Show Roster Sidebar
              </button>
            </>
          )}
          <div className="my-1 border-t border-border" />
          <button type="button"
            onClick={() => handlePin(contextMenu.item)}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-sidebar-foreground hover:bg-accent hover:text-accent-foreground">
            <Pin className="size-3.5" />
            {isPinned(contextMenu.item) ? "Unpin from Top" : "Pin to Top"}
          </button>
          <div className="my-1 border-t border-border" />
          <button type="button"
            onClick={() => openBgPicker(contextMenu.item)}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-sidebar-foreground hover:bg-accent hover:text-accent-foreground">
            <ImageIcon className="size-3.5" />
            Set Background Image
          </button>
          {(() => {
            const d: any = typeof contextMenu.item.data === "string"
              ? JSON.parse((contextMenu.item.data as string) ?? "{}")
              : (contextMenu.item.data ?? {})
            return d?.backgroundImage ? (
              <button type="button"
                onClick={() => removeBgImage(contextMenu.item)}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10 hover:text-destructive">
                <XIcon className="size-3.5" />
                Remove Background
              </button>
            ) : null
          })()}
        </div>
      ) : null}

      {/* Background image picker */}
      {bgPickerItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setBgPickerItem(null)}
        >
          <div
            className="rounded-xl border border-border bg-popover p-4 shadow-xl w-80 max-h-[70vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Choose Background</span>
              <button type="button" onClick={() => setBgPickerItem(null)}
                className="size-6 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground">
                <XIcon className="size-4" />
              </button>
            </div>
            {bgImages.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-4">
                No images yet — upload some in Profile Settings.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {bgImages.map((img) => (
                  <button
                    key={img.name}
                    type="button"
                    onClick={() => applyBgImage(bgPickerItem, img.publicUrl)}
                    className="aspect-video rounded-md overflow-hidden border-2 border-transparent hover:border-primary transition-colors"
                  >
                    <img src={img.publicUrl} alt={img.name} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* View Details panel */}
      {detailsItem && (() => {
        const meta = typeMeta[(detailsItem.type as ObjectType) ?? "note"] || typeMeta.note
        const colorCls = typeColors[(detailsItem.type as ObjectType) ?? "note"] || typeColors.note
        const isCustomDate = !!getItemData(detailsItem)?.customCreatedAt
        const formattedDate = formatDateOnly(getCreatedDate(detailsItem))

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDetailsItem(null)}>
            <div className="rounded-xl border border-border bg-popover p-4 shadow-xl w-80" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">Details</span>
                <button type="button" onClick={() => setDetailsItem(null)}
                  className="size-6 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground">
                  <XIcon className="size-4" />
                </button>
              </div>
              <div className="flex flex-col gap-2.5 text-sm">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold">Name</div>
                  <div className="text-sidebar-foreground truncate">{detailsItem.name}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold">Type</div>
                  <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${colorCls}`}>{meta.label}</span>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold">Creation Date</div>
                  <div className="flex items-center gap-2">
                    <span className="text-sidebar-foreground">{formattedDate}</span>
                    {isCustomDate && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-sidebar-foreground/10 text-muted-foreground/70">custom</span>
                    )}
                  </div>
                </div>
              </div>
              <button type="button"
                onClick={() => { openDateEditor(detailsItem); setDetailsItem(null) }}
                className="mt-3 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-sidebar-foreground hover:bg-accent hover:text-accent-foreground">
                <CalendarClock className="size-3.5" />
                Change Creation Date
              </button>
            </div>
          </div>
        )
      })()}

      {/* Creation-date editor */}
      {dateEditItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDateEditItem(null)}>
          <div className="rounded-xl border border-border bg-popover p-4 shadow-xl w-72" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Set Creation Date</span>
              <button type="button" onClick={() => setDateEditItem(null)}
                className="size-6 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground">
                <XIcon className="size-4" />
              </button>
            </div>
            <input
              type="date"
              value={dateEditValue}
              onChange={(e) => setDateEditValue(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-sidebar-foreground outline-none focus:border-primary"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => setDateEditItem(null)}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                Cancel
              </button>
              <button type="button" onClick={saveCreatedDate}
                className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <SidebarRail />
    </Sidebar>
  )
}
