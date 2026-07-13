// ════════════════════════════════════════════════════════════════════════════
// WagerStepper.tsx — shared wager control used by every mini-game: +/- 1,
// Max, and a direct numeric field so a bet isn't limited to clicking one
// token at a time.
// ════════════════════════════════════════════════════════════════════════════

import { NumInput } from "../character/ui/NumInput"

interface Props {
  wager: number
  onChange: (next: number) => void
  maxTokens: number
  disabled?: boolean
}

export function WagerStepper({ wager, onChange, maxTokens, disabled }: Props) {
  const clamp = (n: number) => Math.max(1, Math.min(maxTokens || 1, n))

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-white/40 uppercase tracking-widest">Wager</span>
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => onChange(clamp(wager - 1))} disabled={disabled || wager <= 1}
          className="size-7 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm flex items-center justify-center disabled:opacity-30 transition-colors">−</button>
        <NumInput value={wager} min={1} disabled={disabled}
          onFocus={e => e.target.select()}
          onChange={e => onChange(clamp(parseInt(e.target.value) || 1))}
          className="w-16 text-center bg-white/10 rounded-lg py-1 text-sm font-bold text-white outline-none tabular-nums disabled:opacity-50"
        />
        <button type="button" onClick={() => onChange(clamp(wager + 1))} disabled={disabled || wager >= maxTokens}
          className="size-7 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm flex items-center justify-center disabled:opacity-30 transition-colors">+</button>
      </div>
      <button type="button" onClick={() => onChange(clamp(maxTokens))} disabled={disabled}
        className="text-[10px] px-2 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white/50 hover:text-white transition-colors disabled:opacity-30">
        Max
      </button>
    </div>
  )
}
