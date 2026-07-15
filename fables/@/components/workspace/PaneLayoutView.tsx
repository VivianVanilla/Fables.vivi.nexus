// ════════════════════════════════════════════════════════════════════════════
// PaneLayoutView.tsx — recursively renders a LayoutNode tree: a Leaf becomes
// a PaneView, a Split becomes two children side-by-side (or stacked) with a
// drag-to-resize divider between them.
// ════════════════════════════════════════════════════════════════════════════

import { useRef, type RefObject } from "react"
import type { SidebarObject } from "@/components/sidebar-utils"
import { PaneView } from "./PaneView"
import type { LayoutNode, Edge } from "./paneTree"

// Kept just large enough that a pane's tab strip (name + close + split
// buttons) doesn't get crushed — below this a pane stops being usable, not
// just small. Lowered from an earlier, more conservative 15% so splitting
// aggressively (lots of panes) has real room to work.
const MIN_PANE_PERCENT = 6

function ResizeHandle({ direction, onResize, containerRef }: { direction: "row" | "column"; onResize: (deltaPercent: number) => void; containerRef: RefObject<HTMLDivElement | null> }) {
  const containerSizeRef = useRef(0)

  function startDrag(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault()
    // Sized off the outer flex row/column itself, not this handle's DOM
    // parent — that parent is a `display: contents` wrapper (see below) so
    // it never generates a box and getBoundingClientRect() on it is useless.
    const track = containerRef.current?.getBoundingClientRect()
    containerSizeRef.current = track ? (direction === "row" ? track.width : track.height) : 1
    const startPos = direction === "row" ? e.clientX : e.clientY

    function onMove(ev: PointerEvent) {
      const pos = direction === "row" ? ev.clientX : ev.clientY
      const deltaPercent = ((pos - startPos) / containerSizeRef.current) * 100
      onResize(deltaPercent)
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

  return (
    <div
      onPointerDown={startDrag}
      className={`shrink-0 group relative z-10 ${direction === "row" ? "w-2 -mx-1 cursor-col-resize" : "h-2 -my-1 cursor-row-resize"}`}
    >
      <div className={`absolute bg-transparent group-hover:bg-foreground/15 transition-colors ${direction === "row" ? "inset-y-0 left-1/2 -translate-x-1/2 w-0.5" : "inset-x-0 top-1/2 -translate-y-1/2 h-0.5"}`} />
    </div>
  )
}

export function PaneLayoutView({
  node, objects, focusedPaneId,
  onFocus, onActivateTab, onCloseTab, onSplit, onSplitAtEdge, onDropTab, onResize,
}: {
  node: LayoutNode
  objects: SidebarObject[]
  focusedPaneId: string
  onFocus: (paneId: string) => void
  onActivateTab: (paneId: string, objectId: string) => void
  onCloseTab: (paneId: string, objectId: string) => void
  onSplit: (paneId: string, direction: "row" | "column") => void
  onSplitAtEdge: (paneId: string, edge: Exclude<Edge, "center">) => string | null
  onDropTab: (targetPaneId: string, objectId: string, fromPaneId: string, edge: Edge) => void
  onResize: (splitId: string, sizes: number[]) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  if (node.type === "leaf") {
    return (
      <PaneView
        leaf={node}
        objects={objects}
        focused={node.id === focusedPaneId}
        onFocus={() => onFocus(node.id)}
        onActivateTab={objectId => onActivateTab(node.id, objectId)}
        onCloseTab={objectId => onCloseTab(node.id, objectId)}
        onSplit={direction => onSplit(node.id, direction)}
        onSplitAtEdge={edge => onSplitAtEdge(node.id, edge)}
        onDropTab={(objectId, fromPaneId, edge) => onDropTab(node.id, objectId, fromPaneId, edge)}
        onResizeSplit={onResize}
      />
    )
  }

  function handleResize(index: number, deltaPercent: number) {
    if (node.type !== "split") return
    const sizes = [...node.sizes]
    const a = sizes[index], b = sizes[index + 1]
    let newA = a + deltaPercent
    let newB = b - deltaPercent
    if (newA < MIN_PANE_PERCENT) { newB -= MIN_PANE_PERCENT - newA; newA = MIN_PANE_PERCENT }
    if (newB < MIN_PANE_PERCENT) { newA -= MIN_PANE_PERCENT - newB; newB = MIN_PANE_PERCENT }
    sizes[index] = newA
    sizes[index + 1] = newB
    onResize(node.id, sizes)
  }

  return (
    <div ref={containerRef} className={`flex ${node.direction === "row" ? "flex-row" : "flex-col"} h-full min-h-0 w-full min-w-0 gap-1 overflow-hidden`}>
      {node.children.map((child, i) => (
        <div key={child.id} className="contents">
          <div
            style={{ flexBasis: `${node.sizes[i]}%`, flexGrow: 0, flexShrink: 0 }}
            className="min-h-0 min-w-0 h-full"
          >
            <PaneLayoutView
              node={child}
              objects={objects}
              focusedPaneId={focusedPaneId}
              onFocus={onFocus}
              onActivateTab={onActivateTab}
              onCloseTab={onCloseTab}
              onSplit={onSplit}
              onSplitAtEdge={onSplitAtEdge}
              onDropTab={onDropTab}
              onResize={onResize}
            />
          </div>
          {i < node.children.length - 1 && (
            <ResizeHandle direction={node.direction} onResize={delta => handleResize(i, delta)} containerRef={containerRef} />
          )}
        </div>
      ))}
    </div>
  )
}
