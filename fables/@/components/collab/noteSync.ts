// ════════════════════════════════════════════════════════════════════════════
// noteSync.ts — minimal Yjs CRDT relay for live collaborative note editing
//
// Real conflict-free merging (via Yjs's Y.Text) relayed over a per-note
// Supabase Realtime *broadcast* channel — broadcast is plain pub/sub over the
// websocket and does not depend on Postgres RLS, so the live-typing part works
// for any two clients subscribed to the same `note-<id>` channel regardless of
// table permissions. Persisting the result back to the `objects` row (so a
// collaborator who reloads, or opens the note later, sees it) DOES go through
// Postgres and therefore DOES need a matching RLS policy — see the comment on
// `saveShared` in NoteView.tsx.
//
// The same channel also carries Supabase Realtime *Presence* — each connected
// client tracks its own {id, name, color, selStart, selEnd}, giving every
// collaborator a distinct, named, colored cursor instead of one shared caret.
// ════════════════════════════════════════════════════════════════════════════

import * as Y from "yjs"
import { supabase } from "../../../src/supabase"

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function encodeDocState(doc: Y.Doc): string {
  return uint8ToBase64(Y.encodeStateAsUpdate(doc))
}

export function applyEncodedState(doc: Y.Doc, encoded: string) {
  Y.applyUpdate(doc, base64ToUint8(encoded), "remote-snapshot")
}

// Applies a plain-string diff (common prefix/suffix) into a Y.Text so a
// regular controlled <textarea> can drive a CRDT without a rich editor
// binding. Good enough for realistic single-cursor typing/paste edits.
export function applyTextDiff(ytext: Y.Text, newText: string) {
  const oldText = ytext.toString()
  if (oldText === newText) return
  let start = 0
  const maxStart = Math.min(oldText.length, newText.length)
  while (start < maxStart && oldText[start] === newText[start]) start++
  let endOld = oldText.length
  let endNew = newText.length
  while (endOld > start && endNew > start && oldText[endOld - 1] === newText[endNew - 1]) { endOld--; endNew-- }
  ytext.doc!.transact(() => {
    if (endOld > start) ytext.delete(start, endOld - start)
    if (endNew > start) ytext.insert(start, newText.slice(start, endNew))
  }, "local")
}

// ── Selection transform ──────────────────────────────────────────────────────
//
// When a remote edit lands, the textarea gets re-rendered with the merged
// text, which resets the browser's native caret. To keep two people from
// stomping on each other's cursor position while typing at once, we walk the
// Y.Text change delta (Quill-style {retain,insert,delete} ops) and shift any
// local selection offset by the same amount a remote edit would shift it.

type Delta = Array<{ insert?: string | object; delete?: number; retain?: number }>

function transformIndex(delta: Delta, index: number): number {
  let oldPos = 0
  let newPos = 0
  for (const op of delta) {
    if (oldPos >= index) break
    if (op.retain != null) {
      if (oldPos + op.retain > index) { newPos += index - oldPos; oldPos = index; break }
      oldPos += op.retain
      newPos += op.retain
    } else if (typeof op.insert === "string") {
      newPos += op.insert.length
    } else if (op.insert != null) {
      newPos += 1
    } else if (op.delete != null) {
      if (oldPos + op.delete > index) { oldPos = index; break }
      oldPos += op.delete
    }
  }
  newPos += Math.max(0, index - oldPos)
  return newPos
}

export function adjustSelectionForDelta(delta: Delta, selStart: number, selEnd: number): { start: number; end: number } {
  return { start: transformIndex(delta, selStart), end: transformIndex(delta, selEnd) }
}

// ── Presence ──────────────────────────────────────────────────────────────────

export interface LocalPeer {
  id: string
  name: string
  color: string
}

export interface PeerState extends LocalPeer {
  selStart: number | null
  selEnd: number | null
}

const SELECTION_THROTTLE_MS = 80

export function connectNoteChannel(
  noteId: string,
  doc: Y.Doc,
  localPeer: LocalPeer,
  onRemoteDelta: (delta: Delta) => void,
  onPeersChange: (peers: PeerState[]) => void,
) {
  const channel = supabase.channel(`note-${noteId}`, {
    config: { broadcast: { self: false }, presence: { key: localPeer.id } },
  })

  channel.on("broadcast", { event: "update" }, ({ payload }) => {
    try { applyEncodedState(doc, payload.update) }
    catch (e) { console.error("noteSync: failed to apply remote update", e) }
  })

  function syncPeers() {
    const state = channel.presenceState<PeerState>()
    const peers: PeerState[] = []
    for (const key in state) {
      if (key === localPeer.id) continue
      const entries = state[key]
      const latest = entries?.[entries.length - 1]
      if (latest) peers.push(latest)
    }
    onPeersChange(peers)
  }

  channel.on("presence", { event: "sync" }, syncPeers)

  channel.subscribe(status => {
    if (status === "SUBSCRIBED") {
      channel.track({ ...localPeer, selStart: null, selEnd: null } satisfies PeerState)
    }
  })

  const onUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === "remote-snapshot") return
    channel.send({ type: "broadcast", event: "update", payload: { update: uint8ToBase64(update) } })
  }
  doc.on("update", onUpdate)

  const textObserver = (event: Y.YTextEvent, transaction: Y.Transaction) => {
    if (transaction.origin === "local") return
    onRemoteDelta(event.changes.delta as Delta)
  }
  doc.getText("content").observe(textObserver)

  let selectionTimer: ReturnType<typeof setTimeout> | null = null
  let lastTrackAt = 0
  function updateSelection(selStart: number, selEnd: number) {
    const payload = { ...localPeer, selStart, selEnd } satisfies PeerState
    const wait = Math.max(0, SELECTION_THROTTLE_MS - (Date.now() - lastTrackAt))
    if (selectionTimer) clearTimeout(selectionTimer)
    selectionTimer = setTimeout(() => {
      lastTrackAt = Date.now()
      channel.track(payload)
    }, wait)
  }

  return {
    updateSelection,
    disconnect() {
      doc.off("update", onUpdate)
      doc.getText("content").unobserve(textObserver)
      if (selectionTimer) clearTimeout(selectionTimer)
      supabase.removeChannel(channel)
    },
  }
}
