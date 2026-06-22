// ----- Imports -----
import * as React from "react"
import {
  ChevronDown,
  Folder,
  FileText,
  User2,
  Skull,
  Sparkles,
  GripVertical,
  Pencil,
} from "lucide-react"

// ----- UI & Helper Imports -----
import { SearchForm } from "@/components/search-form"
import { VersionSwitcher } from "@/components/version-switcher"
import { Sidebar, SidebarContent, SidebarHeader, SidebarRail } from "@/components/ui/sidebar"
import { useUserContext } from "../../src/contexts/UserContext"
import type { userInfo } from "../types/userInfo"
import { buildObjectTree, extractFolderColor, reorderSidebarItems, moveToRoot } from "@/components/sidebar-utils"
import type { SidebarObject } from "@/components/sidebar-utils"

// ----- Types & Metadata -----
type ObjectType = "folder" | "note" | "character" | "monster" | "campaign"

const typeMeta: Record<ObjectType, { label: string; icon: typeof Folder; bg: string; fg?: string }> = {
  folder: { label: "Folder", icon: Folder, bg: "#000000" },
  note: { label: "Note", icon: FileText, bg: "#F59E0B" },
  character: { label: "Character", icon: User2, bg: "#1da0b8" },
  monster: { label: "Monster", icon: Skull, bg: "#91091f" },
  campaign: { label: "Campaign", icon: Sparkles, bg: "#070605" },
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
    const Icon = meta.icon
    // FIX: use type === "folder", not hasChildren — empty folders still need a toggle
    const isFolder = node.type === "folder"
    const isOpen = openGroups[node.id] ?? false
    const folderColor = extractFolderColor(node)

    return (
      <div key={node.id}>
        <div
          draggable
          onDragStart={() => setDraggedId(node.id)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => handleDrop(node.id)}
          onContextMenu={(event) => handleContextMenu(event, node)}
          className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition hover:bg-sidebar-accent ${
            level > 0 ? "ml-4" : ""
          }`}
        >
          <GripVertical className="size-4 text-muted-foreground" />
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-md"
            style={{ backgroundColor: folderColor ?? meta.bg }}
          >
            <Icon className="size-4 text-white" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 text-left">
            <div className="truncate font-medium flex items-center gap-2">
              <span className="truncate">{node.name}</span>
            </div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/50">
              {meta.label}
            </div>
          </div>
          {/* FIX: chevron only on folders, regardless of whether they have children */}
          {isFolder ? (
            <button
              type="button"
              onClick={() => toggleGroup(node.id)}
              className="rounded-full p-1 text-sidebar-foreground/70 hover:text-sidebar-foreground"
            >
              <ChevronDown
                className={`size-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </button>
          ) : null}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              handleRename(node)
            }}
            className="flex h-7 w-7 items-center justify-center rounded-full p-1 text-sidebar-foreground/70 hover:text-sidebar-foreground md:hidden"
            aria-label={`Rename ${node.name}`}
          >
            <Pencil className="size-4" />
          </button>
        </div>

        {isFolder && isOpen && node.children.length > 0 && (
          <div className="space-y-1">
            {node.children.map((child) => renderItem(child, level + 1))}
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

        {/* Root drop zone — only visible while dragging */}
        {draggedId && (
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
