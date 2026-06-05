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
      // If color looks like a hex string without '#', add it.
      if (/^[0-9A-Fa-f]{3}$/.test(color) || /^[0-9A-Fa-f]{6}$/.test(color)) {
        color = `#${color}`
      }
      // Normalize shorthand 3-char hex to 6-char? leave as-is — browsers support 3-char hex
      return color
    }
  } catch (e) {
    // ignore parse errors
  }
  return null
}

// Reorder items within same parent, returns new items with updated positions
export function reorderWithinParent(
  prevItems: userInfo.Objects[],
  draggedId: string,
  targetId: string
): userInfo.Objects[] {
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
}
