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
import { uploadUserImage } from "../imageGallery"

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

// `pin_id`/`token_id` are mutually exclusive — a note hangs off either a pin
// or a tracker, never both (enforced by a DB check constraint).
export interface MapPinNote {
  id: string
  pin_id: string | null
  token_id: string | null
  party_code: string
  owner_id: string
  owner_name: string
  content: string
  created_at: string
}

// `kind` distinguishes the one-per-party "currently here" dot ("here",
// name/image_url unused) from user-created trackers ("tracker" — any
// number per party, each with a name and an uploaded image).
export interface MapToken {
  id: string
  party_code: string
  kind: "here" | "tracker"
  name: string | null
  image_url: string | null
  owner_id: string | null
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

// One row per party — the "Unify" flattened snapshot that individual
// strokes older than `updated_at` get baked into (see unifyStrokes below).
// Upserted in place, so unifying again just replaces the image.
export interface MapPaintLayer {
  party_code: string
  image_url: string
  updated_by: string | null
  updated_at: string
}

// Supabase's API layer caps any single response at 1000 rows regardless of
// what the query asks for. map_strokes gets a new row per brush drag, so an
// actively-painted party map blows past that within a session or two — a
// plain `.select()` there silently drops whatever doesn't fit, and since the
// query sorts oldest-first, what gets dropped is always the newest strokes.
// Page through with `.range()` until a page comes back short instead.
async function fetchAllStrokes(partyCode: string) {
  const PAGE_SIZE = 1000
  const rows: MapStroke[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase.from("map_strokes").select("*")
      .eq("party_code", partyCode).order("created_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) return { data: null, error }
    if (data) rows.push(...(data as MapStroke[]))
    if (!data || data.length < PAGE_SIZE) break
  }
  return { data: rows, error: null }
}

export function useMapBoard(partyCode: string, currentUserId: string) {
  const [pins, setPins] = useState<MapPin[]>([])
  const [notes, setNotes] = useState<MapPinNote[]>([])
  const [tokens, setTokens] = useState<MapToken[]>([])
  const [strokes, setStrokes] = useState<MapStroke[]>([])
  const [paintLayer, setPaintLayer] = useState<MapPaintLayer | null>(null)
  const [loaded, setLoaded] = useState(false)
  const suffix = useChannelSuffix()

  useEffect(() => {
    if (!partyCode || !currentUserId) return
    let cancelled = false
    setLoaded(false)
    Promise.all([
      supabase.from("map_pins").select("*").eq("party_code", partyCode),
      supabase.from("map_pin_notes").select("*").eq("party_code", partyCode),
      supabase.from("map_tokens").select("*").eq("party_code", partyCode),
      fetchAllStrokes(partyCode),
      supabase.from("map_paint_layer").select("*").eq("party_code", partyCode).maybeSingle(),
    ]).then(([p, n, t, s, l]) => {
      if (cancelled) return
      if (p.error) console.error("map pins load error:", p.error)
      if (n.error) console.error("map pin notes load error:", n.error)
      if (t.error) console.error("map tokens load error:", t.error)
      if (s.error) console.error("map strokes load error:", s.error)
      if (l.error) console.error("map paint layer load error:", l.error)
      if (p.data) setPins(p.data as MapPin[])
      if (n.data) setNotes(n.data as MapPinNote[])
      if (t.data) setTokens(t.data as MapToken[])
      if (s.data) setStrokes(s.data)
      setPaintLayer(l.data as MapPaintLayer | null)
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
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "map_pin_notes", filter },
        payload => { const row = payload.new as MapPinNote; setNotes(prev => prev.map(n => n.id === row.id ? row : n)) })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "map_pin_notes", filter },
        payload => { const old = payload.old as Partial<MapPinNote>; if (old.id) setNotes(prev => prev.filter(n => n.id !== old.id)) })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "map_tokens", filter },
        payload => { const row = payload.new as MapToken; setTokens(prev => prev.some(t => t.id === row.id) ? prev : [...prev, row]) })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "map_tokens", filter },
        payload => { const row = payload.new as MapToken; setTokens(prev => prev.map(t => t.id === row.id ? row : t)) })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "map_tokens", filter },
        payload => { const old = payload.old as Partial<MapToken>; if (old.id) setTokens(prev => prev.filter(t => t.id !== old.id)) })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "map_strokes", filter },
        payload => { const row = payload.new as MapStroke; setStrokes(prev => prev.some(s => s.id === row.id) ? prev : [...prev, row]) })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "map_strokes", filter },
        payload => { const old = payload.old as Partial<MapStroke>; if (old.id) setStrokes(prev => prev.filter(s => s.id !== old.id)) })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "map_paint_layer", filter },
        payload => { setPaintLayer(payload.new as MapPaintLayer) })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "map_paint_layer", filter },
        payload => { setPaintLayer(payload.new as MapPaintLayer) })
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

  // `target` picks which side of the pin_id/token_id pair gets set — a note
  // attaches to exactly one of a pin or a tracker.
  async function addNote(target: { pinId: string } | { tokenId: string }, ownerName: string, content: string) {
    const { data, error } = await supabase.from("map_pin_notes").insert({
      pin_id: "pinId" in target ? target.pinId : null,
      token_id: "tokenId" in target ? target.tokenId : null,
      party_code: partyCode, owner_id: currentUserId, owner_name: ownerName, content,
    }).select().single()
    if (error) { console.error("add note error:", error); return null }
    const row = data as MapPinNote
    setNotes(prev => prev.some(n => n.id === row.id) ? prev : [...prev, row])
    return row
  }

  async function editNote(id: string, content: string) {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, content } : n))
    const { error } = await supabase.from("map_pin_notes").update({ content }).eq("id", id)
    if (error) console.error("edit note error:", error)
  }

  async function deleteNote(id: string) {
    setNotes(prev => prev.filter(n => n.id !== id))
    const { error } = await supabase.from("map_pin_notes").delete().eq("id", id)
    if (error) console.error("delete note error:", error)
  }

  // Repositions any existing token row (the "here" dot or a tracker) — the
  // row already exists by this point, so a plain UPDATE by id is enough.
  async function moveToken(id: string, x: number, y: number) {
    setTokens(prev => prev.map(t => t.id === id ? { ...t, x, y, updated_by: currentUserId, updated_at: new Date().toISOString() } : t))
    const { error } = await supabase.from("map_tokens")
      .update({ x, y, updated_by: currentUserId, updated_at: new Date().toISOString() })
      .eq("id", id)
    if (error) console.error("move token error:", error)
  }

  // First placement of the one-per-party "here" dot — inserts it, since
  // unlike moveToken there's no existing row/id yet. Once placed, dragging
  // it goes through moveToken like everything else.
  async function placeHereToken(x: number, y: number) {
    const { data, error } = await supabase.from("map_tokens").insert({
      party_code: partyCode, kind: "here", x, y, updated_by: currentUserId,
    }).select().single()
    if (error) { console.error("place token error:", error); return }
    setTokens(prev => [...prev, data as MapToken])
  }

  // User-created trackers (name + uploaded image) — any number per party,
  // each an independent draggable marker synced the same way as the "here"
  // dot. Rename/delete are gated client-side (see MapOverlay) to the
  // tracker's creator or the DM.
  async function createTracker(name: string, imageUrl: string, x: number, y: number) {
    const { data, error } = await supabase.from("map_tokens").insert({
      party_code: partyCode, kind: "tracker", name, image_url: imageUrl, owner_id: currentUserId, x, y, updated_by: currentUserId,
    }).select().single()
    if (error) { console.error("create tracker error:", error); return null }
    const row = data as MapToken
    setTokens(prev => [...prev, row])
    return row
  }

  async function renameTracker(id: string, name: string) {
    setTokens(prev => prev.map(t => t.id === id ? { ...t, name } : t))
    const { error } = await supabase.from("map_tokens").update({ name }).eq("id", id)
    if (error) console.error("rename tracker error:", error)
  }

  async function deleteTracker(id: string) {
    setTokens(prev => prev.filter(t => t.id !== id))
    setNotes(prev => prev.filter(n => n.token_id !== id))
    const { error } = await supabase.from("map_tokens").delete().eq("id", id)
    if (error) console.error("delete tracker error:", error)
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

  // Flattens every current stroke into `imageBlob` (already rendered by the
  // caller — see MapOverlay's canvas, which draws the existing paint layer
  // plus all live strokes into the same buffer, so exporting it is already
  // the correct composite) and retires the strokes that composite
  // represents. `cutoff` (the newest created_at among the captured strokes,
  // picked by the caller before the upload starts) deletes by comparison
  // instead of an explicit id list — a stroke table can run into the
  // thousands of rows, and passing that many ids through `.in()` blows well
  // past the ~8KB URL length Supabase's edge enforces, silently dropping
  // most of the delete. A `created_at <= cutoff` filter has no such limit
  // regardless of row count, and still leaves alone anything someone draws
  // mid-unify (it postdates the cutoff, so it isn't touched).
  async function unifyStrokes(imageBlob: Blob, cutoff: string) {
    const file = new File([imageBlob], "paint.png", { type: "image/png" })
    const url = await uploadUserImage(currentUserId, file, `map-paint-${partyCode}`)
    if (!url) { console.error("unify strokes: image upload failed"); return }

    const row: MapPaintLayer = { party_code: partyCode, image_url: url, updated_by: currentUserId, updated_at: new Date().toISOString() }
    const { error: upsertError } = await supabase.from("map_paint_layer").upsert(row, { onConflict: "party_code" })
    if (upsertError) { console.error("unify strokes upsert error:", upsertError); return }
    setPaintLayer(row)

    setStrokes(prev => prev.filter(s => s.created_at > cutoff))
    const { error: deleteError } = await supabase.from("map_strokes").delete()
      .eq("party_code", partyCode).lte("created_at", cutoff)
    if (deleteError) console.error("unify strokes cleanup error:", deleteError)
  }

  return {
    pins, notes, tokens, strokes, paintLayer, loaded,
    createPin, movePin, renamePin, recolorPin, deletePin, addNote, editNote, deleteNote,
    moveToken, placeHereToken, createTracker, renameTracker, deleteTracker,
    addStroke, deleteStroke, unifyStrokes,
  }
}
