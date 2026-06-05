import * as React from "react"
import {
  ChevronDown,
  Folder,
  FileText,
  User2,
  Skull,
  Sparkles,
  GripVertical,
} from "lucide-react"

import { SearchForm } from "@/components/search-form"
import { VersionSwitcher } from "@/components/version-switcher"
import { Sidebar, SidebarContent, SidebarHeader, SidebarRail } from "@/components/ui/sidebar"
import { useUserContext } from "../../src/contexts/UserContext"
import type { userInfo } from "../types/userInfo"

type SidebarObject = userInfo.Objects & { children: SidebarObject[] }

type ObjectType = "folder" | "note" | "character" | "monster" | "campaign"

const typeMeta: Record<ObjectType, { label: string; icon: typeof Folder; color: string }> = {
  folder: { label: "Folder", icon: Folder, color: "text-indigo-500" },
  note: { label: "Note", icon: FileText, color: "text-amber-500" },
  character: { label: "Character", icon: User2, color: "text-emerald-500" },
  monster: { label: "Monster", icon: Skull, color: "text-rose-500" },
  campaign: { label: "Campaign", icon: Sparkles, color: "text-sky-500" },
}

function sortByPosition(a: userInfo.Objects, b: userInfo.Objects) {
  return (a.position ?? 0) - (b.position ?? 0)
}

function buildObjectTree(items: userInfo.Objects[]) {
  const map = new Map<string, SidebarObject>()
  const nodes: SidebarObject[] = items.map((item) => ({ ...item, children: [] }))

  nodes.forEach((node) => map.set(node.id, node))

  nodes.sort(sortByPosition)

  const roots: SidebarObject[] = []

  nodes.forEach((node) => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  })

  function sortRecursive(list: SidebarObject[]) {
    list.sort((a, b) => sortByPosition(a, b))
    list.forEach((item) => sortRecursive(item.children))
  }

  sortRecursive(roots)
  return roots
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { objects, loading } = useUserContext()
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({})
  const [draggedId, setDraggedId] = React.useState<string | null>(null)
  const [items, setItems] = React.useState<userInfo.Objects[]>([])

  React.useEffect(() => {
    setItems(objects)
  }, [objects])

  const tree = React.useMemo(() => buildObjectTree(items), [items])

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleDrop = (targetId: string) => {
    if (!draggedId) return
    if (draggedId === targetId) return

    setItems((prevItems) => {
      const dragged = prevItems.find((item) => item.id === draggedId)
      const target = prevItems.find((item) => item.id === targetId)
      if (!dragged || !target) return prevItems
      if (dragged.parent_id !== target.parent_id) return prevItems

      const siblings = prevItems
        .filter((item) => item.parent_id === dragged.parent_id)
        .sort(sortByPosition)

      const draggedIndex = siblings.findIndex((item) => item.id === draggedId)
      const targetIndex = siblings.findIndex((item) => item.id === targetId)
      if (draggedIndex === -1 || targetIndex === -1) return prevItems

      const newOrder = [...siblings]
      newOrder.splice(draggedIndex, 1)
      newOrder.splice(targetIndex, 0, dragged)

      return prevItems.map((item) => {
        const index = newOrder.findIndex((node) => node.id === item.id)
        if (index === -1) return item
        return { ...item, position: index }
      })
    })

    setDraggedId(null)
  }

  const renderItem = (node: SidebarObject, level = 0) => {
    const meta = typeMeta[(node.type as ObjectType) ?? "note"] || typeMeta.note
    const Icon = meta.icon
    const isFolder = node.type === "folder"
    const isOpen = openGroups[node.id]

    return (
      <div key={node.id}>
        <div
          draggable
          onDragStart={() => setDraggedId(node.id)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => handleDrop(node.id)}
          className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition hover:bg-sidebar-accent ${
            level > 0 ? "ml-4" : ""
          }`}
          style={{ paddingLeft: `${level * 1.25}rem` }}
        >
          <GripVertical className="size-4 text-muted-foreground" />
          <Icon className={`size-4 ${meta.color}`} />
          <div className="min-w-0 flex-1 text-left">
            <div className="truncate font-medium">{node.name}</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/50">
              {meta.label}
            </div>
          </div>
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
        </div>

        {isFolder && isOpen && node.children.length > 0 && (
          <div className="space-y-1">
            {node.children.map((child) => renderItem(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

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
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
