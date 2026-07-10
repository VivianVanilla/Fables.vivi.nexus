// ════════════════════════════════════════════════════════════════════════════
// CoinFlipGame.tsx — wager tokens, call heads/tails, double-or-nothing
// ════════════════════════════════════════════════════════════════════════════

import { useState } from "react"
import { useGamblingWallet } from "./useGamblingWallet"
import { flipCoin, type CoinSide } from "./gamblingLogic"
import { WagerStepper } from "./WagerStepper"

export function CoinFlipGame() {
  const { tokens, spend, credit } = useGamblingWallet()
  const [wager, setWager] = useState(1)
  const [call, setCall] = useState<CoinSide>("heads")
  const [flipping, setFlipping] = useState(false)
  const [result, setResult] = useState<{ side: CoinSide; won: boolean } | null>(null)

  const canPlay = !flipping && wager >= 1 && wager <= tokens

  async function play() {
    if (!canPlay) return
    setFlipping(true)
    setResult(null)
    await spend(wager)
    const side = flipCoin()
    const won = side === call
    setTimeout(async () => {
      if (won) await credit(wager * 2)
      setResult({ side, won })
      setFlipping(false)
    }, 700)
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className={`size-20 rounded-full flex items-center justify-center text-4xl border-2 transition-all ${
        flipping ? "animate-spin border-white/30" : result?.won ? "border-emerald-400 bg-emerald-500/10" : result ? "border-red-400 bg-red-500/10" : "border-white/15"
      }`}>
        {flipping ? "🪙" : result ? (result.side === "heads" ? "👑" : "🌀") : "🪙"}
      </div>

      <div className="flex items-center gap-1 rounded-full bg-white/10 p-0.5">
        {(["heads", "tails"] as CoinSide[]).map(side => (
          <button key={side} type="button" onClick={() => setCall(side)} disabled={flipping}
            className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-colors capitalize ${call === side ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70"}`}>
            {side}
          </button>
        ))}
      </div>

      <WagerStepper wager={wager} onChange={setWager} maxTokens={Math.max(1, tokens)} />

      <button type="button" onClick={play} disabled={!canPlay}
        className="text-sm font-semibold px-5 py-2 rounded-xl bg-primary/80 hover:bg-primary text-white transition-colors disabled:opacity-30">
        {flipping ? "Flipping…" : "Flip"}
      </button>

      {result && !flipping && (
        <p className={`text-sm font-bold ${result.won ? "text-emerald-300" : "text-red-300"}`}>
          {result.won
            ? `It's ${result.side}! You won ${wager * 2} tokens.`
            : `It's ${result.side} — you lost ${wager}.`}
        </p>
      )}

      {tokens < 1 && <p className="text-xs text-white/30 italic">Not enough tokens to play.</p>}
    </div>
  )
}
