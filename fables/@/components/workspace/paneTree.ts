// ════════════════════════════════════════════════════════════════════════════
// paneTree.ts — the layout tree behind the VS Code-style split workspace in
// Dashboard.tsx. A LayoutNode is either a Leaf (one pane: a tab strip of open
// object ids + which one is active) or a Split (two children laid out in a
// row or column, with resizable percentage sizes).
//
// Tabs only ever store object *ids* — the actual SidebarObject is resolved
// live from UserContext's `objects` array wherever it's rendered, same as
// Dashboard's old single-`selectedObject` model did, so edits made in one
// pane are never stale in another.
//
// All operations here are pure (tree in, tree out) so the hook that owns the
// state (useWorkspace.ts) can stay a thin useState wrapper.
// ════════════════════════════════════════════════════════════════════════════

import { nanoid } from "../character-utils"

export interface LeafNode {
  type: "leaf"
  id: string
  tabs: string[]
  activeId: string | null
}

export interface SplitNode {
  type: "split"
  id: string
  direction: "row" | "column"
  children: LayoutNode[]
  sizes: number[] // percentages, parallel to children, sums to 100
}

export type LayoutNode = LeafNode | SplitNode
export type Edge = "left" | "right" | "top" | "bottom" | "center"

export function createLeaf(tabs: string[] = [], activeId: string | null = null): LeafNode {
  return { type: "leaf", id: nanoid(), tabs, activeId: activeId ?? tabs[tabs.length - 1] ?? null }
}

export function firstLeafId(node: LayoutNode): string {
  return node.type === "leaf" ? node.id : firstLeafId(node.children[0])
}

export function findLeaf(node: LayoutNode, paneId: string): LeafNode | null {
  if (node.type === "leaf") return node.id === paneId ? node : null
  for (const c of node.children) {
    const found = findLeaf(c, paneId)
    if (found) return found
  }
  return null
}

export function findLeafContaining(node: LayoutNode, objectId: string): LeafNode | null {
  if (node.type === "leaf") return node.tabs.includes(objectId) ? node : null
  for (const c of node.children) {
    const found = findLeafContaining(c, objectId)
    if (found) return found
  }
  return null
}

export function allLeaves(node: LayoutNode): LeafNode[] {
  return node.type === "leaf" ? [node] : node.children.flatMap(allLeaves)
}

function mapLeaf(node: LayoutNode, paneId: string, fn: (leaf: LeafNode) => LeafNode): LayoutNode {
  if (node.type === "leaf") return node.id === paneId ? fn(node) : node
  return { ...node, children: node.children.map(c => mapLeaf(c, paneId, fn)) }
}

function addTab(leaf: LeafNode, objectId: string): LeafNode {
  const tabs = leaf.tabs.includes(objectId) ? leaf.tabs : [...leaf.tabs, objectId]
  return { ...leaf, tabs, activeId: objectId }
}

// Opens objectId into paneId — focuses the existing tab if it's already open
// there, otherwise appends a new one.
export function openTab(tree: LayoutNode, paneId: string, objectId: string): LayoutNode {
  return mapLeaf(tree, paneId, leaf => addTab(leaf, objectId))
}

export function setActiveTab(tree: LayoutNode, paneId: string, objectId: string): LayoutNode {
  return mapLeaf(tree, paneId, leaf => ({ ...leaf, activeId: objectId }))
}

// Removing a tab can empty its pane. An emptied pane collapses out of its
// parent split (its sibling takes the freed space) — unless it's the only
// pane left in the whole tree, in which case it just sits there empty so
// there's always somewhere for the next opened tab to land.
export function closeTab(tree: LayoutNode, paneId: string, objectId: string): LayoutNode {
  function recur(node: LayoutNode): LayoutNode | null {
    if (node.type === "leaf") {
      if (node.id !== paneId) return node
      const tabs = node.tabs.filter(id => id !== objectId)
      const activeId = node.activeId === objectId ? (tabs[tabs.length - 1] ?? null) : node.activeId
      return { ...node, tabs, activeId }
    }
    const nextChildren: LayoutNode[] = []
    const nextSizes: number[] = []
    node.children.forEach((child, i) => {
      const result = recur(child)
      if (!result) return
      if (result.type === "leaf" && result.tabs.length === 0) return // collapse empty pane
      nextChildren.push(result)
      nextSizes.push(node.sizes[i])
    })
    if (nextChildren.length === 0) return null
    if (nextChildren.length === 1) return nextChildren[0]
    const total = nextSizes.reduce((a, b) => a + b, 0) || 1
    return { ...node, children: nextChildren, sizes: nextSizes.map(s => (s / total) * 100) }
  }
  return recur(tree) ?? tree
}

// Duplicates objectId into a brand new sibling pane next to paneId — used by
// the explicit "Split Right"/"Split Down" buttons (no drag gesture needed).
// Returns the new pane's id too, so the caller can focus it.
export function splitPane(tree: LayoutNode, paneId: string, direction: "row" | "column", objectId: string): { tree: LayoutNode; newPaneId: string } {
  const newLeaf = createLeaf([objectId])
  function recur(node: LayoutNode): LayoutNode {
    if (node.type === "leaf") {
      if (node.id !== paneId) return node
      return { type: "split", id: nanoid(), direction, children: [node, newLeaf], sizes: [50, 50] }
    }
    return { ...node, children: node.children.map(recur) }
  }
  return { tree: recur(tree), newPaneId: newLeaf.id }
}

// Splits paneId along one of its own outer edges, independent of whatever
// splits already exist elsewhere in the tree — used by the edge-drag handles
// on every pane (see PaneView.tsx) so you can always grab a pane's own
// top/bottom/left/right edge and set its size, whether or not anything is
// already split next to it. Returns the new split's id too, so the caller
// can immediately drive a live resize from the same pointer-down that
// triggered the split (see useWorkspace.ts's splitAtEdge).
export function splitPaneAtEdge(tree: LayoutNode, paneId: string, edge: Exclude<Edge, "center">, objectId: string): { tree: LayoutNode; newPaneId: string; splitId: string } {
  const direction: "row" | "column" = edge === "left" || edge === "right" ? "row" : "column"
  const newLeaf = createLeaf([objectId])
  const splitId = nanoid()
  function recur(node: LayoutNode): LayoutNode {
    if (node.type === "leaf") {
      if (node.id !== paneId) return node
      const children = edge === "left" || edge === "top" ? [newLeaf, node] : [node, newLeaf]
      return { type: "split", id: splitId, direction, children, sizes: [50, 50] }
    }
    return { ...node, children: node.children.map(recur) }
  }
  return { tree: recur(tree), newPaneId: newLeaf.id, splitId }
}

// Drag-and-drop: move objectId out of fromPaneId and into targetPaneId. A
// "center" drop just merges it into the target's tab strip; an edge drop
// splits the target pane and places the tab in the new half. Works even
// when fromPaneId === targetPaneId (dragging a pane's only tab onto its own
// edge self-splits it), since closeTab leaves a same-id empty leaf behind
// for the edge case to then wrap. Returns the pane id the tab ended up in,
// so the caller can focus it.
export function moveTab(tree: LayoutNode, objectId: string, fromPaneId: string, targetPaneId: string, edge: Edge): { tree: LayoutNode; focusPaneId: string } {
  const withoutSource = closeTab(tree, fromPaneId, objectId)

  if (edge === "center") {
    return { tree: mapLeaf(withoutSource, targetPaneId, leaf => addTab(leaf, objectId)), focusPaneId: targetPaneId }
  }

  const direction: "row" | "column" = edge === "left" || edge === "right" ? "row" : "column"
  const newLeaf = createLeaf([objectId])
  function recur(node: LayoutNode): LayoutNode {
    if (node.type === "leaf") {
      if (node.id !== targetPaneId) return node
      const children = edge === "left" || edge === "top" ? [newLeaf, node] : [node, newLeaf]
      return { type: "split", id: nanoid(), direction, children, sizes: [50, 50] }
    }
    return { ...node, children: node.children.map(recur) }
  }
  return { tree: recur(withoutSource), focusPaneId: newLeaf.id }
}

export function setSplitSizes(tree: LayoutNode, splitId: string, sizes: number[]): LayoutNode {
  if (tree.type === "leaf") return tree
  if (tree.id === splitId) return { ...tree, sizes }
  return { ...tree, children: tree.children.map(c => setSplitSizes(c, splitId, sizes)) }
}

// Drops any tab whose object id no longer exists (deleted elsewhere) —
// run once objects have loaded, so stale ids left over from a previous
// session don't linger as dead tabs.
export function pruneMissing(tree: LayoutNode, existingIds: Set<string>): LayoutNode {
  function recur(node: LayoutNode): LayoutNode | null {
    if (node.type === "leaf") {
      const tabs = node.tabs.filter(id => existingIds.has(id))
      if (tabs.length === node.tabs.length) return node
      const activeId = node.activeId && tabs.includes(node.activeId) ? node.activeId : (tabs[tabs.length - 1] ?? null)
      return { ...node, tabs, activeId }
    }
    const nextChildren: LayoutNode[] = []
    const nextSizes: number[] = []
    node.children.forEach((child, i) => {
      const result = recur(child)
      if (!result) return
      if (result.type === "leaf" && result.tabs.length === 0) return
      nextChildren.push(result)
      nextSizes.push(node.sizes[i])
    })
    if (nextChildren.length === 0) return null
    if (nextChildren.length === 1) return nextChildren[0]
    const total = nextSizes.reduce((a, b) => a + b, 0) || 1
    return { ...node, children: nextChildren, sizes: nextSizes.map(s => (s / total) * 100) }
  }
  return recur(tree) ?? createLeaf()
}
