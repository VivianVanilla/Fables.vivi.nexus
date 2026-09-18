

import { GripVertical } from "lucide-react"
import { useSensor, useSensors, PointerSensor, useDroppable } from "@dnd-kit/core"
import type { PointerEvent as ReactPointerEvent } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"


function isTextEditTarget(target: EventTarget | null): boolean {
  let el = target as HTMLElement | null
  while (el) {
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable) return true
    el = el.parentElement
  }
  return false
}

class RowPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      handler: ({ nativeEvent }: ReactPointerEvent) => !isTextEditTarget(nativeEvent.target),
    },
  ]
}

export function useDragSensors() {
  return useSensors(useSensor(RowPointerSensor, { activationConstraint: { delay: 250, tolerance: 8 } }))
}


export function SortableItem({ id, disabled, children }: { id: string; disabled?: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled })

  if (disabled) return <>{children}</>

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
        // `pan-y`, NOT `none`: the row still has to be scrollable past with a
        // vertical swipe — see the file header on why `none` isn't an option
        // here, and why that's what the touch-only handle below is for.
        touchAction: "pan-y",
        WebkitTouchCallout: "none",
      }}
      className="relative cursor-grab active:cursor-grabbing select-none"
    >
      {children}
      {/* Touch-only second pickup point — see file header. An overlay INSIDE
          the card's own corner rather than a separate column beside it, so
          it doesn't add width to every row or push card content over —
          `absolute`, not part of layout flow, on top of whatever's under it
          (the dark chip background keeps it legible regardless). `hidden`
          by default, switched to `flex` under `pointer: coarse` (the
          device's PRIMARY pointer is touch, i.e. a phone/tablet — never a
          mouse, so this stays invisible on desktop even with a touchscreen
          monitor attached). Its own onPointerDown stops the event from also
          bubbling to the row's identical listener above — without that, a
          touch starting on the handle would fire dnd-kit's activation logic
          twice for the same gesture. */}
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        onPointerDown={e => { e.stopPropagation(); listeners?.onPointerDown?.(e) }}
        aria-label="Drag to reorder"
        style={{ touchAction: "none", WebkitTouchCallout: "none" }}
        className="hidden pointer-coarse:flex absolute pr-1  left-0.5 top-2 z-10 items-center justify-center size-5 text-white/40 active:text-white cursor-grab active:cursor-grabbing select-none transition-colors"
      >
        <GripVertical className="size-4.5" />
      </button>
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
