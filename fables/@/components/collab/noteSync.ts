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

export function connectNoteChannel(noteId: string, doc: Y.Doc) {
  const channel = supabase.channel(`note-${noteId}`, { config: { broadcast: { self: false } } })

  channel.on("broadcast", { event: "update" }, ({ payload }) => {
    try { applyEncodedState(doc, payload.update) }
    catch (e) { console.error("noteSync: failed to apply remote update", e) }
  })

  channel.subscribe()

  const onUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === "remote-snapshot") return  // don't echo back what we just received
    channel.send({ type: "broadcast", event: "update", payload: { update: uint8ToBase64(update) } })
  }
  doc.on("update", onUpdate)

  return function disconnect() {
    doc.off("update", onUpdate)
    supabase.removeChannel(channel)
  }
}
