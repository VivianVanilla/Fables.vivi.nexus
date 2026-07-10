// ════════════════════════════════════════════════════════════════════════════
// DiceRollGame.tsx — wager tokens, pick a number 1-6, exact match pays 6x
// ════════════════════════════════════════════════════════════════════════════

import { useState } from "react"
import { useGamblingWallet } from "./useGamblingWallet"
import { rollDie, DICE_PAYOUT_MULTIPLIER } from "./gamblingLogic"
import { WagerStepper } from "./WagerStepper"

const DICE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"]

export function DiceRollGame() {
  const { tokens, settleWager } = useGamblingWallet()
  const [wager, setWager] = useState(1)
  const [pick, setPick] = useState(1)
  const [rolling, setRolling] = useState(false)
  const [result, setResult] = useState<{ roll: number; won: boolean } | null>(null)

  const canPlay = !rolling && wager >= 1 && wager <= tokens

  async function play() {
    if (!canPlay) return
    setRolling(true)
    setResult(null)
    const roll = rollDie()
    const won = roll === pick
    setTimeout(async () => {
      await settleWager(wager, won ? DICE_PAYOUT_MULTIPLIER : 0)
      setResult({ roll, won })
      setRolling(false)
    }, 700)
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className={`size-20 rounded-2xl flex items-center justify-center text-5xl border-2 transition-all ${
        rolling ? "animate-bounce border-white/30" : result?.won ? "border-emerald-400 bg-emerald-500/10" : result ? "border-red-400 bg-red-500/10" : "border-white/15"
      }`}>
        {result && !rolling ? DICE_FACES[result.roll - 1] : "🎲"}
      </div>

      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5, 6].map(n => (
          <button key={n} type="button" onClick={() => setPick(n)} disabled={rolling}
            className={`size-8 rounded-lg text-sm font-bold transition-colors ${pick === n ? "bg-primary/80 text-white" : "bg-white/10 text-white/50 hover:bg-white/20 hover:text-white"}`}>
            {n}
          </button>
        ))}
      </div>

      <WagerStepper wager={wager} onChange={setWager} maxTokens={Math.max(1, tokens)} />

      <button type="button" onClick={play} disabled={!canPlay}
        className="text-sm font-semibold px-5 py-2 rounded-xl bg-primary/80 hover:bg-primary text-white transition-colors disabled:opacity-30">
        {rolling ? "Rolling…" : `Roll (pays ${DICE_PAYOUT_MULTIPLIER}x)`}
      </button>

      {result && !rolling && (
        <p className={`text-sm font-bold ${result.won ? "text-emerald-300" : "text-red-300"}`}>
          {result.won
            ? `Rolled ${result.roll}! You won ${wager * DICE_PAYOUT_MULTIPLIER} tokens.`
            : `Rolled ${result.roll} — you lost ${wager}.`}
        </p>
      )}

      {tokens < 1 && <p className="text-xs text-white/30 italic">Not enough tokens to play.</p>}
    </div>
  )
}
