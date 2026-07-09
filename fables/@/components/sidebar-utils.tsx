import type { userInfo } from "../types/userInfo"

export type SidebarObject = userInfo.Objects & { children: SidebarObject[] }

// ── Drop indicator position ───────────────────────────────────────────────────
// "before" | "after" = insert sibling, "inside" = move into folder
export type DropPosition = "before" | "after" | "inside"

export interface DropTarget {
  id: string
  position: DropPosition
}

function getItemData(item: userInfo.Objects): any {
  if (!item.data) return {}
  try { return typeof item.data === "string" ? JSON.parse(item.data) : item.data } catch { return {} }
}

// A note someone else shared with you carries *their* `position` column —
// meaningful in their tree, not yours, and free to collide with your own
// numbering (each owner numbers their own items from 0). Reordering it in
// your own sidebar can't write to a row you don't own either, so your
// reorder is stored as a per-viewer override inside the note's own
// `data.viewerPositions[viewerId]` (a collaborator is still allowed to patch
// `data` under RLS) instead of the real `position` column. Until you've
// dragged it at least once, a foreign-owned item ALWAYS falls back to the
// end of your list (never the owner's raw column) — the query that fetches
// shared notes orders them by created_date, so untouched ones stay stably
// sorted amongst themselves instead of jumping around based on whatever
// number the owner happens to have. `viewerId` is who's currently looking —
// omit it to just use the raw column (unauthenticated/owner-only contexts).
export function effectivePosition(item: userInfo.Objects, viewerId?: string): number {
  if (viewerId && item.owner_id !== viewerId) {
    const override = getItemData(item)?.viewerPositions?.[viewerId]
    return typeof override === "number" ? override : Number.MAX_SAFE_INTEGER
  }
  return item.position ?? 0
}

export function sortByPosition(a: userInfo.Objects, b: userInfo.Objects, viewerId?: string) {
  return effectivePosition(a, viewerId) - effectivePosition(b, viewerId)
}

export function isPinned(item: userInfo.Objects): boolean {
  return getItemData(item)?.pinned === true
}

function sortPinnedFirst(a: SidebarObject, b: SidebarObject, viewerId?: string) {
  const aPinned = isPinned(a) ? 0 : 1
  const bPinned = isPinned(b) ? 0 : 1
  if (aPinned !== bPinned) return aPinned - bPinned
  return sortByPosition(a, b, viewerId)
}

export function buildObjectTree(items: userInfo.Objects[], viewerId?: string) {
  const map = new Map<string, SidebarObject>()
  const nodes: SidebarObject[] = items.map((item) => ({ ...item, children: [] }))

  nodes.forEach((node) => map.set(node.id, node))
  nodes.sort((a, b) => sortByPosition(a, b, viewerId))

  const roots: SidebarObject[] = []

  nodes.forEach((node) => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  })

  function sortRecursive(list: SidebarObject[]) {
    list.sort((a, b) => sortPinnedFirst(a, b, viewerId))
    list.forEach((item) => sortRecursive(item.children))
  }

  sortRecursive(roots)
  return roots
}

/**
 * Returns true if the item has data.noNesting = true.
 */
export function isNoNesting(item: userInfo.Objects): boolean {
  if (!item.data) return false
  try {
    const d: any = typeof item.data === "string" ? JSON.parse(item.data) : item.data
    return d?.noNesting === true
  } catch {
    return false
  }
}

/**
 * Returns true if `ancestorId` is the same as `nodeId` or any ancestor of it.
 */
function isDescendantOrSelf(
  items: userInfo.Objects[],
  nodeId: string,
  ancestorId: string
): boolean {
  if (nodeId === ancestorId) return true
  const node = items.find((item) => item.id === nodeId)
  if (!node || !node.parent_id) return false
  return isDescendantOrSelf(items, node.parent_id, ancestorId)
}

// Builds the updated item for a dragged node landing at `position` — writes
// the real `position` column for something the viewer owns, or a per-viewer
// override (see effectivePosition) for a note someone else shared with them.
function withPosition(item: userInfo.Objects, position: number, viewerId: string | undefined, parentId?: string | null): userInfo.Objects {
  if (viewerId && item.owner_id !== viewerId) {
    const data = getItemData(item)
    return { ...item, data: { ...data, viewerPositions: { ...(data.viewerPositions ?? {}), [viewerId]: position } } }
  }
  return { ...item, position, ...(parentId !== undefined ? { parent_id: parentId } : {}) }
}

/**
 * Moves an item to root (parent_id = null), appended after existing root items.
 */
export function moveToRoot(
  prevItems: userInfo.Objects[],
  draggedId: string,
  viewerId?: string
): userInfo.Objects[] {
  const dragged = prevItems.find((item) => item.id === draggedId)
  if (!dragged || dragged.parent_id === null || dragged.parent_id === undefined) return prevItems

  const rootItems = prevItems
    .filter((item) => !item.parent_id && item.id !== draggedId)
    .sort((a, b) => sortByPosition(a, b, viewerId))

  const newPosition = rootItems.length

  return prevItems.map((item) =>
    item.id === draggedId ? withPosition(item, newPosition, viewerId, null) : item
  )
}

/**
 * Applies a drop: inserts dragged item before/after target, or inside a folder.
 * Returns same array reference if the drop is invalid.
 */
export function applyDrop(
  prevItems: userInfo.Objects[],
  draggedId: string,
  drop: DropTarget,
  viewerId?: string
): userInfo.Objects[] {
  const dragged = prevItems.find((item) => item.id === draggedId)
  const target = prevItems.find((item) => item.id === drop.id)
  if (!dragged || !target || draggedId === drop.id) return prevItems

  // Guard: no dropping into own descendants
  if (isDescendantOrSelf(prevItems, drop.id, draggedId)) return prevItems

  // Guard: no-nesting folders can't go inside other folders
  if (isNoNesting(dragged) && (drop.position === "inside")) {
    if (drop.position === "inside") return prevItems
  }

  // A shared-with-you note isn't really "inside" any folder in your own
  // tree (you don't have the owner's folder) — dropping it "inside" a
  // folder of yours would require reparenting a row you don't own, which
  // isn't supported. Reordering among your root-level siblings still is.
  const draggedIsForeign = !!viewerId && dragged.owner_id !== viewerId
  if (draggedIsForeign && drop.position === "inside") return prevItems

  // ── Inside: move into folder ──────────────────────────────────────────────
  if (drop.position === "inside") {
    if (target.type !== "folder") return prevItems
    if (isNoNesting(dragged)) return prevItems

    const siblings = prevItems
      .filter((item) => item.parent_id === target.id && item.id !== draggedId)
      .sort((a, b) => sortByPosition(a, b, viewerId))

    return prevItems.map((item) =>
      item.id === draggedId ? withPosition(item, siblings.length, viewerId, target.id) : item
    )
  }

  // ── Before / After: insert into target's parent at the right index ─────────
  const newParentId = target.parent_id ?? null

  // No-nesting folders must stay at root
  if (isNoNesting(dragged) && newParentId !== null) return prevItems

  const siblings = prevItems
    .filter((item) => (item.parent_id ?? null) === newParentId && item.id !== draggedId)
    .sort((a, b) => sortByPosition(a, b, viewerId))

  const targetIndex = siblings.findIndex((item) => item.id === target.id)
  if (targetIndex === -1) return prevItems

  const insertAt = drop.position === "before" ? targetIndex : targetIndex + 1

  const newOrder = [...siblings]
  newOrder.splice(insertAt, 0, dragged)

  // Build a map of new positions for siblings + dragged
  const positionMap = new Map<string, number>()
  newOrder.forEach((item, i) => positionMap.set(item.id, i))

  return prevItems.map((item) => {
    if (item.id === draggedId) {
      return withPosition(item, positionMap.get(item.id) ?? 0, viewerId, newParentId)
    }
    if (positionMap.has(item.id)) {
      // Reindexed as a side effect of the drop — same viewer-vs-owner split
      // as the dragged item itself (a sibling can just as easily be a
      // shared note whose position shifted purely because something else
      // moved past it).
      return withPosition(item, positionMap.get(item.id)!, viewerId)
    }
    return item
  })
}
