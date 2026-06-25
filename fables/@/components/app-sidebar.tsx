// ----- Imports -----
import * as React from "react"
import { ChevronDown, GripVertical } from "lucide-react"

// ----- UI & Helper Imports -----
import { SearchForm } from "@/components/search-form"
import { VersionSwitcher } from "@/components/version-switcher"
import { Sidebar, SidebarContent, SidebarHeader, SidebarRail } from "@/components/ui/sidebar"
import { useUserContext } from "../../src/contexts/UserContext"
import type { userInfo } from "../types/userInfo"
import { buildObjectTree, applyDrop, moveToRoot, isNoNesting } from "@/components/sidebar-utils"
import type { SidebarObject, DropTarget, DropPosition } from "@/components/sidebar-utils"

// ----- Types & Metadata -----
type ObjectType = "folder" | "note" | "character" | "monster" | "campaign"

const typeMeta: Record<ObjectType, { label: string }> = {
  folder: { label: "Folder" },
  note: { label: "Note" },
  character: { label: "Character" },
  monster: { label: "Monster" },
  campaign: { label: "Campaign" },
}

const LONG_PRESS_MS = 500

// ----- Component -----
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { objects, loading, updateObject, deleteObject, batchUpdateObjects } = useUserContext()
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({})

  // Desktop drag state
  const [draggedId, setDraggedId] = React.useState<string | null>(null)
  const [dropTarget, setDropTarget] = React.useState<DropTarget | null>(null)
  const [isOverRoot, setIsOverRoot] = React.useState(false)

  // Touch drag state
  const [touchDragId, setTouchDragId] = React.useState<string | null>(null)
  const [touchDropTarget, setTouchDropTarget] = React.useState<DropTarget | null>(null)
  const [touchGhost, setTouchGhost] = React.useState<{ x: number; y: number; label: string } | null>(null)
  const [touchOverRoot, setTouchOverRoot] = React.useState(false)

  const [items, setItems] = React.useState<userInfo.Objects[]>([])
  const [contextMenu, setContextMenu] = React.useState<{
    x: number; y: number; item: SidebarObject
  } | null>(null)

  // Refs for touch timers
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const gripDragTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchMoved = React.useRef(false)
  const itemRefs = React.useRef<Map<string, HTMLDivElement>>(new Map())
  const rootZoneRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => { setItems(objects) }, [objects])

  React.useEffect(() => {
    if (!contextMenu) return
    const handler = () => setContextMenu(null)
    window.addEventListener("click", handler)
    return () => window.removeEventListener("click", handler)
  }, [contextMenu])

  const tree = React.useMemo(() => buildObjectTree(items), [items])

  const toggleGroup = (id: string) =>
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }))

  // ── Shared: commit a drop ─────────────────────────────────────────────────

  const commitDrop = async (
    activeId: string,
    target: DropTarget | null,
    toRoot: boolean
  ) => {
    if (toRoot) {
      const newItems = moveToRoot(items, activeId)
      if (newItems === items) return
      await persistChanges(newItems)
      return
    }
    if (!target) return
    const newItems = applyDrop(items, activeId, target)
    if (newItems === items) return
    await persistChanges(newItems)
  }

  const persistChanges = async (newItems: userInfo.Objects[]) => {
    const previousItems = items
    setItems(newItems)

    const changed = newItems
      .filter((item) => {
        const original = previousItems.find((o) => o.id === item.id)
        return original && (
          original.parent_id !== item.parent_id ||
          original.position !== item.position
        )
      })
      .map((item) => ({
        id: item.id,
        parent_id: item.parent_id ?? null,
        position: item.position ?? 0,
      }))

    try {
      await batchUpdateObjects(changed)
    } catch (error) {
      console.error("Error saving reorder:", error)
      setItems(previousItems)
    }
  }

  // ── Desktop drag handlers ─────────────────────────────────────────────────

  const getDropPosition = (
    event: React.DragEvent<HTMLDivElement>,
    isFolder: boolean
  ): DropPosition => {
    const rect = event.currentTarget.getBoundingClientRect()
    const pct = (event.clientY - rect.top) / rect.height
    if (isFolder) {
      if (pct < 0.25) return "before"
      if (pct > 0.75) return "after"
      return "inside"
    }
    return pct < 0.5 ? "before" : "after"
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, node: SidebarObject) => {
    e.preventDefault()
    e.stopPropagation()
    if (!draggedId || draggedId === node.id) return
    setDropTarget({ id: node.id, position: getDropPosition(e, node.type === "folder") })
    setIsOverRoot(false)
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.stopPropagation()
    const activeId = draggedId
    const target = dropTarget
    setDraggedId(null)
    setDropTarget(null)
    if (!activeId) return
    await commitDrop(activeId, target, false)
  }

  const handleDropToRoot = async () => {
    setIsOverRoot(false)
    const activeId = draggedId
    setDraggedId(null)
    setDropTarget(null)
    if (!activeId) return
    await commitDrop(activeId, null, true)
  }

  // ── Touch: long-press on row → context menu ───────────────────────────────

  const handleRowTouchStart = (e: React.TouchEvent<HTMLDivElement>, node: SidebarObject) => {
    // Only fire if NOT touching the grip (grip has its own handler)
    touchMoved.current = false
    longPressTimer.current = setTimeout(() => {
      if (!touchMoved.current) {
        const touch = e.touches[0]
        setContextMenu({ x: touch.clientX, y: touch.clientY, item: node })
      }
    }, LONG_PRESS_MS)
  }

  const handleRowTouchMove = () => {
    touchMoved.current = true
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const handleRowTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  // ── Touch: grip hold → drag ───────────────────────────────────────────────

  const getDropPositionFromY = (rect: DOMRect, clientY: number, isFolder: boolean): DropPosition => {
    const pct = (clientY - rect.top) / rect.height
    if (isFolder) {
      if (pct < 0.25) return "before"
      if (pct > 0.75) return "after"
      return "inside"
    }
    return pct < 0.5 ? "before" : "after"
  }

  const resolveDropTargetFromPoint = (clientX: number, clientY: number): { target: DropTarget | null; overRoot: boolean } => {
    // Check root zone first
    if (rootZoneRef.current) {
      const r = rootZoneRef.current.getBoundingClientRect()
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
        return { target: null, overRoot: true }
      }
    }

    // Check item rects
    for (const [id, el] of itemRefs.current.entries()) {
      if (id === touchDragId) continue
      const r = el.getBoundingClientRect()
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
        const node = items.find((i) => i.id === id)
        const isFolder = node?.type === "folder"
        const position = getDropPositionFromY(r, clientY, !!isFolder)
        return { target: { id, position }, overRoot: false }
      }
    }

    return { target: null, overRoot: false }
  }

  const handleGripTouchStart = (e: React.TouchEvent<HTMLDivElement>, node: SidebarObject) => {
    e.stopPropagation() // don't fire the row long-press
    const touch = e.touches[0]

    gripDragTimer.current = setTimeout(() => {
      setTouchDragId(node.id)
      setTouchGhost({ x: touch.clientX, y: touch.clientY, label: node.name })
    }, LONG_PRESS_MS)
  }

  const handleGripTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    // Cancel grip timer if finger moves before hold completes
    if (gripDragTimer.current && !touchDragId) {
      clearTimeout(gripDragTimer.current)
      gripDragTimer.current = null
      return
    }
    if (!touchDragId) return

    
    const touch = e.touches[0]
    setTouchGhost({ x: touch.clientX, y: touch.clientY, label: touchGhost?.label ?? "" })

    const { target, overRoot } = resolveDropTargetFromPoint(touch.clientX, touch.clientY)
    setTouchDropTarget(target)
    setTouchOverRoot(overRoot)
  }

  const handleGripTouchEnd = async () => {
    if (gripDragTimer.current) {
      clearTimeout(gripDragTimer.current)
      gripDragTimer.current = null
    }
    if (!touchDragId) return

    const activeId = touchDragId
    const target = touchDropTarget
    const toRoot = touchOverRoot

    setTouchDragId(null)
    setTouchGhost(null)
    setTouchDropTarget(null)
    setTouchOverRoot(false)

    await commitDrop(activeId, target, toRoot)
  }

  // ── Context Menu actions ──────────────────────────────────────────────────

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>, item: SidebarObject) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, item })
  }

  const handleRename = async (item: SidebarObject) => {
    setContextMenu(null)
    const nextName = window.prompt("Rename item", item.name)?.trim()
    if (!nextName || nextName === item.name) return
    const previousItems = items
    setItems((prev) => prev.map((entry) => entry.id === item.id ? { ...entry, name: nextName } : entry))
    try {
      await updateObject(item.id, { name: nextName })
    } catch {
      setItems(previousItems)
    }
  }

  const handleDelete = async (item: SidebarObject) => {
    setContextMenu(null)
    const confirmation = window.prompt(`Type DELETE to confirm deleting "${item.name}"`, "")
    if (confirmation !== "DELETE") return
    const previousItems = items
    setItems((prev) => prev.filter((entry) => entry.id !== item.id))
    try {
      await deleteObject(item.id)
    } catch {
      setItems(previousItems)
    }
  }

  const handleSetRootFolder = async (item: SidebarObject) => {
    const currentData: any = typeof item.data === "string"
      ? JSON.parse(item.data ?? "{}") : (item.data ?? {})
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
    } catch {
      setItems(previousItems)
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  const activeDragId = draggedId ?? touchDragId
  const activeDropTarget = draggedId ? dropTarget : touchDropTarget

  const DropIndicator = ({ active }: { active: boolean }) => (
    <div className={`h-0.5 w-full rounded-full transition-opacity duration-75 ${active ? "opacity-100 bg-primary" : "opacity-0"}`} />
  )

  const renderItem = (node: SidebarObject, level = 0) => {
    const meta = typeMeta[(node.type as ObjectType) ?? "note"] || typeMeta.note
    const isFolder = node.type === "folder"
    const isOpen = openGroups[node.id] ?? false
    const isDragging = activeDragId === node.id

    const isDropBefore = activeDropTarget?.id === node.id && activeDropTarget.position === "before"
    const isDropAfter  = activeDropTarget?.id === node.id && activeDropTarget.position === "after"
    const isDropInside = activeDropTarget?.id === node.id && activeDropTarget.position === "inside"

    return (
      <div key={node.id} className="relative">
        <DropIndicator active={isDropBefore} />

        <div
          ref={(el) => { if (el) itemRefs.current.set(node.id, el); else itemRefs.current.delete(node.id) }}
          // Desktop drag
          onDragStart={() => setDraggedId(node.id)}
          onDragEnd={() => { setDraggedId(null); setDropTarget(null) }}
          onDragOver={(e) => handleDragOver(e, node)}
          onDrop={handleDrop}
          // Desktop right-click context menu
          onContextMenu={(e) => handleContextMenu(e, node)}
           // Mobile long-press context menu (on the row, not the grip)
          onTouchStart={(e) => handleRowTouchStart(e, node)}
            onTouchMove={handleRowTouchMove}
          onTouchEnd={handleRowTouchEnd}
        
          style={{ paddingLeft: level * 5 }}
          className={`flex w-full items-center gap-2 rounded-md pr-2 py-1.5 text-sm transition-all
            hover:bg-sidebar-accent select-none
            ${isDragging ? "opacity-40" : "opacity-100"}
            ${isDropInside ? "ring-1 ring-primary bg-sidebar-accent" : ""}
          `}
        >
          {/* Grip — mobile touch-drag handle */}
          <div 
           draggable
            onTouchStart={(e) => handleGripTouchStart(e, node)}
            onTouchMove={handleGripTouchMove}
            onTouchEnd={handleGripTouchEnd}
            
            className="cursor-grab active:cursor-grabbing touch-none shrink-0 p-1 -ml-1"
            aria-label="Drag to reorder"
          >
            <GripVertical className="size-3.5 text-muted-foreground/50" />
          </div>

          <div className="min-w-0 flex-1 text-left" 
         
          >
            <div className="truncate text-sm font-medium leading-tight">{node.name}</div>
            <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-sidebar-foreground/40 leading-tight">
              <span>{meta.label}</span>
              {isFolder && isNoNesting(node) && (
                <span className="rounded px-1 bg-sidebar-foreground/10 text-sidebar-foreground/50 tracking-normal normal-case">
                  no-nest
                </span>
              )}
            </div>
          </div>

          {isFolder && (
            <button
              type="button"
              onClick={() => toggleGroup(node.id)}
              className="shrink-0 rounded p-0.5 text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors"
            >
              <ChevronDown className={`size-3.5 transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`} />
            </button>
          )}
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
        <div
          className="space-y-0 px-2 py-2"
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null)
          }}
        >
          {loading ? (
            <div className="text-xs text-sidebar-foreground/70">Loading items…</div>
          ) : tree.length === 0 ? (
            <div className="text-xs text-sidebar-foreground/70">No objects found for this user.</div>
          ) : (
            tree.map((item) => renderItem(item))
          )}
        </div>

        {/* Root drop zone */}
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

      {/* Context menu */}
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
        </div>
      ) : null}

      <SidebarRail />
    </Sidebar>
  )
}