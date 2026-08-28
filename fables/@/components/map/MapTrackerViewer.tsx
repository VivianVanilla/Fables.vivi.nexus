// ════════════════════════════════════════════════════════════════════════════
// MapTrackerViewer.tsx — full-screen viewer for a single tracker (an NPC,
// monster, or anything else the party is keeping tabs on), opened by
// clicking its marker on MapOverlay. Mirrors MapPinViewer: renaming,
// deleting, and annotating (MapNotesPanel) are all open to the whole party —
// that's how you keep tabs on an NPC as a group.
// ════════════════════════════════════════════════════════════════════════════

import { useState } from "react"
import { Pencil, Trash2, Check, X } from "lucide-react"
import { type MapToken, type MapPinNote } from "./useMapBoard"
import { MapNotesPanel } from "./MapNotesPanel"
import { Markdown } from "../ui/Markdown"
import type { NpcTracker } from "../npcTracker/useNpcTrackers"

export function MapTrackerViewer({
  tracker, notes, npc, npcLocationName, currentUserId, onClose, onRename, onDeleteTracker, onAddNote, onEditNote, onDeleteNote,
}: {
  tracker: MapToken
  notes: MapPinNote[]
  // Set when this tracker was placed by linking an entry from the NPC
  // Tracker shelf (see @/components/npcTracker) — pulls in the info that
  // lives on the shared NPC record instead of just the marker's own name/
  // image. Renaming the marker here does NOT rename the NPC entry itself.
  npc: NpcTracker | null
  // Resolved name of npc.location_pin_id, if any — a plain string rather
  // than handing this viewer the whole pins list just to look one up.
  npcLocationName: string | null
  currentUserId: string
  onClose: () => void
  onRename: (name: string) => void
  onDeleteTracker: () => void
  onAddNote: (content: string) => void
  onEditNote: (id: string, content: string) => void
  onDeleteNote: (id: string) => void
}) {
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(tracker.name ?? "")
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  function saveName() {
    const next = nameDraft.trim()
    if (next && next !== tracker.name) onRename(next)
    setEditingName(false)
  }

  // backdrop-blur-xs, not -sm — lighter compositing/blur cost, matters most
  // on mobile GPUs; same backdrop look (see Modal.tsx's matching comment).
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-xs" onClick={onClose}>
      <div className="flex items-center justify-between px-5 py-3 shrink-0" onClick={e => e.stopPropagation()}>
        {editingName ? (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus value={nameDraft} onChange={e => setNameDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setNameDraft(tracker.name ?? ""); setEditingName(false) } }}
              className="text-sm font-semibold bg-white/10 text-white rounded-lg px-2.5 py-1.5 outline-none"
            />
            <button type="button" onClick={saveName} className="size-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"><Check className="size-4" /></button>
            <button type="button" onClick={() => { setNameDraft(tracker.name ?? ""); setEditingName(false) }} className="size-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"><X className="size-4" /></button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="size-7 rounded-full overflow-hidden border border-white/20 shrink-0 bg-black/40">
              <img src={tracker.image_url ?? ""} alt="" className="w-full h-full object-cover" />
            </div>
            <span className="text-sm font-semibold text-white">{tracker.name}</span>
            <button type="button" onClick={() => setEditingName(true)} title="Rename"
              className="text-white/50 hover:text-white transition-colors">
              <Pencil className="size-3.5" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          {confirmingDelete ? (
            <div className="flex items-center gap-1 text-xs">
              <span className="text-white/70 mr-0.5">Remove tracker?</span>
              <button type="button" onClick={onDeleteTracker}
                className="px-2 py-1 rounded-lg bg-red-500/80 hover:bg-red-500 text-white font-semibold transition-colors">Delete</button>
              <button type="button" onClick={() => setConfirmingDelete(false)}
                className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 transition-colors">Cancel</button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmingDelete(true)} title="Remove tracker"
              className="size-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-red-500/30 text-white/70 hover:text-red-200 transition-colors">
              <Trash2 className="size-4" />
            </button>
          )}
          <button type="button" onClick={onClose} className="ml-1 text-white/60 hover:text-white text-lg leading-none px-1">✕</button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5" onClick={e => e.stopPropagation()}>
        {npc && (
          <div className="max-w-xl mx-auto mt-2 mb-5 rounded-xl bg-white/5 border border-white/10 p-4">
            {npc.subtitle && <p className="text-sm italic text-white/60 mb-2">{npc.subtitle}</p>}
            {npc.details ? (
              <Markdown text={npc.details} tone="dark" size="sm" className="mb-3" />
            ) : (
              <p className="text-sm text-white/30 italic mb-3">No details yet — add some from the NPC Tracker shelf.</p>
            )}
            <div className="flex gap-6 flex-wrap">
              {npcLocationName && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40 mb-0.5">Last Seen At</p>
                  <p className="text-xs text-white/80">{npcLocationName}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40 mb-0.5">Goal? How can they help?</p>
                <p className="text-xs text-white/80">{npc.goal || "—"}</p>
              </div>
            </div>
          </div>
        )}
        <MapNotesPanel
          notes={notes}
          currentUserId={currentUserId}
          placeholder={`Notes about ${tracker.name}…`}
          onAddNote={onAddNote}
          onEditNote={onEditNote}
          onDeleteNote={onDeleteNote}
        />
      </div>
    </div>
  )
}
