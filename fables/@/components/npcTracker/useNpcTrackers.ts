// ════════════════════════════════════════════════════════════════════════════
// useNpcTrackers.ts — data layer for the party's NPC Tracker shelf: a shared
// reference list of NPCs the party has met (name, art, freeform details,
// goal, last-seen-at map pin link). Same shape as useMapBoard.ts's data hooks —
// realtime INSERT/UPDATE/DELETE sync, optimistic local writes. Also read
// directly by map/MapOverlay.tsx, which lets a new map tracker link itself
// to one of these entries instead of typing a fresh name/image.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from "react"
import { supabase } from "../../../src/supabase"
import { useChannelSuffix } from "../party/partyTypes"
import type { MapPinNote } from "../map/useMapBoard"

// Just enough of a map tracker to know which NPC it's linked to (see
// MapToken.npc_tracker_id in useMapBoard.ts).
interface TokenLink { id: string; npc_tracker_id: string | null }

export interface NpcTracker {
  id: string
  party_code: string
  name: string
  subtitle: string | null
  details: string | null
  image_url: string | null
  goal: string | null
  // "Last seen at" — a live link to a map pin, not freeform text (that's
  // what this replaced: two DMs had been typing the pin's name in by hand,
  // which drifts the moment that pin gets renamed). Only meaningful for the
  // one party with map access — see MAP_PARTY_CODE.
  location_pin_id: string | null
  owner_id: string
  created_at: string
  updated_at: string
}

export type NpcTrackerDraft = Pick<NpcTracker, "name" | "subtitle" | "details" | "image_url" | "goal" | "location_pin_id">

// Rewrites `[[Name]]` wiki-link mentions into real markdown links pointing
// at a "#internal:npc:<id>" pseudo-URL — Markdown.tsx's onInternalLink
// callback intercepts that scheme instead of navigating. Deliberately
// prefixed with "#" rather than a bare "internal:" scheme: react-markdown's
// built-in link sanitizer only allows a safelist of real protocols
// (http/https/mailto/...) and silently rewrites anything else to an empty
// href — which made the very first version of this fall through to a real
// `<a href="" target="_blank">` (i.e. opened a blank new tab) instead of
// ever reaching our onInternalLink handler. A leading "#" reads as a
// same-page fragment to that sanitizer, so it passes the href through
// unchanged. Unmatched mentions (typos, or an NPC not on this party's
// shelf) are left as literal `[[Name]]` text rather than silently dropped,
// so a bad link stays visible instead of vanishing.
const WIKI_LINK_RE = /\[\[([^[\]]+)\]\]/g
export function linkifyNpcMentions(text: string, npcs: Pick<NpcTracker, "id" | "name">[]): string {
  return text.replace(WIKI_LINK_RE, (match, rawName: string) => {
    const name = rawName.trim()
    const npc = npcs.find(n => n.name.toLowerCase() === name.toLowerCase())
    return npc ? `[${name}](#internal:npc:${npc.id})` : match
  })
}

// Just enough of a map pin to populate the "which city" picker — a full
// useMapBoard() subscription (pins/tokens/notes/strokes/paint layer, several
// realtime channels) would be a lot of unused weight just for a name list.
export interface PinOption { id: string; name: string }

export function useNpcTrackers(partyCode: string, currentUserId: string) {
  const [npcs, setNpcs] = useState<NpcTracker[]>([])
  const [pins, setPins] = useState<PinOption[]>([])
  const [tokenLinks, setTokenLinks] = useState<TokenLink[]>([])
  const [npcNotes, setNpcNotes] = useState<MapPinNote[]>([])
  const [loaded, setLoaded] = useState(false)
  const suffix = useChannelSuffix()

  // An NPC that's been placed on the map as a tracker shares its notes with
  // that tracker (see notesForNpc below) rather than keeping a second,
  // separate pool — from the DM's chair the shelf entry and the map marker
  // are "the same NPC," so their notes should read as one thing wherever
  // you open them from.
  const npcIdToTokenId = useMemo(() => {
    const map: Record<string, string> = {}
    for (const t of tokenLinks) if (t.npc_tracker_id) map[t.npc_tracker_id] = t.id
    return map
  }, [tokenLinks])
  const linkedTokenIdsRef = useRef<Set<string>>(new Set())
  useEffect(() => { linkedTokenIdsRef.current = new Set(tokenLinks.map(t => t.id)) }, [tokenLinks])

  useEffect(() => {
    if (!partyCode) return
    let cancelled = false
    setLoaded(false)
    supabase.from("npc_trackers").select("*").eq("party_code", partyCode).order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) console.error("npc trackers load error:", error)
        if (data) setNpcs(data as NpcTracker[])
        setLoaded(true)
      })
    return () => { cancelled = true }
  }, [partyCode])

  useEffect(() => {
    if (!partyCode) return
    let cancelled = false
    supabase.from("map_pins").select("id, name").eq("party_code", partyCode).order("name", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) console.error("npc trackers: pins load error:", error)
        if (data) setPins(data as PinOption[])
      })
    return () => { cancelled = true }
  }, [partyCode])

  useEffect(() => {
    if (!partyCode) return
    let cancelled = false
    supabase.from("map_tokens").select("id, npc_tracker_id").eq("party_code", partyCode).not("npc_tracker_id", "is", null)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) console.error("npc trackers: token links load error:", error)
        if (data) setTokenLinks(data as TokenLink[])
      })
    return () => { cancelled = true }
  }, [partyCode])

  // "Detail Notes" — the full sticky-note corkboard (see MapNotesPanel).
  // Reuses map_pin_notes rather than a parallel table: an NPC with no map
  // tracker gets its own npc_id-keyed notes, but an NPC that HAS been placed
  // on the map shares the tracker's token_id-keyed notes instead of starting
  // a second, separate pool (see npcIdToTokenId above).
  useEffect(() => {
    if (!partyCode) return
    let cancelled = false
    const linkedTokenIds = tokenLinks.map(t => t.id)
    const orFilter = linkedTokenIds.length > 0
      ? `npc_id.not.is.null,token_id.in.(${linkedTokenIds.join(",")})`
      : "npc_id.not.is.null"
    supabase.from("map_pin_notes").select("*").eq("party_code", partyCode).or(orFilter)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) console.error("npc notes load error:", error)
        if (data) setNpcNotes(data as MapPinNote[])
      })
    return () => { cancelled = true }
  }, [partyCode, tokenLinks])

  useEffect(() => {
    if (!partyCode) return
    const filter = `party_code=eq.${partyCode}`
    const ch = supabase
      .channel(`npc-trackers:${partyCode}:${currentUserId}:${suffix}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "npc_trackers", filter },
        payload => { const row = payload.new as NpcTracker; setNpcs(prev => prev.some(n => n.id === row.id) ? prev : [...prev, row]) })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "npc_trackers", filter },
        payload => { const row = payload.new as NpcTracker; setNpcs(prev => prev.map(n => n.id === row.id ? row : n)) })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "npc_trackers", filter },
        payload => { const old = payload.old as Partial<NpcTracker>; if (old.id) setNpcs(prev => prev.filter(n => n.id !== old.id)) })
      // map_pin_notes' party_code filter can't also exclude pin/unlinked-
      // token notes server-side (postgres_changes filters are plain
      // column=value), so every handler below re-checks npc_id — or
      // token_id against the current linked-tracker set — itself before
      // touching state.
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "map_pin_notes", filter },
        payload => {
          const row = payload.new as MapPinNote
          if (row.npc_id || (row.token_id && linkedTokenIdsRef.current.has(row.token_id)))
            setNpcNotes(prev => prev.some(n => n.id === row.id) ? prev : [...prev, row])
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "map_pin_notes", filter },
        payload => {
          const row = payload.new as MapPinNote
          if (row.npc_id || (row.token_id && linkedTokenIdsRef.current.has(row.token_id)))
            setNpcNotes(prev => prev.map(n => n.id === row.id ? row : n))
        })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "map_pin_notes", filter },
        payload => { const old = payload.old as Partial<MapPinNote>; if (old.id) setNpcNotes(prev => prev.filter(n => n.id !== old.id)) })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [partyCode, currentUserId, suffix])

  async function createNpc(draft: NpcTrackerDraft) {
    const { data, error } = await supabase.from("npc_trackers").insert({
      party_code: partyCode, owner_id: currentUserId, ...draft,
    }).select().single()
    if (error) { console.error("create npc tracker error:", error); return null }
    const row = data as NpcTracker
    setNpcs(prev => prev.some(n => n.id === row.id) ? prev : [...prev, row])
    return row
  }

  async function updateNpc(id: string, patch: Partial<NpcTrackerDraft>) {
    const updated_at = new Date().toISOString()
    setNpcs(prev => prev.map(n => n.id === id ? { ...n, ...patch, updated_at } : n))
    const { error } = await supabase.from("npc_trackers").update({ ...patch, updated_at }).eq("id", id)
    if (error) console.error("update npc tracker error:", error)
  }

  async function deleteNpc(id: string) {
    setNpcs(prev => prev.filter(n => n.id !== id))
    const { error } = await supabase.from("npc_trackers").delete().eq("id", id)
    if (error) console.error("delete npc tracker error:", error)
  }

  // Notes for one NPC: its own npc_id notes, plus its linked map tracker's
  // token_id notes when it has one placed — see npcIdToTokenId above.
  function notesForNpc(npcId: string) {
    const tokenId = npcIdToTokenId[npcId]
    return npcNotes.filter(n => n.npc_id === npcId || (tokenId !== undefined && n.token_id === tokenId))
  }

  async function addNpcNote(npcId: string, ownerName: string, content: string) {
    const tokenId = npcIdToTokenId[npcId]
    const { data, error } = await supabase.from("map_pin_notes").insert(
      tokenId !== undefined
        ? { token_id: tokenId, party_code: partyCode, owner_id: currentUserId, owner_name: ownerName, content }
        : { npc_id: npcId, party_code: partyCode, owner_id: currentUserId, owner_name: ownerName, content }
    ).select().single()
    if (error) { console.error("add npc note error:", error); return null }
    const row = data as MapPinNote
    setNpcNotes(prev => prev.some(n => n.id === row.id) ? prev : [...prev, row])
    return row
  }

  async function editNpcNote(id: string, content: string) {
    setNpcNotes(prev => prev.map(n => n.id === id ? { ...n, content } : n))
    const { error } = await supabase.from("map_pin_notes").update({ content }).eq("id", id)
    if (error) console.error("edit npc note error:", error)
  }

  async function deleteNpcNote(id: string) {
    setNpcNotes(prev => prev.filter(n => n.id !== id))
    const { error } = await supabase.from("map_pin_notes").delete().eq("id", id)
    if (error) console.error("delete npc note error:", error)
  }

  return { npcs, pins, npcNotes, notesForNpc, loaded, createNpc, updateNpc, deleteNpc, addNpcNote, editNpcNote, deleteNpcNote }
}
