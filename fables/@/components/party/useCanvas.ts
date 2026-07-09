// ════════════════════════════════════════════════════════════════════════════
// useCanvas.ts — data layer for the note web (both the party-shared board and
// the personal "Note Web"). A "board" is scoped by either a party code or a
// personal owner id — see BoardKey. Note-kind nodes are LIVE references
// (ref_object_id) to a real note in `objects`, not copied content: the note
// stays owned by whoever linked it in, edits to it are only ever written by
// its owner, and every board viewing that node reads the same live content.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react"
import { supabase } from "../../../src/supabase"
import { safeParseJson } from "../character-utils"
import { useChannelSuffix } from "./partyTypes"

export type BoardKey = { mode: "party"; partyCode: string } | { mode: "personal"; ownerId: string }

export function boardKeyString(key: BoardKey) {
  return key.mode === "party" ? `party:${key.partyCode}` : `personal:${key.ownerId}`
}

export interface CanvasNode {
  id: string
  party_code: string | null
  board_owner_id: string | null
  owner_id: string
  kind: "note" | "image"
  title: string
  content: string | null      // legacy snapshot field — only still meaningful for pre-migration rows
  image_url: string | null
  ref_object_id: string | null // note-kind: the live-linked note in `objects`
  x: number
  y: number
  created_at: string
}

export interface CanvasEdge {
  id: string
  from_node_id: string
  to_node_id: string
}

export interface LinkedNote {
  name: string
  content: string
  data: Record<string, unknown>
}


export function useCanvas(key: BoardKey, currentUserId: string) {
  const [nodes, setNodes] = useState<CanvasNode[]>([])
  const [edges, setEdges] = useState<CanvasEdge[]>([])
  const [linkedNotes, setLinkedNotes] = useState<Record<string, LinkedNote>>({})
  const [loaded, setLoaded] = useState(false)
  const keyStr = boardKeyString(key)
  const suffix = useChannelSuffix()

  useEffect(() => {
    if (!currentUserId) return
    let cancelled = false
    setLoaded(false)
    const nodesQuery = key.mode === "party"
      ? supabase.from("canvas_nodes").select("*").eq("party_code", key.partyCode)
      : supabase.from("canvas_nodes").select("*").eq("board_owner_id", key.ownerId)
    const edgesQuery = key.mode === "party"
      ? supabase.from("canvas_edges").select("*").eq("party_code", key.partyCode)
      : supabase.from("canvas_edges").select("*").eq("board_owner_id", key.ownerId)
    Promise.all([nodesQuery, edgesQuery]).then(([n, e]) => {
      if (cancelled) return
      if (n.error) console.error("canvas nodes load error:", n.error)
      if (e.error) console.error("canvas edges load error:", e.error)
      if (n.data) setNodes(n.data as CanvasNode[])
      if (e.data) setEdges(e.data as CanvasEdge[])
      setLoaded(true)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyStr, currentUserId])

  useEffect(() => {
    if (!currentUserId) return
    const filter = key.mode === "party" ? `party_code=eq.${key.partyCode}` : `board_owner_id=eq.${key.ownerId}`
    const ch = supabase
      .channel(`canvas:${keyStr}:${currentUserId}:${suffix}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "canvas_nodes", filter },
        payload => { const row = payload.new as CanvasNode; setNodes(prev => prev.some(n => n.id === row.id) ? prev : [...prev, row]) })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "canvas_nodes", filter },
        payload => { const row = payload.new as CanvasNode; setNodes(prev => prev.map(n => n.id === row.id ? row : n)) })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "canvas_nodes", filter },
        payload => { const old = payload.old as Partial<CanvasNode>; if (old.id) setNodes(prev => prev.filter(n => n.id !== old.id)) })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "canvas_edges" },
        payload => { const row = payload.new as CanvasEdge; setEdges(prev => prev.some(e => e.id === row.id) ? prev : [...prev, row]) })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "canvas_edges" },
        payload => { const old = payload.old as Partial<CanvasEdge>; if (old.id) setEdges(prev => prev.filter(e => e.id !== old.id)) })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyStr, currentUserId, suffix])

  // ── Live-linked note content ──────────────────────────────────────────────
  const refIds = Array.from(new Set(nodes.filter(n => n.ref_object_id).map(n => n.ref_object_id as string))).sort().join(",")

  // Ids of linked notes that were requested but didn't come back — i.e. the
  // source note has been deleted. The board uses this to auto-unlink the
  // now-orphaned node instead of leaving a dead card behind.
  const [missingRefIds, setMissingRefIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!refIds) { setLinkedNotes({}); setMissingRefIds(new Set()); return }
    let cancelled = false
    const requested = refIds.split(",")
    supabase.from("objects").select("id,name,data").in("id", requested).then(({ data, error }) => {
      if (cancelled || error || !data) return
      const found = new Set((data as { id: string }[]).map(r => r.id))
      setLinkedNotes(prev => {
        const next = { ...prev }
        for (const row of data as { id: string; name: string; data: unknown }[]) {
          const d = safeParseJson(row.data) as { content?: string }
          next[row.id] = { name: row.name, content: d.content ?? "", data: d }
        }
        return next
      })
      setMissingRefIds(new Set(requested.filter(id => !found.has(id))))
    })
    return () => { cancelled = true }
  }, [refIds])

  useEffect(() => {
    if (!refIds) return
    const idSet = new Set(refIds.split(","))
    const ch = supabase
      .channel(`canvas-linked-notes:${keyStr}:${suffix}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "objects" }, payload => {
        const row = payload.new as { id: string; name: string; data: unknown }
        if (!idSet.has(row.id)) return
        const d = safeParseJson(row.data) as { content?: string }
        setLinkedNotes(prev => ({ ...prev, [row.id]: { name: row.name, content: d.content ?? "", data: d } }))
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "objects" }, payload => {
        const old = payload.old as { id?: string }
        if (!old.id || !idSet.has(old.id)) return
        setMissingRefIds(prev => new Set(prev).add(old.id as string))
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [refIds, keyStr, suffix])

  // Instant local update for the person actually editing — the realtime
  // UPDATE above still fires and reconciles, but that round-trip (write ->
  // WAL -> broadcast -> this client) is what made edits feel slow; this
  // makes the editor's own change show up immediately everywhere it's
  // rendered (board card + open viewer) without waiting on it.
  function patchLinkedNote(refId: string, content: string) {
    setLinkedNotes(prev => {
      const existing = prev[refId]
      return { ...prev, [refId]: { name: existing?.name ?? "", content, data: { ...(existing?.data ?? {}), content } } }
    })
  }

  // ── Mutations ──────────────────────────────────────────────────────────────

  function scopeColumns() {
    return key.mode === "party"
      ? { party_code: key.partyCode, board_owner_id: null }
      : { party_code: null, board_owner_id: key.ownerId }
  }

  async function createNode(input: { kind: "note" | "image"; title: string; ref_object_id?: string | null; image_url?: string | null; x: number; y: number }) {
    const { data, error } = await supabase.from("canvas_nodes").insert({
      ...scopeColumns(),
      owner_id: currentUserId,
      kind: input.kind,
      title: input.title,
      content: null,
      image_url: input.image_url ?? null,
      ref_object_id: input.ref_object_id ?? null,
      x: input.x,
      y: input.y,
    }).select().single()
    if (error) { console.error("create node error:", error); return null }
    const row = data as CanvasNode
    setNodes(prev => prev.some(n => n.id === row.id) ? prev : [...prev, row])
    return row
  }

  async function moveNode(id: string, x: number, y: number) {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, x, y } : n))
    const { error } = await supabase.from("canvas_nodes").update({ x, y }).eq("id", id)
    if (error) console.error("move node error:", error)
  }

  async function deleteNode(id: string) {
    setNodes(prev => prev.filter(n => n.id !== id))
    setEdges(prev => prev.filter(e => e.from_node_id !== id && e.to_node_id !== id))
    const { error } = await supabase.from("canvas_nodes").delete().eq("id", id)
    if (error) console.error("delete node error:", error)
  }

  async function createEdge(fromId: string, toId: string) {
    if (fromId === toId) return null
    if (edges.some(e => (e.from_node_id === fromId && e.to_node_id === toId) || (e.from_node_id === toId && e.to_node_id === fromId))) return null
    const { data, error } = await supabase.from("canvas_edges").insert({
      ...scopeColumns(), from_node_id: fromId, to_node_id: toId,
    }).select().single()
    if (error) { console.error("create edge error:", error); return null }
    const row = data as CanvasEdge
    setEdges(prev => prev.some(e => e.id === row.id) ? prev : [...prev, row])
    return row
  }

  async function deleteEdge(id: string) {
    setEdges(prev => prev.filter(e => e.id !== id))
    const { error } = await supabase.from("canvas_edges").delete().eq("id", id)
    if (error) console.error("delete edge error:", error)
  }

  return { nodes, edges, linkedNotes, loaded, missingRefIds, patchLinkedNote, createNode, moveNode, deleteNode, createEdge, deleteEdge }
}
