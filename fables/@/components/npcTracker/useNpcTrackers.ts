// ════════════════════════════════════════════════════════════════════════════
// useNpcTrackers.ts — data layer for the party's NPC Tracker shelf: a shared
// reference list of NPCs the party has met (name, art, freeform details,
// last-seen location, goal). Same shape as useMapBoard.ts's data hooks —
// realtime INSERT/UPDATE/DELETE sync, optimistic local writes. Also read
// directly by map/MapOverlay.tsx, which lets a new map tracker link itself
// to one of these entries instead of typing a fresh name/image.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react"
import { supabase } from "../../../src/supabase"
import { useChannelSuffix } from "../party/partyTypes"

export interface NpcTracker {
  id: string
  party_code: string
  name: string
  subtitle: string | null
  details: string | null
  image_url: string | null
  last_seen: string | null
  goal: string | null
  owner_id: string
  created_at: string
  updated_at: string
}

export type NpcTrackerDraft = Pick<NpcTracker, "name" | "subtitle" | "details" | "image_url" | "last_seen" | "goal">

export function useNpcTrackers(partyCode: string, currentUserId: string) {
  const [npcs, setNpcs] = useState<NpcTracker[]>([])
  const [loaded, setLoaded] = useState(false)
  const suffix = useChannelSuffix()

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
    const filter = `party_code=eq.${partyCode}`
    const ch = supabase
      .channel(`npc-trackers:${partyCode}:${currentUserId}:${suffix}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "npc_trackers", filter },
        payload => { const row = payload.new as NpcTracker; setNpcs(prev => prev.some(n => n.id === row.id) ? prev : [...prev, row]) })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "npc_trackers", filter },
        payload => { const row = payload.new as NpcTracker; setNpcs(prev => prev.map(n => n.id === row.id ? row : n)) })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "npc_trackers", filter },
        payload => { const old = payload.old as Partial<NpcTracker>; if (old.id) setNpcs(prev => prev.filter(n => n.id !== old.id)) })
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

  return { npcs, loaded, createNpc, updateNpc, deleteNpc }
}
