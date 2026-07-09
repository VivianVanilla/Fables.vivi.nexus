// ════════════════════════════════════════════════════════════════════════════
// PendingInvitesBell.tsx — "someone invited you to a note" notification
//
// Lives in the sidebar header (next to the "+ Create" button). Polls for
// objects of type "note" where our own email is listed in data.pendingInviteEmails.
// Accept moves you from pendingInviteEmails into collaboratorEmails (and the
// note shows up in your own sidebar, linkable to any character the same way
// as any other note). Deny just drops the pending entry — there's no
// persistent "denied" record, so the owner has to invite you again to retry.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Bell } from "lucide-react"
import { useUserContext } from "../../../src/contexts/UserContext"
import { supabase } from "../../../src/supabase"
import { safeParseJson } from "../character-utils"

const MENU_WIDTH = 288  // matches the dropdown's w-72
const EDGE_MARGIN = 8

interface NoteData {
  content?: string
  ydocState?: string
  collaboratorEmails?: string[]
  pendingInviteEmails?: string[]
}

interface InviteRow {
  id: string
  name: string
}

const POLL_MS = 20000

export function PendingInvitesBell() {
  const { user, updateSharedObject, refreshObjects } = useUserContext()
  const [open, setOpen] = useState(false)
  const [invites, setInvites] = useState<InviteRow[]>([])
  const [errorId, setErrorId] = useState<string | null>(null)
  const [respondingId, setRespondingId] = useState<string | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  const myEmail = user?.email?.toLowerCase()

  async function load() {
    if (!myEmail) return
    const { data, error } = await supabase
      .from("objects").select("id, name, owner_id")
      .eq("type", "note")
      .neq("owner_id", user?.id ?? "")
      .filter("data->pendingInviteEmails", "cs", JSON.stringify([myEmail]))
    if (error) { console.error("pending invites fetch failed (RLS not set up yet?)", error); return }
    setInvites(((data ?? []) as { id: string; name: string }[]).map(r => ({ id: r.id, name: r.name })))
  }

  useEffect(() => { load() }, [myEmail])
  useEffect(() => {
    const t = setInterval(load, POLL_MS)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myEmail])

  function handleToggle() {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      // Anchor to the trigger's left edge, but clamp so the menu never runs
      // off either side of the viewport (the bell sits near the sidebar's
      // left edge, so right-anchoring pushed the dropdown off-screen).
      const left = Math.min(
        Math.max(EDGE_MARGIN, rect.left),
        window.innerWidth - MENU_WIDTH - EDGE_MARGIN
      )
      setPos({ top: rect.bottom + 6, left })
      load()
    }
    setOpen(v => !v)
  }

  async function respond(noteId: string, accept: boolean) {
    setErrorId(null)
    setRespondingId(noteId)
    const { data: row, error } = await supabase.from("objects").select("data").eq("id", noteId).maybeSingle()
    if (error || !row || !myEmail) { setRespondingId(null); setErrorId(noteId); return }
    const noteData = safeParseJson(row.data) as NoteData
    const pending = (noteData.pendingInviteEmails ?? []).filter(e => e !== myEmail)
    const collaborators = accept ? [...(noteData.collaboratorEmails ?? []), myEmail] : (noteData.collaboratorEmails ?? [])
    try {
      await updateSharedObject(noteId, { data: { ...noteData, pendingInviteEmails: pending, collaboratorEmails: collaborators } as unknown as JSON })
      // Only drop it from the bell once the write is confirmed — clearing it
      // optimistically meant a failed accept (e.g. RLS not yet granted)
      // silently vanished, then reappeared on the next poll looking "stuck
      // pending" even though the user had already clicked Accept.
      setInvites(prev => prev.filter(i => i.id !== noteId))
      if (accept) await refreshObjects()
    } catch (e) {
      console.error(e)
      setErrorId(noteId)
    } finally {
      setRespondingId(null)
    }
  }

  return (
    <div className="relative">
      <button type="button" ref={triggerRef} onClick={handleToggle}
        title="Note invites"
        className={`relative flex items-center justify-center size-9 rounded-md border transition-colors ${invites.length > 0 ? "border-purple-500/40 text-purple-300 hover:bg-purple-500/10" : "border-input text-muted-foreground hover:bg-accent"}`}>
        <Bell className="size-4" />
        {invites.length > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center size-4 rounded-full bg-purple-500 text-white text-[9px] font-bold animate-in fade-in zoom-in-50 duration-200">
            {invites.length}
          </span>
        )}
      </button>
      {open && pos && createPortal(
        <div style={{ position: "fixed", top: pos.top, left: pos.left }}
          className="z-50 bg-zinc-900 border border-white/15 rounded-lg shadow-xl overflow-hidden w-72 animate-in fade-in zoom-in-95 duration-150 text-white">
          <p className="px-3 pt-2.5 pb-1.5 text-[10px] uppercase tracking-widest text-white/40 font-semibold">Note Invites</p>
          {invites.length === 0 ? (
            <p className="px-3 pb-3 text-xs text-white/30 italic">No pending invites.</p>
          ) : (
            <div className="flex flex-col max-h-72 overflow-y-auto">
              {invites.map(inv => (
                <div key={inv.id} className="px-3 py-2 border-t border-white/5 flex flex-col gap-1.5">
                  <p className="text-xs text-white/80">
                    You've been invited to collaborate on <span className="font-semibold">{inv.name}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => respond(inv.id, true)} disabled={respondingId === inv.id}
                      className="flex-1 text-[11px] py-1 rounded bg-purple-600/80 hover:bg-purple-600 text-white font-semibold transition-colors disabled:opacity-50">
                      {respondingId === inv.id ? "…" : "Accept"}
                    </button>
                    <button type="button" onClick={() => respond(inv.id, false)} disabled={respondingId === inv.id}
                      className="flex-1 text-[11px] py-1 rounded bg-white/10 hover:bg-white/20 text-white/60 transition-colors disabled:opacity-50">
                      {respondingId === inv.id ? "…" : "Deny"}
                    </button>
                  </div>
                  {errorId === inv.id && (
                    <p className="text-[10px] text-red-300">Couldn't reach the note — try again.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
