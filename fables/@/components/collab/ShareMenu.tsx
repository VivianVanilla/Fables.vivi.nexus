// ════════════════════════════════════════════════════════════════════════════
// ShareMenu.tsx — one combined note-sharing menu, used by both NoteView.tsx
// and the character sheet's InlineNote (@/components/character/tabs/InfoTab.tsx)
//
// Invite is username-based (see ./profiles.ts) instead of the old party-code
// matching. Inviting doesn't grant access immediately — it adds the user to
// `pendingInviteIds`; they see it in the notification bell (PendingInvitesBell)
// and have to Accept before they're added to `collaboratorIds`. Denying just
// drops the pending entry, so the owner has to invite again to retry.
//
// The dropdown is portaled to <body> with a screen-position computed from the
// trigger button, so it never gets clipped by a note card's own overflow-hidden.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useUserContext } from "../../../src/contexts/UserContext"
import { searchUsernames, getUsernames, type Profile } from "./profiles"

function usePopoverPosition(open: boolean, triggerRef: React.RefObject<HTMLElement | null>) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  useEffect(() => {
    if (!open || !triggerRef.current) { setPos(null); return }
    const rect = triggerRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + 4, right: Math.max(4, window.innerWidth - rect.right) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  return pos
}

interface ShareMenuProps {
  isOwner: boolean
  collaboratorIds: string[]
  pendingInviteIds: string[]
  onInvite: (userId: string) => void
  onRemoveCollaborator: (userId: string) => void
  onCancelInvite: (userId: string) => void
  onUnlink?: () => void
  topSlot?: React.ReactNode  // e.g. an Edit/Preview toggle item, rendered above the sharing section
}

export function ShareMenu({
  isOwner, collaboratorIds, pendingInviteIds, onInvite, onRemoveCollaborator, onCancelInvite, onUnlink, topSlot,
}: ShareMenuProps) {
  const { user } = useUserContext()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const pos = usePopoverPosition(open, triggerRef)

  const [query, setQuery]       = useState("")
  const [results, setResults]   = useState<Profile[]>([])
  const [searching, setSearching] = useState(false)
  const [names, setNames]       = useState<Record<string, string>>({})

  const idsKey = [...collaboratorIds, ...pendingInviteIds].join(",")
  useEffect(() => {
    if (!open || !idsKey) return
    getUsernames(idsKey.split(",")).then(setNames)
  }, [open, idsKey])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    setSearching(true)
    const t = setTimeout(() => {
      searchUsernames(query, user?.id).then(r => { setResults(r); setSearching(false) })
    }, 250)
    return () => clearTimeout(t)
  }, [query, user?.id])

  const hasSharing = collaboratorIds.length > 0 || pendingInviteIds.length > 0

  return (
    <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
      <button type="button" ref={triggerRef}
        onClick={() => setOpen(v => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        title="Note options"
        className={`text-xs size-6 flex items-center justify-center rounded-lg transition-colors ${hasSharing ? "text-purple-300 hover:bg-purple-500/10" : "text-white/40 hover:text-white hover:bg-white/10"}`}>
        {hasSharing ? "👥" : "⋮"}
      </button>
      {open && pos && createPortal(
        <div style={{ position: "fixed", top: pos.top, right: pos.right }}
          className="z-50 bg-zinc-900 border border-white/15 rounded-lg shadow-xl overflow-hidden w-64 animate-in fade-in zoom-in-95 duration-150"
          onMouseDown={e => e.preventDefault()}>
          {topSlot}

          {isOwner && (
            <div className={topSlot ? "border-t border-white/10" : ""}>
              <div className="px-3 pt-2.5 pb-1.5">
                <p className="text-[9px] uppercase tracking-widest text-white/30 font-semibold mb-1">Invite by username</p>
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="username…" autoFocus={false}
                  className="w-full bg-white/10 rounded px-2 py-1 text-[11px] text-white outline-none placeholder:text-white/25 transition-colors focus:bg-white/15" />
              </div>
              {query.trim() && (
                <div className="max-h-28 overflow-y-auto flex flex-col border-b border-white/5">
                  {searching && <p className="px-3 py-1.5 text-[11px] text-white/30">Searching…</p>}
                  {!searching && results.length === 0 && (
                    <p className="px-3 py-1.5 text-[11px] text-white/30 italic">No matching users.</p>
                  )}
                  {results.map(r => {
                    const already = collaboratorIds.includes(r.id) || pendingInviteIds.includes(r.id)
                    return (
                      <button key={r.id} type="button" disabled={already}
                        onClick={() => { onInvite(r.id); setQuery("") }}
                        className="w-full text-left px-3 py-1.5 text-[11px] text-white/70 hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-default flex items-center justify-between">
                        @{r.username}
                        {already && <span className="text-[9px] text-white/30">already invited</span>}
                      </button>
                    )
                  })}
                </div>
              )}

              {hasSharing && (
                <div className="px-3 py-2 flex flex-col gap-1 max-h-28 overflow-y-auto">
                  {collaboratorIds.map(id => (
                    <div key={id} className="flex items-center justify-between text-[11px] text-white/70">
                      <span>@{names[id] ?? "…"}</span>
                      <button type="button" onClick={() => onRemoveCollaborator(id)}
                        className="text-white/30 hover:text-red-400 transition-colors">Remove</button>
                    </div>
                  ))}
                  {pendingInviteIds.map(id => (
                    <div key={id} className="flex items-center justify-between text-[11px] text-amber-300/80">
                      <span>@{names[id] ?? "…"} <span className="text-[9px] text-white/30">(pending)</span></span>
                      <button type="button" onClick={() => onCancelInvite(id)}
                        className="text-white/30 hover:text-red-400 transition-colors">Cancel</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!isOwner && collaboratorIds.length > 0 && (
            <p className="px-3 py-2 text-[10px] text-purple-300/70 border-t border-white/10">You're collaborating on this note</p>
          )}

          {onUnlink && (
            <button type="button" onMouseDown={e => { e.preventDefault(); setOpen(false); onUnlink() }}
              className="w-full text-left px-3 py-2 text-xs text-red-300 hover:bg-red-500/10 transition-colors border-t border-white/10">
              Unlink note
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
