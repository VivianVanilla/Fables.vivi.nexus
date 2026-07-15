// ════════════════════════════════════════════════════════════════════════════
// useWorkspace.ts — owns the split-pane layout tree for Dashboard.tsx. Only
// ids are persisted (localStorage) since the actual objects always come live
// from UserContext — the same "never trust a stale snapshot" rule the old
// single-`selectedObject` model already followed.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react"
import type { SidebarObject } from "@/components/sidebar-utils"
import {
  type LayoutNode, type Edge,
  createLeaf, firstLeafId, findLeaf, findLeafContaining,
  openTab, setActiveTab, closeTab, splitPane, splitPaneAtEdge, moveTab, setSplitSizes, pruneMissing,
} from "./paneTree"

const STORAGE_KEY = "fables-workspace-layout"

function loadInitialTree(): LayoutNode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as LayoutNode
  } catch { /* ignore */ }
  return createLeaf()
}

export function useWorkspace(objects: SidebarObject[]) {
  const [tree, setTree] = useState<LayoutNode>(loadInitialTree)
  // Reads the same `tree` value resolved just above (not a second, separate
  // loadInitialTree() call) — otherwise a cold start with no saved layout
  // would mint two different random leaf ids that don't match each other.
  const [focusedPaneId, setFocusedPaneId] = useState<string>(() => firstLeafId(tree))
  const prunedRef = useRef(false)

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tree)) } catch { /* ignore */ }
  }, [tree])

  // Drop tabs pointing at ids that no longer exist (deleted in a previous
  // session) once objects have actually loaded — only ever runs once.
  useEffect(() => {
    if (prunedRef.current || objects.length === 0) return
    prunedRef.current = true
    setTree(prev => pruneMissing(prev, new Set(objects.map(o => o.id))))
  }, [objects])

  // If the focused pane got collapsed away (its last tab closed), fall back
  // to whatever pane is now first in the tree — derived at render time
  // rather than corrected via an effect, so there's no extra render pass.
  const effectiveFocusedPaneId = findLeaf(tree, focusedPaneId) ? focusedPaneId : firstLeafId(tree)

  function openObject(objectId: string) {
    const existing = findLeafContaining(tree, objectId)
    if (existing) {
      setFocusedPaneId(existing.id)
      setTree(setActiveTab(tree, existing.id, objectId))
      return
    }
    setTree(openTab(tree, effectiveFocusedPaneId, objectId))
  }

  function activateTab(paneId: string, objectId: string) {
    setFocusedPaneId(paneId)
    setTree(setActiveTab(tree, paneId, objectId))
  }

  function closeObjectTab(paneId: string, objectId: string) {
    setTree(closeTab(tree, paneId, objectId))
  }

  function split(paneId: string, direction: "row" | "column") {
    const leaf = findLeaf(tree, paneId)
    if (!leaf?.activeId) return
    const { tree: next, newPaneId } = splitPane(tree, paneId, direction, leaf.activeId)
    setTree(next)
    setFocusedPaneId(newPaneId)
  }

  // Splits paneId along its own outer edge, regardless of whatever's already
  // split next to it — used by the edge-drag handles (PaneView.tsx) so a
  // pane's top/bottom/left/right edge is always grabbable. Returns the new
  // split's id synchronously so the caller can immediately drive a live
  // resize from the same pointer-down that triggered the split.
  function splitAtEdge(paneId: string, edge: Exclude<Edge, "center">): string | null {
    const leaf = findLeaf(tree, paneId)
    if (!leaf?.activeId) return null
    const { tree: next, newPaneId, splitId } = splitPaneAtEdge(tree, paneId, edge, leaf.activeId)
    setTree(next)
    setFocusedPaneId(newPaneId)
    return splitId
  }

  function dropTab(targetPaneId: string, objectId: string, fromPaneId: string, edge: Edge) {
    if (fromPaneId === targetPaneId && edge === "center") return
    const { tree: next, focusPaneId } = moveTab(tree, objectId, fromPaneId, targetPaneId, edge)
    setTree(next)
    setFocusedPaneId(focusPaneId)
  }

  function resize(splitId: string, sizes: number[]) {
    setTree(setSplitSizes(tree, splitId, sizes))
  }

  return { tree, focusedPaneId: effectiveFocusedPaneId, setFocusedPaneId, openObject, activateTab, closeObjectTab, split, splitAtEdge, dropTab, resize }
}
