// ════════════════════════════════════════════════════════════════════════════
// NpcQuickViewModal.tsx — small self-contained popup for a `[[Name]]` mention
// (see linkifyNpcMentions/Markdown's onInternalLink). Layers on top of
// whatever's already open (the NPC Tracker shelf, a Detail Notes view, …)
// without disturbing it — closing the popup just returns to that unchanged.
// A link inside this popup's own details swaps which NPC it's showing
// instead of stacking a second popup.
// ════════════════════════════════════════════════════════════════════════════

import { BookOpen, MapPin } from "lucide-react"
import { Modal } from "@/components/shared/ui/Modal"
import { Markdown } from "../ui/Markdown"
import { linkifyNpcMentions, type NpcTracker } from "./useNpcTrackers"

export function NpcQuickViewModal({
  npc, npcs, locationName, onClose, onSelectNpc,
}: {
  npc: NpcTracker
  npcs: Pick<NpcTracker, "id" | "name">[]
  locationName: string | null
  onClose: () => void
  onSelectNpc: (id: string) => void
}) {
  function handleInternalLink(target: string) {
    if (!target.startsWith("npc:")) return
    onSelectNpc(target.slice("npc:".length))
  }

  return (
    <Modal onClose={onClose}>
      <div className="w-[min(90vw,28rem)] max-h-[85vh] overflow-y-auto rounded-xl bg-zinc-900 border border-white/10 shadow-2xl">
        <div className="flex items-start gap-3 p-4 border-b border-white/10">
          <div className="size-14 rounded-lg overflow-hidden bg-white/10 border border-white/10 shrink-0 flex items-center justify-center">
            {npc.image_url ? (
              <img src={npc.image_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <BookOpen className="size-5 text-white/30" />
            )}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="text-base font-bold text-white truncate">{npc.name}</h3>
            {npc.subtitle && <p className="text-xs italic text-white/50 truncate">{npc.subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="text-white/50 hover:text-white text-lg leading-none px-1 shrink-0">✕</button>
        </div>

        <div className="p-4 space-y-3">
          {npc.details ? (
            <Markdown text={linkifyNpcMentions(npc.details, npcs)} tone="dark" size="sm" onInternalLink={handleInternalLink} />
          ) : (
            <p className="text-sm text-white/30 italic">No details yet.</p>
          )}
          {(locationName || npc.goal) && (
            <div className="flex gap-6 flex-wrap pt-1 border-t border-white/10">
              {locationName && (
                <div className="pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40 mb-0.5">Last Seen At</p>
                  <p className="flex items-center gap-1 text-xs text-white/80"><MapPin className="size-3 text-violet-300/80" /> {locationName}</p>
                </div>
              )}
              {npc.goal && (
                <div className="pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40 mb-0.5">Goal? How can they help?</p>
                  <p className="text-xs text-white/80">{npc.goal}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
