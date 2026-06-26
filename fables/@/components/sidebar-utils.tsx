import type { userInfo } from "../types/userInfo"

export type SidebarObject = userInfo.Objects & { children: SidebarObject[] }

// ── Drop indicator position ───────────────────────────────────────────────────
// "before" | "after" = insert sibling, "inside" = move into folder
export type DropPosition = "before" | "after" | "inside"

export interface DropTarget {
  id: string
  position: DropPosition
}

export function sortByPosition(a: userInfo.Objects, b: userInfo.Objects) {
  return (a.position ?? 0) - (b.position ?? 0)
}

function getItemData(item: userInfo.Objects): any {
  if (!item.data) return {}
  try { return typeof item.data === "string" ? JSON.parse(item.data) : item.data } catch { return {} }
}

export function isPinned(item: userInfo.Objects): boolean {
  return getItemData(item)?.pinned === true
}

function sortPinnedFirst(a: SidebarObject, b: SidebarObject) {
  const aPinned = isPinned(a) ? 0 : 1
  const bPinned = isPinned(b) ? 0 : 1
  if (aPinned !== bPinned) return aPinned - bPinned
  return sortByPosition(a, b)
}

export function buildObjectTree(items: userInfo.Objects[]) {
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
    list.sort(sortPinnedFirst)
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

/**
 * Moves an item to root (parent_id = null), appended after existing root items.
 */
export function moveToRoot(
  prevItems: userInfo.Objects[],
  draggedId: string
): userInfo.Objects[] {
  const dragged = prevItems.find((item) => item.id === draggedId)
  if (!dragged || dragged.parent_id === null || dragged.parent_id === undefined) return prevItems

  const rootItems = prevItems
    .filter((item) => !item.parent_id && item.id !== draggedId)
    .sort(sortByPosition)

  const newPosition = rootItems.length

  return prevItems.map((item) =>
    item.id === draggedId ? { ...item, parent_id: null, position: newPosition } : item
  )
}

/**
 * Applies a drop: inserts dragged item before/after target, or inside a folder.
 * Returns same array reference if the drop is invalid.
 */
export function applyDrop(
  prevItems: userInfo.Objects[],
  draggedId: string,
  drop: DropTarget
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

  // ── Inside: move into folder ──────────────────────────────────────────────
  if (drop.position === "inside") {
    if (target.type !== "folder") return prevItems
    if (isNoNesting(dragged)) return prevItems

    const siblings = prevItems
      .filter((item) => item.parent_id === target.id && item.id !== draggedId)
      .sort(sortByPosition)

    return prevItems.map((item) =>
      item.id === draggedId
        ? { ...item, parent_id: target.id, position: siblings.length }
        : item
    )
  }

  // ── Before / After: insert into target's parent at the right index ─────────
  const newParentId = target.parent_id ?? null

  // No-nesting folders must stay at root
  if (isNoNesting(dragged) && newParentId !== null) return prevItems

  const siblings = prevItems
    .filter((item) => (item.parent_id ?? null) === newParentId && item.id !== draggedId)
    .sort(sortByPosition)

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
      return { ...item, parent_id: newParentId, position: positionMap.get(item.id) ?? 0 }
    }
    if (positionMap.has(item.id)) {
      return { ...item, position: positionMap.get(item.id)! }
    }
    return item
  })
}