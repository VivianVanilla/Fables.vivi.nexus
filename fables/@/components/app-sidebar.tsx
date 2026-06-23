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

// ----- Component -----
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { objects, loading, updateObject, deleteObject, batchUpdateObjects } = useUserContext()
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({})
  const [draggedId, setDraggedId] = React.useState<string | null>(null)
  const [dropTarget, setDropTarget] = React.useState<DropTarget | null>(null)
  const [isOverRoot, setIsOverRoot] = React.useState(false)
  const [items, setItems] = React.useState<userInfo.Objects[]>([])
  const [contextMenu, setContextMenu] = React.useState<{
    x: number
    y: number
    item: SidebarObject
  } | null>(null)

  React.useEffect(() => {
    setItems(objects)
  }, [objects])

  React.useEffect(() => {
    if (!contextMenu) return
    const handler = () => setContextMenu(null)
    window.addEventListener("click", handler)
    return () => window.removeEventListener("click", handler)
  }, [contextMenu])

  const tree = React.useMemo(() => buildObjectTree(items), [items])

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // ----- Drag / Drop -----

  // Determine drop position (before / inside / after) based on mouse Y within the element
  const getDropPosition = (
    event: React.DragEvent<HTMLDivElement>,
    isFolder: boolean
  ): DropPosition => {
    const rect = event.currentTarget.getBoundingClientRect()
    const y = event.clientY - rect.top
    const pct = y / rect.height

    if (isFolder) {
      // Top 25% = before, middle 50% = inside, bottom 25% = after
      if (pct < 0.25) return "before"
      if (pct > 0.75) return "after"
      return "inside"
    }
    // Non-folders: top half = before, bottom half = after
    return pct < 0.5 ? "before" : "after"
  }

  const handleDragOver = (
    event: React.DragEvent<HTMLDivElement>,
    node: SidebarObject
  ) => {
    event.preventDefault()
    event.stopPropagation()
    if (!draggedId || draggedId === node.id) return
    const position = getDropPosition(event, node.type === "folder")
    setDropTarget({ id: node.id, position })
    setIsOverRoot(false)
  }

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.stopPropagation()
    if (!draggedId || !dropTarget) {
      setDraggedId(null)
      setDropTarget(null)
      return
    }

    const newItems = applyDrop(items, draggedId, dropTarget)
    setDropTarget(null)

    if (newItems === items) {
      setDraggedId(null)
      return
    }

    const previousItems = items
    setItems(newItems)
    setDraggedId(null)

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

  const handleDropToRoot = async () => {
    setIsOverRoot(false)
    if (!draggedId) return

    const newItems = moveToRoot(items, draggedId)
    if (newItems === items) {
      setDraggedId(null)
      return
    }

    const previousItems = items
    setItems(newItems)
    setDraggedId(null)

    const changed = newItems
      .filter((item) => {
        const original = previousItems.find((o) => o.id === item.id)
        return original && (original.parent_id !== item.parent_id || original.position !== item.position)
      })
      .map((item) => ({
        id: item.id,
        parent_id: item.parent_id ?? null,
        position: item.position ?? 0,
      }))

    try {
      await batchUpdateObjects(changed)
    } catch (error) {
      console.error("Error moving to root:", error)
      setItems(previousItems)
    }
  }

  // ----- Context Menu -----

  const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>, item: SidebarObject) => {
    event.preventDefault()
    event.stopPropagation()
    setContextMenu({ x: event.clientX, y: event.clientY, item })
  }

  const handleRename = async (item: SidebarObject) => {
    setContextMenu(null)
    const nextName = window.prompt("Rename item", item.name)?.trim()
    if (!nextName || nextName === item.name) return

    const previousItems = items
    setItems((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, name: nextName } : entry)))

    try {
      await updateObject(item.id, { name: nextName })
    } catch (error) {
      console.error("Rename failed:", error)
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
    } catch (error) {
      console.error("Delete failed:", error)
      setItems(previousItems)
    }
  }

  const handleSetRootFolder = async (item: SidebarObject) => {
    const currentData: any = typeof item.data === "string"
      ? JSON.parse(item.data ?? "{}")
      : (item.data ?? {})
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
    } catch (error) {
      console.error("Failed to update no-nesting flag:", error)
      setItems(previousItems)
    }
  }

  // ----- Render Helpers -----

  // A thin coloured line shown between/around items during drag
  const DropIndicator = ({ active }: { active: boolean }) => (
    <div
      className={`h-0.5 w-full rounded-full transition-opacity duration-75 ${
        active ? "opacity-100 bg-primary" : "opacity-0"
      }`}
    />
  )

  const renderItem = (node: SidebarObject, level = 0) => {
    const meta = typeMeta[(node.type as ObjectType) ?? "note"] || typeMeta.note
    const isFolder = node.type === "folder"
    const isOpen = openGroups[node.id] ?? false
    const isDragging = draggedId === node.id

    const isDropBefore = dropTarget?.id === node.id && dropTarget.position === "before"
    const isDropAfter  = dropTarget?.id === node.id && dropTarget.position === "after"
    const isDropInside = dropTarget?.id === node.id && dropTarget.position === "inside"

    return (
      <div key={node.id} className="relative">
        {/* BEFORE indicator */}
        <DropIndicator active={isDropBefore} />

        <div
          draggable
          onDragStart={() => setDraggedId(node.id)}
          onDragEnd={() => { setDraggedId(null); setDropTarget(null) }}
          onDragOver={(e) => handleDragOver(e, node)}
          onDrop={handleDrop}
          onContextMenu={(event) => handleContextMenu(event, node)}
          style={{ paddingLeft: level * 10 }}
          className={`flex w-full items-center gap-2 rounded-md pr-2 py-1.5 text-sm transition-all cursor-grab active:cursor-grabbing
            hover:bg-sidebar-accent
            ${isDragging ? "opacity-40" : "opacity-100"}
            ${isDropInside ? "ring-1 ring-primary bg-sidebar-accent" : ""}
          `}
        >
          <GripVertical className="size-3.5 shrink-0 text-muted-foreground/50" />

          <div className="min-w-0 flex-1 text-left">
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
              <ChevronDown
                className={`size-3.5 transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}
              />
            </button>
          )}
        </div>

        {/* AFTER indicator */}
        <DropIndicator active={isDropAfter} />

        {/* Children */}
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

  // ----- Render (JSX) -----

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
            // Clear drop target when leaving the list entirely
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setDropTarget(null)
            }
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

        {/* Root drop zone — only for non-root items */}
        {draggedId && items.find((i) => i.id === draggedId)?.parent_id && (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsOverRoot(true); setDropTarget(null) }}
            onDragLeave={() => setIsOverRoot(false)}
            onDrop={handleDropToRoot}
            className={`mx-2 mb-2 rounded-md border-2 border-dashed px-3 py-3 text-center text-xs transition-colors ${
              isOverRoot
                ? "border-primary bg-sidebar-accent text-sidebar-foreground"
                : "border-sidebar-foreground/20 text-sidebar-foreground/40"
            }`}
          >
            Drop here to move to root
          </div>
        )}
      </SidebarContent>

      {contextMenu ? (
        <div
          className="fixed z-50 rounded-md border border-border bg-popover p-1 shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y, minWidth: 160 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => handleRename(contextMenu.item)}
            className="block w-full rounded-md px-3 py-2 text-left text-sm text-sidebar-foreground hover:bg-accent hover:text-accent-foreground"
          >
            Rename
          </button>
          <button
            type="button"
            onClick={() => handleDelete(contextMenu.item)}
            className="block w-full rounded-md px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            Delete
          </button>

          {contextMenu.item.type === "folder" && (
            <>
              <div className="my-1 border-t border-border" />
              <button
                type="button"
                onClick={() => {
                  handleSetRootFolder(contextMenu.item)
                  setContextMenu(null)
                }}
                className="block w-full rounded-md px-3 py-2 text-left text-sm text-sidebar-foreground hover:bg-accent hover:text-accent-foreground"
              >
                {isNoNesting(contextMenu.item)
                  ? "✓ No-Nesting (click to disable)"
                  : "Set Folder to 'No Nesting'"}
              </button>
            </>
          )}
        </div>
      ) : null}

      <SidebarRail />
    </Sidebar>
  )
}