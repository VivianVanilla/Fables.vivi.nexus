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
} from "lucide-react"

// ----- UI & Helper Imports -----
import { SearchForm } from "@/components/search-form"
import { VersionSwitcher } from "@/components/version-switcher"
import { Sidebar, SidebarContent, SidebarHeader, SidebarRail } from "@/components/ui/sidebar"
import { useUserContext } from "../../src/contexts/UserContext"
import type { userInfo } from "../types/userInfo"
import { buildObjectTree, extractFolderColor, reorderWithinParent } from "@/components/sidebar-utils"
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
  // State & Context
  const { objects, loading } = useUserContext()
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({})
  const [draggedId, setDraggedId] = React.useState<string | null>(null)
  const [items, setItems] = React.useState<userInfo.Objects[]>([])

  // Effects
  React.useEffect(() => {
    setItems(objects)
  }, [objects])

  const tree = React.useMemo(() => buildObjectTree(items), [items])

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // ----- Drag / Drop Handlers -----

  const handleDrop = (targetId: string) => {
    if (!draggedId) return
    if (draggedId === targetId) return

    setItems((prev) => reorderWithinParent(prev, draggedId, targetId))
    setDraggedId(null)
  }

  // ----- Render Helpers -----

  const renderItem = (node: SidebarObject, level = 0) => {
    const meta = typeMeta[(node.type as ObjectType) ?? "note"] || typeMeta.note
    const Icon = meta.icon
    const isFolder = node.type === "folder"
    const isOpen = openGroups[node.id]

    const folderColor = extractFolderColor(node)

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
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
