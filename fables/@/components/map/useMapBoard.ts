// ════════════════════════════════════════════════════════════════════════════
// useMapBoard.ts — data layer for the Hjolland map: pins (city markers),
// pin notes (a running list per pin, plain rows — not live-linked objects
// like the old canvas notes were), and the single shared "currently here"
// token row. Realtime INSERT/UPDATE/DELETE sync, modeled on the old
// party/useCanvas.ts data layer.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react"
import { supabase } from "../../../src/supabase"
import { useChannelSuffix } from "../party/partyTypes"

// Shared with the avatar-color wheel elsewhere in Party Chat (see
// MapPinViewer's `avatarColor`) so pins and people read as one palette.
export const PIN_COLORS = ["#f43f5e", "#f97316", "#f59e0b", "#84cc16", "#10b981", "#14b8a6", "#06b6d4", "#3b82f6", "#8b5cf6", "#d946ef"]
export const DEFAULT_PIN_COLOR = PIN_COLORS[0]

export interface MapPin {
  id: string
  party_code: string
  name: string
  color: string
  x: number
  y: number
  owner_id: string
  created_at: string
}

export interface MapPinNote {
  id: string
  pin_id: string
  party_code: string
  owner_id: string
  owner_name: string
  content: string
  created_at: string
}

export interface MapToken {
  party_code: string
  x: number
  y: number
  updated_by: string | null
  updated_at: string
}

// Region color-coding — freehand brush strokes sitting under the (now-white)
// hjolland.svg linework. Each stroke (a full click-drag-release gesture) is
// its own row, not a shared raster canvas someone re-uploads on every
// change — that's what lets several people paint different parts of the map
// at once without one person's stroke ever clobbering another's.
export interface StrokePoint { x: number; y: number }

export interface MapStroke {
  id: string
  party_code: string
  owner_id: string
  color: string
  size: number
  erase: boolean
  points: StrokePoint[]
  created_at: string
}

export function useMapBoard(partyCode: string, currentUserId: string) {
  const [pins, setPins] = useState<MapPin[]>([])
  const [notes, setNotes] = useState<MapPinNote[]>([])
  const [token, setToken] = useState<MapToken | null>(null)
  const [strokes, setStrokes] = useState<MapStroke[]>([])
  const [loaded, setLoaded] = useState(false)
  const suffix = useChannelSuffix()

  useEffect(() => {
    if (!partyCode || !currentUserId) return
    let cancelled = false
    setLoaded(false)
    Promise.all([
      supabase.from("map_pins").select("*").eq("party_code", partyCode),
      supabase.from("map_pin_notes").select("*").eq("party_code", partyCode),
      supabase.from("map_tokens").select("*").eq("party_code", partyCode).maybeSingle(),
      supabase.from("map_strokes").select("*").eq("party_code", partyCode).order("created_at", { ascending: true }),
    ]).then(([p, n, t, s]) => {
      if (cancelled) return
      if (p.error) console.error("map pins load error:", p.error)
      if (n.error) console.error("map pin notes load error:", n.error)
      if (t.error) console.error("map token load error:", t.error)
      if (s.error) console.error("map strokes load error:", s.error)
      if (p.data) setPins(p.data as MapPin[])
      if (n.data) setNotes(n.data as MapPinNote[])
      if (t.data) setToken(t.data as MapToken)
      if (s.data) setStrokes(s.data as MapStroke[])
      setLoaded(true)
    })
    return () => { cancelled = true }
  }, [partyCode, currentUserId])

  useEffect(() => {
    if (!partyCode || !currentUserId) return
    const filter = `party_code=eq.${partyCode}`
    const ch = supabase
      .channel(`map:${partyCode}:${currentUserId}:${suffix}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "map_pins", filter },
        payload => { const row = payload.new as MapPin; setPins(prev => prev.some(p => p.id === row.id) ? prev : [...prev, row]) })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "map_pins", filter },
        payload => { const row = payload.new as MapPin; setPins(prev => prev.map(p => p.id === row.id ? row : p)) })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "map_pins", filter },
        payload => { const old = payload.old as Partial<MapPin>; if (old.id) setPins(prev => prev.filter(p => p.id !== old.id)) })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "map_pin_notes", filter },
        payload => { const row = payload.new as MapPinNote; setNotes(prev => prev.some(n => n.id === row.id) ? prev : [...prev, row]) })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "map_pin_notes", filter },
        payload => { const old = payload.old as Partial<MapPinNote>; if (old.id) setNotes(prev => prev.filter(n => n.id !== old.id)) })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "map_tokens", filter },
        payload => { setToken(payload.new as MapToken) })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "map_tokens", filter },
        payload => { setToken(payload.new as MapToken) })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "map_strokes", filter },
        payload => { const row = payload.new as MapStroke; setStrokes(prev => prev.some(s => s.id === row.id) ? prev : [...prev, row]) })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "map_strokes", filter },
        payload => { const old = payload.old as Partial<MapStroke>; if (old.id) setStrokes(prev => prev.filter(s => s.id !== old.id)) })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [partyCode, currentUserId, suffix])

  async function createPin(name: string, x: number, y: number, color: string = DEFAULT_PIN_COLOR) {
    const { data, error } = await supabase.from("map_pins").insert({
      party_code: partyCode, name, color, x, y, owner_id: currentUserId,
    }).select().single()
    if (error) { console.error("create pin error:", error); return null }
    const row = data as MapPin
    setPins(prev => prev.some(p => p.id === row.id) ? prev : [...prev, row])
    return row
  }

  async function movePin(id: string, x: number, y: number) {
    setPins(prev => prev.map(p => p.id === id ? { ...p, x, y } : p))
    const { error } = await supabase.from("map_pins").update({ x, y }).eq("id", id)
    if (error) console.error("move pin error:", error)
  }

  async function renamePin(id: string, name: string) {
    setPins(prev => prev.map(p => p.id === id ? { ...p, name } : p))
    const { error } = await supabase.from("map_pins").update({ name }).eq("id", id)
    if (error) console.error("rename pin error:", error)
  }

  async function recolorPin(id: string, color: string) {
    setPins(prev => prev.map(p => p.id === id ? { ...p, color } : p))
    const { error } = await supabase.from("map_pins").update({ color }).eq("id", id)
    if (error) console.error("recolor pin error:", error)
  }

  async function deletePin(id: string) {
    setPins(prev => prev.filter(p => p.id !== id))
    setNotes(prev => prev.filter(n => n.pin_id !== id))
    const { error } = await supabase.from("map_pins").delete().eq("id", id)
    if (error) console.error("delete pin error:", error)
  }

  async function addNote(pinId: string, ownerName: string, content: string) {
    const { data, error } = await supabase.from("map_pin_notes").insert({
      pin_id: pinId, party_code: partyCode, owner_id: currentUserId, owner_name: ownerName, content,
    }).select().single()
    if (error) { console.error("add note error:", error); return null }
    const row = data as MapPinNote
    setNotes(prev => prev.some(n => n.id === row.id) ? prev : [...prev, row])
    return row
  }

  async function deleteNote(id: string) {
    setNotes(prev => prev.filter(n => n.id !== id))
    const { error } = await supabase.from("map_pin_notes").delete().eq("id", id)
    if (error) console.error("delete note error:", error)
  }

  // Upserted (not inserted) — there's only ever one token row per party.
  async function moveToken(x: number, y: number) {
    setToken(prev => ({ party_code: partyCode, x, y, updated_by: currentUserId, updated_at: prev?.updated_at ?? new Date().toISOString() }))
    const { data, error } = await supabase.from("map_tokens")
      .upsert({ party_code: partyCode, x, y, updated_by: currentUserId, updated_at: new Date().toISOString() })
      .select().single()
    if (error) { console.error("move token error:", error); return }
    setToken(data as MapToken)
  }

  async function addStroke(color: string, size: number, erase: boolean, points: StrokePoint[]) {
    const { data, error } = await supabase.from("map_strokes").insert({
      party_code: partyCode, owner_id: currentUserId, color, size, erase, points,
    }).select().single()
    if (error) { console.error("add stroke error:", error); return null }
    const row = data as MapStroke
    setStrokes(prev => prev.some(s => s.id === row.id) ? prev : [...prev, row])
    return row
  }

  async function deleteStroke(id: string) {
    setStrokes(prev => prev.filter(s => s.id !== id))
    const { error } = await supabase.from("map_strokes").delete().eq("id", id)
    if (error) console.error("delete stroke error:", error)
  }

  return { pins, notes, token, strokes, loaded, createPin, movePin, renamePin, recolorPin, deletePin, addNote, deleteNote, moveToken, addStroke, deleteStroke }
}
