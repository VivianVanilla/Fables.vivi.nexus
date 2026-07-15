// ════════════════════════════════════════════════════════════════════════════
// PaneView.tsx — one pane: its tab strip (switch/close/drag tabs, split
// buttons) plus the active tab's content. Dropping a dragged tab onto the
// content area splits the pane if you drop near an edge, or merges the tab
// into this pane's strip if you drop near the center — the highlighted
// overlay during drag-over shows which one is about to happen.
// ════════════════════════════════════════════════════════════════════════════

import { useState } from "react"
import { X, SplitSquareHorizontal, SplitSquareVertical } from "lucide-react"
import type { SidebarObject } from "@/components/sidebar-utils"
import { ObjectContent } from "./ObjectContent"
import type { LeafNode, Edge } from "./paneTree"

export const PANE_TAB_DRAG_TYPE = "application/x-fable-pane-tab"

interface DragPayload {
  objectId: string
  fromPaneId: string
}

function readDragPayload(e: React.DragEvent): DragPayload | null {
  try {
    const raw = e.dataTransfer.getData(PANE_TAB_DRAG_TYPE)
    return raw ? (JSON.parse(raw) as DragPayload) : null
  } catch {
    return null
  }
}

function edgeFromPointer(e: React.DragEvent, rect: DOMRect): Edge {
  const x = (e.clientX - rect.left) / rect.width
  const y = (e.clientY - rect.top) / rect.height
  const candidates: [Edge, number][] = [["left", x], ["right", 1 - x], ["top", y], ["bottom", 1 - y]]
  const [edge, dist] = candidates.reduce((a, b) => (b[1] < a[1] ? b : a))
  return dist < 0.25 ? edge : "center"
}

const EDGE_OVERLAY_STYLE: Record<Edge, React.CSSProperties> = {
  left:   { left: 0, top: 0, width: "50%", height: "100%" },
  right:  { right: 0, top: 0, width: "50%", height: "100%" },
  top:    { left: 0, top: 0, width: "100%", height: "50%" },
  bottom: { left: 0, bottom: 0, width: "100%", height: "50%" },
  center: { left: 0, top: 0, width: "100%", height: "100%" },
}

export function PaneView({
  leaf, objects, focused,
  onFocus, onActivateTab, onCloseTab, onSplit, onDropTab,
}: {
  leaf: LeafNode
  objects: SidebarObject[]
  focused: boolean
  onFocus: () => void
  onActivateTab: (objectId: string) => void
  onCloseTab: (objectId: string) => void
  onSplit: (direction: "row" | "column") => void
  onDropTab: (objectId: string, fromPaneId: string, edge: Edge) => void
}) {
  const [dragOverEdge, setDragOverEdge] = useState<Edge | null>(null)

  const tabObjects = leaf.tabs
    .map(id => objects.find(o => o.id === id))
    .filter((o): o is SidebarObject => !!o)
  const active = leaf.activeId ? objects.find(o => o.id === leaf.activeId) ?? null : null

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    if (!e.dataTransfer.types.includes(PANE_TAB_DRAG_TYPE)) return
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    setDragOverEdge(edgeFromPointer(e, rect))
  }
  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOverEdge(null)
    const payload = readDragPayload(e)
    if (!payload) return
    const rect = e.currentTarget.getBoundingClientRect()
    onDropTab(payload.objectId, payload.fromPaneId, edgeFromPointer(e, rect))
  }
  function handleStripDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const payload = readDragPayload(e)
    if (!payload) return
    onDropTab(payload.objectId, payload.fromPaneId, "center")
  }

  return (
    <div
      className={`flex flex-col h-full min-h-0 rounded-lg overflow-hidden ring-1 transition-colors ${focused ? "ring-foreground/20" : "ring-border/60"}`}
      onMouseDownCapture={onFocus}
    >
      {/* Tab strip */}
      <div
        className="flex items-stretch gap-0.5 px-1.5 pt-1.5 bg-muted/60 shrink-0 overflow-x-auto"
        onDragOver={e => { if (e.dataTransfer.types.includes(PANE_TAB_DRAG_TYPE)) e.preventDefault() }}
        onDrop={handleStripDrop}
      >
        {tabObjects.map(obj => {
          const isActive = obj.id === leaf.activeId
          return (
            <div
              key={obj.id}
              draggable
              onDragStart={e => e.dataTransfer.setData(PANE_TAB_DRAG_TYPE, JSON.stringify({ objectId: obj.id, fromPaneId: leaf.id }))}
              onClick={() => { onFocus(); onActivateTab(obj.id) }}
              title={obj.name}
              className={`group flex items-center gap-1.5 max-w-[10rem] px-2.5 py-1.5 rounded-t-md text-xs cursor-pointer select-none shrink-0 transition-colors ${
                isActive ? "bg-background text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
              }`}
            >
              <span className="truncate">{obj.name || "Untitled"}</span>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onCloseTab(obj.id) }}
                className="shrink-0 rounded-sm opacity-0 group-hover:opacity-100 hover:bg-foreground/15 transition-opacity"
              >
                <X className="size-3" />
              </button>
            </div>
          )
        })}
        {tabObjects.length > 0 && (
          <div className="ml-auto flex items-center gap-0.5 pb-1 shrink-0">
            <button type="button" onClick={() => onSplit("row")} title="Split right"
              className="size-6 flex items-center justify-center rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-foreground/10 transition-colors">
              <SplitSquareHorizontal className="size-3.5" />
            </button>
            <button type="button" onClick={() => onSplit("column")} title="Split down"
              className="size-6 flex items-center justify-center rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-foreground/10 transition-colors">
              <SplitSquareVertical className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Content + drop-zone overlay */}
      <div
        className="relative flex-1 min-h-0 bg-background"
        onDragOver={handleDragOver}
        onDragLeave={() => setDragOverEdge(null)}
        onDrop={handleDrop}
      >
        {active ? (
          <ObjectContent object={active} />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground/40 select-none px-4 text-center">
            {leaf.tabs.length > 0 ? "Empty pane — drag a tab here" : "Click a sidebar item to open it"}
          </div>
        )}
        {dragOverEdge && (
          <div
            className="absolute z-10 bg-primary/20 border-2 border-primary rounded-md pointer-events-none"
            style={EDGE_OVERLAY_STYLE[dragOverEdge]}
          />
        )}
      </div>
    </div>
  )
}
