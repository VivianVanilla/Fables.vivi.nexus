// ════════════════════════════════════════════════════════════════════════════
// useCollaborativeNote.ts — shared logic behind every live-collaborative note
// editor (the standalone NoteView page and the character sheet's embedded
// InlineNote). Both used to duplicate this almost line-for-line; consolidated
// here so the sharing/sync bug fixes and the presence-cursor feature only
// have to be written once.
//
// Bugs this fixes that the duplicated versions had:
//  1. Content autosave used to write the *whole* `data` JSON column back,
//     including a stale local copy of collaboratorEmails/pendingInviteEmails
//     — so typing right after someone accepted/denied an invite would
//     silently revert their acceptance. Writes go through the `merge_object_data`
//     Postgres RPC (see mergeWrite below), which does `data = data || patch`
//     as a single atomic statement server-side — no read-then-write window for
//     a concurrent write (from this tab or another person's) to get clobbered.
//  2. Nothing told an already-open note that sharing fields changed
//     elsewhere (e.g. the owner never saw "shared" update after an invitee
//     accepted). A postgres_changes subscription keeps that live, and also
//     patches the shared UserContext `objects` cache so the sidebar badge
//     updates without a full reload.
//  3. Every linked note on a character sheet used to open a live Realtime
//     connection as soon as the sheet mounted, even collapsed ones nobody's
//     looking at. `active` gates the connections so a collapsed InlineNote
//     costs nothing until it's expanded.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from "react"
import * as Y from "yjs"
import type { userInfo } from "@/types/userInfo"
import { useUserContext } from "../../../src/contexts/UserContext"
import { supabase } from "../../../src/supabase"
import { safeParseJson } from "../character-utils"
import { connectNoteChannel, applyTextDiff, encodeDocState, applyEncodedState, adjustSelectionForDelta, type PeerState } from "./noteSync"
import { colorForId, nameForEmail } from "./collabColors"
import { mergeObjectData } from "./mergeObjectData"

export type CollabRole = "editor" | "viewer"

interface NoteData {
  content?: string
  ydocState?: string
  collaboratorEmails?: string[]
  pendingInviteEmails?: string[]
  collaboratorRoles?: Record<string, CollabRole>
  ownerEmail?: string
}

export function useCollaborativeNote(note: userInfo.Objects, active = true) {
  const { user, patchLocalObject } = useUserContext()
  const isOwner = note.owner_id === user?.id
  const myEmail = user?.email?.toLowerCase()

  const initialData = useMemo(() => safeParseJson(note.data) as NoteData, [note.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const [content, setContent] = useState(initialData.content ?? "")
  const [saving, setSaving] = useState(false)
  const [collaboratorEmails, setCollaboratorEmails] = useState(initialData.collaboratorEmails ?? [])
  const [pendingInviteEmails, setPendingInviteEmails] = useState(initialData.pendingInviteEmails ?? [])
  const [collaboratorRoles, setCollaboratorRoles] = useState(initialData.collaboratorRoles ?? {})
  const [ownerEmail, setOwnerEmail] = useState(initialData.ownerEmail)
  const [peers, setPeers] = useState<PeerState[]>([])

  // Owners always have full edit rights. A collaborator can edit unless
  // they've been explicitly set to "viewer" — absent = editor, so existing
  // collaborators (added before this feature existed) keep working as before.
  const canEdit = isOwner || !myEmail || (collaboratorRoles[myEmail] ?? "editor") === "editor"

  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sendSelection = useRef<((start: number, end: number) => void) | null>(null)

  // One Y.Doc per opened note, seeded from the last saved CRDT snapshot (or
  // migrated once from the plain-text `content` field for older notes).
  const ydoc = useMemo(() => {
    const doc = new Y.Doc()
    if (initialData.ydocState) applyEncodedState(doc, initialData.ydocState)
    else if (initialData.content) doc.getText("content").insert(0, initialData.content)
    return doc
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id])
  const ytext = ydoc.getText("content")

  // ── Live content relay + presence ────────────────────────────────────────
  // Gated by `active` — a collapsed InlineNote (see InfoTab.tsx) shouldn't
  // hold open a Realtime connection nobody's looking at. Because the channel
  // fully disconnects while inactive, re-activating (expanding) pulls the
  // latest saved snapshot first — otherwise edits another collaborator made
  // while this instance was collapsed (and so missed the broadcast) would
  // stay invisible until a full page reload.
  useEffect(() => {
    if (!active) return
    let cancelled = false

    // ytext is already seeded from initialData in the ydoc useMemo above, and
    // content's useState initializer mirrors that same initialData — so no
    // synchronous setContent is needed here. This fetch only *corrects*
    // content if the DB has moved on since (e.g. this instance was inactive
    // while a collaborator saved changes elsewhere).
    supabase.from("objects").select("data").eq("id", note.id).maybeSingle().then(({ data: row }) => {
      if (cancelled || !row) return
      const fresh = safeParseJson(row.data) as NoteData
      if (fresh.ydocState) applyEncodedState(ydoc, fresh.ydocState)
      setContent(ytext.toString())
    })

    const localPeer = {
      id: user?.id ?? "anon",
      name: user?.email ? nameForEmail(user.email) : "Guest",
      color: colorForId(user?.id ?? user?.email ?? "anon"),
    }

    const { updateSelection, disconnect } = connectNoteChannel(
      note.id, ydoc, localPeer,
      delta => {
        const el = textareaRef.current
        const hadFocus = el && document.activeElement === el
        const prevSel = hadFocus ? { start: el.selectionStart, end: el.selectionEnd } : null
        setContent(ytext.toString())
        if (el && prevSel) {
          const adjusted = adjustSelectionForDelta(delta, prevSel.start, prevSel.end)
          requestAnimationFrame(() => {
            el.selectionStart = adjusted.start
            el.selectionEnd = adjusted.end
          })
        }
      },
      setPeers,
    )
    sendSelection.current = updateSelection

    return () => { cancelled = true; sendSelection.current = null; disconnect() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id, active])

  // ── Live sharing sync — picks up accept/deny/invite made in another
  // session so an already-open note reflects "shared" without a reload.
  // Also gated by `active` for the same idle-connection reason as above.
  useEffect(() => {
    if (!active) return
    const channel = supabase
      .channel(`note-sharing-${note.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "objects", filter: `id=eq.${note.id}` }, payload => {
        const fresh = safeParseJson((payload.new as userInfo.Objects).data) as NoteData
        setCollaboratorEmails(fresh.collaboratorEmails ?? [])
        setPendingInviteEmails(fresh.pendingInviteEmails ?? [])
        setCollaboratorRoles(fresh.collaboratorRoles ?? {})
        if (fresh.ownerEmail) setOwnerEmail(fresh.ownerEmail)
        patchLocalObject(note.id, (payload.new as userInfo.Objects).data)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // patchLocalObject isn't memoized by UserContext (a fresh function every
    // render) — depending on it would tear down and resubscribe this channel
    // on every unrelated context update. It's stable in shape, just not identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id, active])

  // ── Merge-safe writes ─────────────────────────────────────────────────────
  // Goes through the `merge_object_data` Postgres RPC — `data = data || patch`
  // as one atomic statement, so a content autosave and a concurrent sharing
  // change (from this tab or someone else's) can never clobber each other no
  // matter how they interleave. A client-side read-then-write can't guarantee
  // that; Postgres's row lock during the UPDATE can.
  async function mergeWrite(patch: Partial<NoteData>) {
    // Self-healing denormalization: there's no profiles table to look up an
    // owner's email from their uuid (see ShareMenu.tsx's header comment), so
    // the owner's own client stamps it into the note on every write. Once a
    // note has been saved at least once since this shipped, every
    // collaborator/viewer can show "Owned by <email>" for free.
    const fullPatch = isOwner && user?.email ? { ...patch, ownerEmail: user.email } : patch
    const updated = await mergeObjectData(note.id, fullPatch)
    patchLocalObject(note.id, updated.data)
  }

  function scheduleSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      try { await mergeWrite({ content: ytext.toString(), ydocState: encodeDocState(ydoc) }) }
      catch (e) { console.error(e) }
      setSaving(false)
    }, 700)
  }

  function handleChange(next: string) {
    if (!canEdit) return
    applyTextDiff(ytext, next)  // local-origin transact — broadcasts to peers, doesn't loop back through the remote-delta path
    setContent(next)
    scheduleSave()
  }

  function handleSelectionChange(start: number, end: number) {
    sendSelection.current?.(start, end)
  }

  async function persistSharing(nextCollaboratorEmails: string[], nextPendingInviteEmails: string[], nextCollaboratorRoles?: Record<string, CollabRole>) {
    const roles = nextCollaboratorRoles ?? collaboratorRoles
    setCollaboratorEmails(nextCollaboratorEmails)
    setPendingInviteEmails(nextPendingInviteEmails)
    setCollaboratorRoles(roles)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    try { await mergeWrite({ collaboratorEmails: nextCollaboratorEmails, pendingInviteEmails: nextPendingInviteEmails, collaboratorRoles: roles }) }
    catch (e) { console.error(e) }
  }

  function handleInvite(email: string) {
    if (collaboratorEmails.includes(email) || pendingInviteEmails.includes(email)) return
    persistSharing(collaboratorEmails, [...pendingInviteEmails, email])
  }
  function handleCancelInvite(email: string) {
    persistSharing(collaboratorEmails, pendingInviteEmails.filter(e => e !== email))
  }
  function handleRemoveCollaborator(email: string) {
    const rest = { ...collaboratorRoles }
    delete rest[email]
    persistSharing(collaboratorEmails.filter(e => e !== email), pendingInviteEmails, rest)
  }
  function handleSetRole(email: string, role: CollabRole) {
    persistSharing(collaboratorEmails, pendingInviteEmails, { ...collaboratorRoles, [email]: role })
  }

  return {
    isOwner, canEdit, userId: user?.id ?? null, ownerEmail,
    content, handleChange,
    saving,
    collaboratorEmails, pendingInviteEmails, collaboratorRoles,
    handleInvite, handleCancelInvite, handleRemoveCollaborator, handleSetRole,
    textareaRef, peers, handleSelectionChange,
  }
}
