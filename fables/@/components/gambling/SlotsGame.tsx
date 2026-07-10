// ════════════════════════════════════════════════════════════════════════════
// SlotsGame.tsx — wager tokens, spin 3 reels; 3-of-a-kind pays a multiplier,
// 2-of-a-kind is a push (wager back), otherwise the wager is lost.
// ════════════════════════════════════════════════════════════════════════════

import { useState } from "react"
import { useGamblingWallet } from "./useGamblingWallet"
import { spinSlots, slotPayoutMultiplier, SLOT_SYMBOLS, type SlotSymbol } from "./gamblingLogic"
import { WagerStepper } from "./WagerStepper"

export function SlotsGame() {
  const { tokens, spend, credit } = useGamblingWallet()
  const [wager, setWager] = useState(1)
  const [spinning, setSpinning] = useState(false)
  const [reels, setReels] = useState<SlotSymbol[]>([SLOT_SYMBOLS[0], SLOT_SYMBOLS[0], SLOT_SYMBOLS[0]])
  const [result, setResult] = useState<{ multiplier: number } | null>(null)

  const canPlay = !spinning && wager >= 1 && wager <= tokens

  async function play() {
    if (!canPlay) return
    setSpinning(true)
    setResult(null)
    await spend(wager)
    const spun = spinSlots()
    const multiplier = slotPayoutMultiplier(spun)
    setTimeout(async () => {
      setReels(spun)
      if (multiplier > 0) await credit(wager * multiplier)
      setResult({ multiplier })
      setSpinning(false)
    }, 800)
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="flex items-center gap-2">
        {reels.map((sym, i) => (
          <div key={i} className={`size-16 rounded-xl flex items-center justify-center text-3xl border-2 transition-all ${
            spinning ? "animate-pulse border-white/30" : result && result.multiplier > 1 ? "border-emerald-400 bg-emerald-500/10" : result && result.multiplier === 1 ? "border-amber-400 bg-amber-500/10" : result ? "border-red-400 bg-red-500/10" : "border-white/15"
          }`}>
            {sym.emoji}
          </div>
        ))}
      </div>

      <WagerStepper wager={wager} onChange={setWager} maxTokens={Math.max(1, tokens)} />

      <button type="button" onClick={play} disabled={!canPlay}
        className="text-sm font-semibold px-5 py-2 rounded-xl bg-primary/80 hover:bg-primary text-white transition-colors disabled:opacity-30">
        {spinning ? "Spinning…" : "Spin"}
      </button>

      {result && !spinning && (
        <p className={`text-sm font-bold ${result.multiplier > 1 ? "text-emerald-300" : result.multiplier === 1 ? "text-amber-300" : "text-red-300"}`}>
          {result.multiplier > 1
            ? `Jackpot! ${result.multiplier}x — you won ${wager * result.multiplier} tokens.`
            : result.multiplier === 1
            ? `Push — you got your ${wager} back.`
            : `No match — you lost ${wager}.`}
        </p>
      )}

      <p className="text-[10px] text-white/25 text-center max-w-xs">
        {SLOT_SYMBOLS.map(s => `${s.emoji}×3 = ${s.multiplier}x`).join("  ·  ")}  ·  any pair = push
      </p>

      {tokens < 1 && <p className="text-xs text-white/30 italic">Not enough tokens to play.</p>}
    </div>
  )
}
