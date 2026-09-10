// ════════════════════════════════════════════════════════════════════════════
// useMysteriousPages.ts — data layer for a party's Mysterious Pages notebook:
// an ordered deck of pages (each one an uploaded image, or a block of
// markdown text) that anyone in the party can flip through and annotate with
// pinned sticky notes — each note tethered to a spot on the page by a thin
// colored line.
//
// Same shape as useNpcTrackers.ts / useMapBoard.ts: realtime
// INSERT/UPDATE/DELETE sync, optimistic local writes, a resume refetch for
// mobile socket gaps. Every row is party-shared (no per-user gating beyond
// `owner_id`, kept only for display). Scoped to one party — the KOQK21 map
// campaign; see MAP_PARTY_CODE and the rail button in party/PartyServer.tsx.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react"
import { supabase } from "../../../src/supabase"
import { useChannelSuffix } from "../party/partyTypes"
import { useOnResume } from "@/components/shared/useOnResume"

export interface MysteriousPage {
  id: string
  party_code: string
  position: number
  kind: "image" | "text"
  image_url: string | null
  text_content: string | null
  title: string | null
  owner_id: string
  created_at: string
  updated_at: string
}

// `anchor_*` = the point on the page the connector line points at.
// `note_*`   = where the sticky card itself sits. Both normalized 0..1
// against the rendered page box, so they survive any display size.
export interface MysteriousPageNote {
  id: string
  page_id: string
  party_code: string
  owner_id: string
  owner_name: string
  content: string
  color: string
  anchor_x: number
  anchor_y: number
  note_x: number
  note_y: number
  created_at: string
  updated_at: string
}

export type PageNotePatch = Partial<Pick<MysteriousPageNote,
  "content" | "color" | "anchor_x" | "anchor_y" | "note_x" | "note_y">>

const bySort = (a: MysteriousPage, b: MysteriousPage) =>
  a.position - b.position || a.created_at.localeCompare(b.created_at)

export function useMysteriousPages(partyCode: string, currentUserId: string) {
  const [pages, setPages] = useState<MysteriousPage[]>([])
  const [notes, setNotes] = useState<MysteriousPageNote[]>([])
  const [loaded, setLoaded] = useState(false)
  const suffix = useChannelSuffix()
  // Guards a slow/late response against landing after partyCode changed or
  // the hook unmounted — same pattern as useNpcTrackers' genRef.
  const genRef = useRef(0)

  function fetchAll() {
    if (!partyCode) return
    const gen = genRef.current
    setLoaded(false)
    Promise.all([
      supabase.from("mysterious_pages").select("*").eq("party_code", partyCode),
      supabase.from("mysterious_page_notes").select("*").eq("party_code", partyCode),
    ]).then(([p, n]) => {
      if (gen !== genRef.current) return
      if (p.error) console.error("mysterious pages load error:", p.error)
      if (n.error) console.error("mysterious page notes load error:", n.error)
      if (p.data) setPages((p.data as MysteriousPage[]).slice().sort(bySort))
      if (n.data) setNotes(n.data as MysteriousPageNote[])
      setLoaded(true)
    })
  }

  useEffect(() => {
    genRef.current++
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { genRef.current++ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyCode])

  useOnResume(fetchAll)

  useEffect(() => {
    if (!partyCode || !currentUserId) return
    const filter = `party_code=eq.${partyCode}`
    const ch = supabase
      .channel(`mysterious-pages:${partyCode}:${currentUserId}:${suffix}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mysterious_pages", filter },
        payload => { const row = payload.new as MysteriousPage; setPages(prev => prev.some(p => p.id === row.id) ? prev : [...prev, row].sort(bySort)) })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "mysterious_pages", filter },
        payload => { const row = payload.new as MysteriousPage; setPages(prev => prev.map(p => p.id === row.id ? row : p).sort(bySort)) })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "mysterious_pages", filter },
        payload => { const old = payload.old as Partial<MysteriousPage>; if (old.id) setPages(prev => prev.filter(p => p.id !== old.id)) })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mysterious_page_notes", filter },
        payload => { const row = payload.new as MysteriousPageNote; setNotes(prev => prev.some(n => n.id === row.id) ? prev : [...prev, row]) })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "mysterious_page_notes", filter },
        payload => { const row = payload.new as MysteriousPageNote; setNotes(prev => prev.map(n => n.id === row.id ? row : n)) })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "mysterious_page_notes", filter },
        payload => { const old = payload.old as Partial<MysteriousPageNote>; if (old.id) setNotes(prev => prev.filter(n => n.id !== old.id)) })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [partyCode, currentUserId, suffix])

  function nextPosition() {
    return pages.reduce((m, p) => Math.max(m, p.position), -1) + 1
  }

  async function createPage(fields: Partial<MysteriousPage> & { kind: "image" | "text" }) {
    const { data, error } = await supabase.from("mysterious_pages").insert({
      party_code: partyCode, owner_id: currentUserId, position: nextPosition(),
      image_url: null, text_content: null, title: null, ...fields,
    }).select().single()
    if (error) { console.error("create page error:", error); return null }
    const row = data as MysteriousPage
    setPages(prev => prev.some(p => p.id === row.id) ? prev : [...prev, row].sort(bySort))
    return row
  }
  const createImagePage = (imageUrl: string) => createPage({ kind: "image", image_url: imageUrl })
  const createTextPage  = (text: string)     => createPage({ kind: "text", text_content: text })

  async function updatePage(id: string, patch: Partial<Pick<MysteriousPage, "title" | "text_content" | "image_url">>) {
    const updated_at = new Date().toISOString()
    setPages(prev => prev.map(p => p.id === id ? { ...p, ...patch, updated_at } : p))
    const { error } = await supabase.from("mysterious_pages").update({ ...patch, updated_at }).eq("id", id)
    if (error) console.error("update page error:", error)
  }

  async function deletePage(id: string) {
    setPages(prev => prev.filter(p => p.id !== id))
    setNotes(prev => prev.filter(n => n.page_id !== id))
    const { error } = await supabase.from("mysterious_pages").delete().eq("id", id)
    if (error) console.error("delete page error:", error)
  }

  // Swap this page's position with its neighbour in `dir` (-1 prev / +1 next).
  // Page counts are small (a notebook), so a plain two-row swap is enough —
  // no fractional-index bookkeeping.
  async function reorderPage(id: string, dir: -1 | 1) {
    const ordered = pages.slice().sort(bySort)
    const i = ordered.findIndex(p => p.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= ordered.length) return
    const a = ordered[i], b = ordered[j]
    setPages(prev => prev.map(p =>
      p.id === a.id ? { ...p, position: b.position }
      : p.id === b.id ? { ...p, position: a.position }
      : p,
    ).sort(bySort))
    const [r1, r2] = await Promise.all([
      supabase.from("mysterious_pages").update({ position: b.position }).eq("id", a.id),
      supabase.from("mysterious_pages").update({ position: a.position }).eq("id", b.id),
    ])
    if (r1.error || r2.error) console.error("reorder page error:", r1.error || r2.error)
  }

  const notesForPage = (pageId: string) => notes.filter(n => n.page_id === pageId)

  async function addNote(pageId: string, ownerName: string, color: string) {
    const { data, error } = await supabase.from("mysterious_page_notes").insert({
      page_id: pageId, party_code: partyCode, owner_id: currentUserId, owner_name: ownerName,
      content: "", color, anchor_x: 0.5, anchor_y: 0.5, note_x: 0.5, note_y: 0.16,
    }).select().single()
    if (error) { console.error("add page note error:", error); return null }
    const row = data as MysteriousPageNote
    setNotes(prev => prev.some(n => n.id === row.id) ? prev : [...prev, row])
    return row
  }

  async function updateNote(id: string, patch: PageNotePatch) {
    const updated_at = new Date().toISOString()
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...patch, updated_at } : n))
    const { error } = await supabase.from("mysterious_page_notes").update({ ...patch, updated_at }).eq("id", id)
    if (error) console.error("update page note error:", error)
  }

  async function deleteNote(id: string) {
    setNotes(prev => prev.filter(n => n.id !== id))
    const { error } = await supabase.from("mysterious_page_notes").delete().eq("id", id)
    if (error) console.error("delete page note error:", error)
  }

  return {
    pages, notes, notesForPage, loaded,
    createImagePage, createTextPage, updatePage, deletePage, reorderPage,
    addNote, updateNote, deleteNote,
  }
}
