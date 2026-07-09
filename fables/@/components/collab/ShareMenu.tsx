// ════════════════════════════════════════════════════════════════════════════
// ShareMenu.tsx — one combined note-sharing menu, used by both NoteView.tsx
// and the character sheet's InlineNote (@/components/character/tabs/InfoTab.tsx)
//
// Invite is by exact email address — matches how the rest of the app already
// identifies people (party membership, ownership) — instead of a searchable
// username directory. There's deliberately no autocomplete/lookup-as-you-type:
// that would mean exposing a list of other users' emails to search against,
// which is a real user enumeration risk. You have to already know the email.
//
// Inviting doesn't grant access immediately — it adds the email to
// `pendingInviteEmails`; they see it in the notification bell
// (PendingInvitesBell) and have to Accept before they're added to
// `collaboratorEmails`. Denying just drops the pending entry, so the owner
// has to invite again to retry.
//
// The dropdown is portaled to <body> with a screen-position computed from the
// trigger button, so it never gets clipped by a note card's own overflow-hidden.
// Closes on click-outside (not onBlur) so the email <input> stays focusable.
// ════════════════════════════════════════════════════════════════════════════

import { useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useUserContext } from "../../../src/contexts/UserContext"
import { usePopoverPosition, useClickOutside } from "./usePortalMenu"
import type { CollabRole } from "./useCollaborativeNote"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface ShareMenuProps {
  isOwner: boolean
  ownerEmail?: string  // only knowable once the owner has saved at least once since this shipped — see useCollaborativeNote's mergeWrite
  collaboratorEmails: string[]
  pendingInviteEmails: string[]
  collaboratorRoles?: Record<string, CollabRole>
  onInvite: (email: string) => void
  onRemoveCollaborator: (email: string) => void
  onCancelInvite: (email: string) => void
  onSetRole?: (email: string, role: CollabRole) => void
  onUnlink?: () => void
  topSlot?: React.ReactNode  // e.g. an Edit/Preview toggle item, rendered above the sharing section
}

export function ShareMenu({
  isOwner, ownerEmail, collaboratorEmails, pendingInviteEmails, collaboratorRoles, onInvite, onRemoveCollaborator, onCancelInvite, onSetRole, onUnlink, topSlot,
}: ShareMenuProps) {
  const { user } = useUserContext()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const pos = usePopoverPosition(open, triggerRef)
  useClickOutside(open, () => setOpen(false), triggerRef, contentRef)

  const [emailInput, setEmailInput] = useState("")
  const [inviteError, setInviteError] = useState<string | null>(null)

  function handleInvite() {
    const email = emailInput.trim().toLowerCase()
    if (!EMAIL_RE.test(email)) { setInviteError("Enter a valid email address."); return }
    if (email === user?.email?.toLowerCase()) { setInviteError("That's your own email."); return }
    if (collaboratorEmails.includes(email) || pendingInviteEmails.includes(email)) { setInviteError("Already invited."); return }
    setInviteError(null)
    onInvite(email)
    setEmailInput("")
  }

  const hasSharing = collaboratorEmails.length > 0 || pendingInviteEmails.length > 0

  return (
    <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
      <button type="button" ref={triggerRef}
        onClick={() => setOpen(v => !v)}
        title="Note options"
        className={`text-xs size-6 flex items-center justify-center rounded-lg transition-colors ${hasSharing ? "text-purple-300 hover:bg-purple-500/10" : "text-white/40 hover:text-white hover:bg-white/10"}`}>
        {hasSharing ? "👥" : "⋮"}
      </button>
      {open && pos && createPortal(
        <div ref={contentRef} style={{ position: "fixed", top: pos.top, right: pos.right }}
          className="z-50 bg-zinc-900 border border-white/15 rounded-lg shadow-xl overflow-hidden w-64 animate-in fade-in zoom-in-95 duration-150">
          {topSlot}

          {isOwner && (
            <div className={topSlot ? "border-t border-white/10" : ""}>
              <div className="px-3 pt-2.5 pb-1.5 flex flex-col gap-1.5">
                <p className="text-[9px] uppercase tracking-widest text-white/30 font-semibold">Invite by email</p>
                <div className="flex items-center gap-1.5">
                  <input value={emailInput}
                    onChange={e => { setEmailInput(e.target.value); setInviteError(null) }}
                    onKeyDown={e => { if (e.key === "Enter") handleInvite() }}
                    placeholder="player@email.com"
                    className="flex-1 min-w-0 bg-white/10 rounded px-2 py-1 text-[11px] text-white outline-none placeholder:text-white/25 transition-colors focus:bg-white/15" />
                  <button type="button" onClick={handleInvite}
                    className="text-[11px] px-2 py-1 rounded bg-primary/80 hover:bg-primary text-white font-semibold transition-colors shrink-0">
                    Invite
                  </button>
                </div>
                {inviteError && <p className="text-[10px] text-red-300">{inviteError}</p>}
              </div>

              {hasSharing && (
                <div className="px-3 py-2 flex flex-col gap-1 max-h-28 overflow-y-auto border-t border-white/5">
                  {collaboratorEmails.map(email => {
                    const role = collaboratorRoles?.[email] ?? "editor"
                    return (
                      <div key={email} className="flex items-center justify-between text-[11px] text-white/70 gap-1.5">
                        <span className="truncate flex-1">{email}</span>
                        {onSetRole && (
                          <button type="button" onClick={() => onSetRole(email, role === "editor" ? "viewer" : "editor")}
                            title="Toggle edit access"
                            className={`text-[9px] px-1.5 py-0.5 rounded-full border shrink-0 transition-colors ${role === "editor" ? "border-purple-500/40 text-purple-300 hover:border-purple-400/60" : "border-white/15 text-white/40 hover:border-white/30"}`}>
                            {role === "editor" ? "Can edit" : "View only"}
                          </button>
                        )}
                        <button type="button" onClick={() => onRemoveCollaborator(email)}
                          className="text-white/30 hover:text-red-400 transition-colors shrink-0">Remove</button>
                      </div>
                    )
                  })}
                  {pendingInviteEmails.map(email => (
                    <div key={email} className="flex items-center justify-between text-[11px] text-amber-300/80">
                      <span className="truncate">{email} <span className="text-[9px] text-white/30">(pending)</span></span>
                      <button type="button" onClick={() => onCancelInvite(email)}
                        className="text-white/30 hover:text-red-400 transition-colors shrink-0 ml-2">Cancel</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!isOwner && (
            <div className="px-3 py-2 flex flex-col gap-1 border-t border-white/10">
              <p className="text-[10px] text-purple-300/70">
                {ownerEmail ? <>Owned by <span className="font-semibold">{ownerEmail}</span></> : "You're collaborating on this note"}
              </p>
              {collaboratorEmails.filter(e => e !== user?.email?.toLowerCase()).length > 0 && (
                <p className="text-[9px] text-white/30 truncate">
                  Also with: {collaboratorEmails.filter(e => e !== user?.email?.toLowerCase()).join(", ")}
                </p>
              )}
            </div>
          )}

          {onUnlink && (
            <button type="button" onClick={() => { setOpen(false); onUnlink() }}
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
