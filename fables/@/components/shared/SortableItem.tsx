// Shared drag-reorder wrapper for FeatureList, ContainerItemsList, and
// SpellsEquipPanel's Martial/Spells lists — press-and-hold anywhere on the
// row (not a dedicated side handle) to pick it up, on both mouse and touch.
// A quick tap/click still reaches the row's own onClick (expand, edit,
// buttons) untouched: dnd-kit's PointerSensor only takes over once the
// activation delay elapses, so a plain click resolves before that and is
// never intercepted; moving before the delay elapses cancels the pending
// drag instead of starting one, which is also what keeps an ordinary
// scroll-swipe from being mistaken for a drag.
//
// This — and DropZone below — is what replaced generic items' native
// drag-to-container (InfoTab.tsx's ContainerItemsList) with dnd-kit.
// Native HTML5 drag doesn't work on touch in an Android WebView at all,
// which is why drag-to-container needed a button fallback in the first
// place, and why it silently stopped working *at all* (even on desktop)
// once this same delay-based PointerSensor started listening on the same
// rows for reordering — dnd-kit's activation timer competes with the
// browser's own native-drag arming for the same pointer gesture, and
// reliably loses on Chromium. dnd-kit drives container drops through
// Pointer Events instead, which is what actually makes dropping onto
// something work on the phone too, not just the desktop mouse.
//
// Drag-to-Favorites (FeatureEntry.tsx/SpellEntry.tsx's own `dragAttrs`,
// consumed by FavoritesPanel.tsx's onDragOver/onDrop) still uses the old
// native mechanism, deliberately not migrated here yet — doing that needs
// one shared DndContext lifted above SpellsEquipPanel/FavoritesPanel
// (currently two separate components each with their own local
// DndContext), a bigger structural change than this pass. It very likely
// has the same silent-conflict problem as drag-to-container did, on any
// row that's also SortableItem-reorderable (Spells/Martial) — flagging
// rather than leaving unmentioned.

import { useSensor, useSensors, PointerSensor, useDroppable } from "@dnd-kit/core"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

export function useDragSensors() {
  return useSensors(useSensor(PointerSensor, { activationConstraint: { delay: 250, tolerance: 8 } }))
}

// The row stays in its list slot while dragging (as a faint placeholder) —
// it does NOT visually follow the pointer itself. The thing that actually
// tracks your finger/cursor 1:1, with no easing lag and unclipped by any
// scrolling parent, is the DragOverlayCard below, rendered by each
// DndContext owner inside a <DragOverlay> keyed to whichever id is
// currently being dragged. Without that overlay, a plain in-place transform
// can look laggy or "stuck" — see DragOverlayCard's own comment.
export function SortableItem({ id, disabled, children }: { id: string; disabled?: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled })

  if (disabled) return <>{children}</>

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}
      className="cursor-grab active:cursor-grabbing"
    >
      {children}
    </div>
  )
}

// The floating "picked up" clone shown inside a <DragOverlay> — dnd-kit
// portals this straight to <body> and re-renders it at the pointer's
// position on every move, so it tracks your finger/cursor exactly, escapes
// any `overflow: hidden`/scrolling ancestor the row's real slot sits inside,
// and never has a CSS transition fighting the pointer for position. That's
// what actually makes a drag "go along with you" — the in-place
// SortableItem above intentionally does NOT try to do this itself.
export function DragOverlayCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        scale: 1.04,
        cursor: "grabbing",
        zIndex: 9999,
        boxShadow: "0 20px 40px -10px rgba(0,0,0,0.6), 0 8px 18px -4px rgba(0,0,0,0.4)",
      }}
    >
      {children}
    </div>
  )
}

// A drop target that isn't itself a reorderable sibling slot — a container
// to file an item into (InfoTab.tsx's ContainerItemsList) or the Favorites
// panel (CharacterSheet.tsx/FavoritesPanel.tsx) to favorite something onto.
// Lives under the same DndContext as any SortableItem/SortableContext
// around it — dnd-kit resolves `over` to whichever registered id (sortable
// or plain droppable) is geometrically closest, so the two mix freely.
export function DropZone({ id, disabled, className = "", children }: { id: string; disabled?: boolean; className?: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled })
  return (
    <div ref={setNodeRef} className={`${className} ${isOver && !disabled ? "ring-1 ring-primary/50 bg-primary/5 rounded-xl" : ""}`}>
      {children}
    </div>
  )
}
