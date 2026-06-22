// ----- Imports -----
import * as React from "react"
import {
  ChevronDown,
  GripVertical,
  Pencil,
} from "lucide-react"

// ----- UI & Helper Imports -----
import { SearchForm } from "@/components/search-form"
import { VersionSwitcher } from "@/components/version-switcher"
import { Sidebar, SidebarContent, SidebarHeader, SidebarRail } from "@/components/ui/sidebar"
import { useUserContext } from "../../src/contexts/UserContext"
import type { userInfo } from "../types/userInfo"
import { buildObjectTree, reorderSidebarItems, moveToRoot } from "@/components/sidebar-utils"
import type { SidebarObject } from "@/components/sidebar-utils"

// ----- Types & Metadata -----
type ObjectType = "folder" | "note" | "character" | "monster" | "campaign"

const typeMeta: Record<ObjectType, { label: string }> = {
  folder: { label: "Folder"},
  note: { label: "Note"},
  character: { label: "Character"},
  monster: { label: "Monster" },
  campaign: { label: "Campaign"},
}

// ----- Component -----
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { objects, loading, updateObject, deleteObject, batchUpdateObjects } = useUserContext()
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({})
  const [draggedId, setDraggedId] = React.useState<string | null>(null)
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

  // Dismiss context menu on any outside click
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

  const handleDrop = async (targetId: string) => {
    if (!draggedId || draggedId === targetId) return

    const newItems = reorderSidebarItems(items, draggedId, targetId)
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
    event.stopPropagation() // prevent the window click handler from immediately closing it
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

  // ----- Render Helpers -----

  const renderItem = (node: SidebarObject, level = 0) => {
    const meta = typeMeta[(node.type as ObjectType) ?? "note"] || typeMeta.note
    const isFolder = node.type === "folder"
    const isOpen = openGroups[node.id] ?? false
    const isDragging = draggedId === node.id

    return (
      <div key={node.id} className="relative">
        {/* Indent guide lines for nested levels */}
        {level > 0 && (
          <div
            className="absolute top-0 bottom-0  border-sidebar-foreground/10 pointer-events-none"
            style={{ left: level * 16 - 8 }}
          />
        )}

        <div
          draggable
          onDragStart={() => setDraggedId(node.id)}
          onDragEnd={() => setDraggedId(null)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(e) => { e.stopPropagation(); handleDrop(node.id) }}
          onContextMenu={(event) => handleContextMenu(event, node)}
          style={{ paddingLeft: level * 10 }}
          className={`flex w-full items-center gap-2 rounded-md pr-2 py-1.5 text-sm transition-all cursor-grab active:cursor-grabbing
            hover:bg-sidebar-accent
            ${isDragging ? "opacity-40" : "opacity-100"}
          `}
        >
          <GripVertical className="size-3.5 shrink-0 text-muted-foreground/50" />

        
          <div className="min-w-0 flex-1 text-left"  >
            <div className="truncate text-sm font-medium leading-tight ">{node.name} </div>
            <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-sidebar-foreground/40 leading-tight">
             
              <span>{meta.label}</span>
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

          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); handleRename(node) }}
            className="shrink-0 flex h-6 w-6 items-center justify-center rounded p-0.5 text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors md:hidden"
            aria-label={`Rename ${node.name}`}
          >
            <Pencil className="size-3.5" />
          </button>
        </div>

        {/* Children — wrapped in a left-bordered container for visual grouping */}
        {isFolder && isOpen && (
          <div
            className={`mt-0.5 mb-0.5 transition-all ${
              node.children.length > 0
                ? "ml-4 pl-0 border-l-2 border-sidebar-foreground/10 rounded-bl"
                : ""
            }`}
          >
            {node.children.length > 0
              ? node.children.map((child) => renderItem(child, level + 1))
              : (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.stopPropagation(); handleDrop(node.id) }}
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
        <div className="space-y-2 px-2 py-2">
          {loading ? (
            <div className="text-xs text-sidebar-foreground/70">Loading items…</div>
          ) : tree.length === 0 ? (
            <div className="text-xs text-sidebar-foreground/70">No objects found for this user.</div>
          ) : (
            tree.map((item) => renderItem(item))
          )}
        </div>

        {/* Root drop zone — only visible while dragging a non-root item */}
        {draggedId && items.find((i) => i.id === draggedId)?.parent_id && (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsOverRoot(true) }}
            onDragLeave={() => setIsOverRoot(false)}
            onDrop={handleDropToRoot}
            className={`mx-2 mb-2 rounded-md border-2 border-dashed px-3 py-3 text-center text-xs transition-colors ${
              isOverRoot
                ? "border-sidebar-foreground/50 bg-sidebar-accent text-sidebar-foreground"
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
          onClick={(e) => e.stopPropagation()} // keep menu open when clicking inside it
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
        </div>
      ) : null}

      <SidebarRail />
    </Sidebar>
  )
}