// ════════════════════════════════════════════════════════════════════════════
// MeditationModal.tsx — breathing timer + inspiring quotes, unlocked via the
// gamVIVIling shop same as 2048. Same modal chrome as TwentyFortyEightModal
// for consistency.
// ════════════════════════════════════════════════════════════════════════════

import { MeditationGame } from "./MeditationGame"

interface Props {
  onClose: () => void
}

export function MeditationModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-white/15 rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
          <span className="text-2xl">🧘</span>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-white">Meditation</p>
            <p className="text-xs text-white/40">No tokens, no wager, just breathing</p>
          </div>
          <button type="button" onClick={onClose}
            className="size-8 flex items-center justify-center rounded-md hover:bg-white/10 text-white/50 hover:text-white transition-colors">
            ✕
          </button>
        </div>

        <MeditationGame />
      </div>
    </div>
  )
}
