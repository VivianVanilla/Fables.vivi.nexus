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
// This is deliberately a separate mechanism from each row's own pre-existing
// native `draggable`/`onDragStart` (used for drag-to-Favorites and, for
// generic items, drag-to-container) — native HTML5 drag doesn't work on
// touch in an Android WebView at all, which is why that existing behavior
// needed a button fallback for containers in the first place. dnd-kit's
// PointerSensor drives this one through Pointer Events instead, which is
// what actually makes reordering work on the phone.

import { useSensor, useSensors, PointerSensor } from "@dnd-kit/core"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

export function useDragSensors() {
  return useSensors(useSensor(PointerSensor, { activationConstraint: { delay: 250, tolerance: 8 } }))
}

export function SortableItem({ id, disabled, children }: { id: string; disabled?: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled })

  if (disabled) return <>{children}</>

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}
      className="cursor-grab active:cursor-grabbing"
    >
      {children}
    </div>
  )
}
