// ════════════════════════════════════════════════════════════════════════════
// WagerStepper.tsx — shared wager +/- control used by all 3 mini-games
// ════════════════════════════════════════════════════════════════════════════

interface Props {
  wager: number
  onChange: (next: number) => void
  maxTokens: number
}

export function WagerStepper({ wager, onChange, maxTokens }: Props) {
  const clamp = (n: number) => Math.max(1, Math.min(maxTokens || 1, n))

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-white/40 uppercase tracking-widest">Wager</span>
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => onChange(clamp(wager - 1))} disabled={wager <= 1}
          className="size-7 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm flex items-center justify-center disabled:opacity-30 transition-colors">−</button>
        <span className="text-sm font-bold text-white w-8 text-center tabular-nums">{wager}</span>
        <button type="button" onClick={() => onChange(clamp(wager + 1))} disabled={wager >= maxTokens}
          className="size-7 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm flex items-center justify-center disabled:opacity-30 transition-colors">+</button>
      </div>
      <button type="button" onClick={() => onChange(clamp(maxTokens))}
        className="text-[10px] px-2 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white/50 hover:text-white transition-colors">
        Max
      </button>
    </div>
  )
}
