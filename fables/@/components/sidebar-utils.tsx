import type { userInfo } from "../types/userInfo"

export type SidebarObject = userInfo.Objects & { children: SidebarObject[] }

export function sortByPosition(a: userInfo.Objects, b: userInfo.Objects) {
  return (a.position ?? 0) - (b.position ?? 0)
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
    list.sort((a, b) => sortByPosition(a, b))
    list.forEach((item) => sortRecursive(item.children))
  }

  sortRecursive(roots)
  return roots
}

export function extractFolderColor(node: userInfo.Objects): string | null {
  if (!node.data) return null
  try {
    const d: any = typeof node.data === "string" ? JSON.parse(node.data) : node.data
    if (d && d.color) {
      let color = String(d.color).trim()
      if (/^[0-9A-Fa-f]{3}$/.test(color) || /^[0-9A-Fa-f]{6}$/.test(color)) {
        color = `#${color}`
      }
      return color
    }
  } catch (e) {
    // ignore parse errors
  }
  return null
}

/**
 * Returns true if `ancestorId` is the same as `nodeId` or any ancestor of it.
 * Prevents dropping a folder into itself or any of its own descendants.
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
 * Reorders sidebar items with support for:
 * - Reordering within the same parent (original behaviour)
 * - Dropping onto a folder → moves dragged item into that folder as last child
 *
 * Returns the same array reference if nothing changed.
 */
export function reorderSidebarItems(
  prevItems: userInfo.Objects[],
  draggedId: string,
  targetId: string
): userInfo.Objects[] {
  const dragged = prevItems.find((item) => item.id === draggedId)
  const target = prevItems.find((item) => item.id === targetId)
  if (!dragged || !target) return prevItems

  // ── Guard: never drop an item into itself or its own descendants ────────────
  if (isDescendantOrSelf(prevItems, targetId, draggedId)) return prevItems

  // ── Case 1: dropped onto a folder → move into that folder ──────────────────
  if (target.type === "folder") {
    const newParentId = target.id

    // Siblings already inside the target folder (excluding dragged item)
    const siblings = prevItems
      .filter((item) => item.parent_id === newParentId && item.id !== draggedId)
      .sort(sortByPosition)

    const newPosition = siblings.length // append at end

    return prevItems.map((item) =>
      item.id === draggedId
        ? { ...item, parent_id: newParentId, position: newPosition }
        : item
    )
  }

  // ── Case 2: dropped onto a non-folder → reorder within same parent ─────────
  if (dragged.parent_id !== target.parent_id) return prevItems // cross-level non-folder drops are ignored

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
}