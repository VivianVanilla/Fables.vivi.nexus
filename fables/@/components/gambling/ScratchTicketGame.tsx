// ════════════════════════════════════════════════════════════════════════════
// ScratchTicketGame.tsx — wager tokens, buy a 9-panel bomb/diamond scratch
// ticket, click each panel to reveal it. 💎 builds up the payout, 💣 knocks
// a bigger chunk off it. You can cash out after any reveal to lock in the
// current running total — walk away once you're up instead of risking the
// panels you haven't scratched yet — or keep going until the ticket is fully
// revealed, which settles automatically.
// ════════════════════════════════════════════════════════════════════════════

import { useState } from "react"
import { useGamblingWallet } from "./useGamblingWallet"
import { generateScratchGrid, scratchPayoutMultiplier, type ScratchCell } from "./scratchLogic"
import { WagerStepper } from "./WagerStepper"

type Phase = "betting" | "scratching" | "done"

export function ScratchTicketGame() {
  const { tokens, settleWager } = useGamblingWallet()
  const [wager, setWager] = useState(1)
  const [phase, setPhase] = useState<Phase>("betting")
  const [grid, setGrid] = useState<ScratchCell[]>([])
  const [revealed, setRevealed] = useState<boolean[]>([])
  const [outcome, setOutcome] = useState<{ multiplier: number } | null>(null)

  const canBuy = phase === "betting" && wager >= 1 && wager <= tokens

  function buyTicket() {
    if (!canBuy) return
    setGrid(generateScratchGrid())
    setRevealed(Array(9).fill(false))
    setOutcome(null)
    setPhase("scratching")
  }

  async function scratch(i: number) {
    if (phase !== "scratching" || revealed[i]) return
    const next = [...revealed]
    next[i] = true
    setRevealed(next)
    if (next.every(Boolean)) {
      const multiplier = scratchPayoutMultiplier(grid)
      await settleWager(wager, multiplier)
      setOutcome({ multiplier })
      setPhase("done")
    }
  }

  function revealAll() {
    if (phase !== "scratching") return
    setRevealed(Array(9).fill(true))
    const multiplier = scratchPayoutMultiplier(grid)
    settleWager(wager, multiplier).then(() => {
      setOutcome({ multiplier })
      setPhase("done")
    })
  }

  function cashOut() {
    if (phase !== "scratching" || !revealed.some(Boolean)) return
    const multiplier = scratchPayoutMultiplier(grid.filter((_, i) => revealed[i]))
    settleWager(wager, multiplier).then(() => {
      setOutcome({ multiplier })
      setPhase("done")
    })
  }

  function newTicket() {
    setGrid([])
    setRevealed([])
    setOutcome(null)
    setPhase("betting")
  }

  const diamondsSoFar = grid.filter((c, i) => c === "diamond" && revealed[i]).length
  const bombsSoFar = grid.filter((c, i) => c === "bomb" && revealed[i]).length
  const currentMultiplier = scratchPayoutMultiplier(grid.filter((_, i) => revealed[i]))
  const payout = outcome ? Math.round(wager * outcome.multiplier) : 0

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="grid grid-cols-3 gap-2">
        {(phase === "betting" ? Array(9).fill(null) : grid).map((cell, i) => {
          const isRevealed = phase !== "betting" && revealed[i]
          return (
            <button
              key={i}
              type="button"
              onClick={() => scratch(i)}
              disabled={phase !== "scratching" || isRevealed}
              className={`size-14 rounded-xl flex items-center justify-center text-2xl border-2 transition-all ${
                isRevealed
                  ? cell === "bomb"
                    ? "border-red-400 bg-red-500/10 animate-in fade-in zoom-in-90 duration-200"
                    : "border-emerald-400 bg-emerald-500/10 animate-in fade-in zoom-in-90 duration-200"
                  : "border-white/15 bg-white/10 hover:bg-white/15 disabled:hover:bg-white/10"
              }`}
            >
              {isRevealed ? (cell === "bomb" ? "💣" : "💎") : phase === "betting" ? "" : "🎫"}
            </button>
          )
        })}
      </div>

      {phase === "scratching" && (
        <p className="text-xs text-white/40">
          💎 ×{diamondsSoFar} · 💣 ×{bombsSoFar} · {9 - revealed.filter(Boolean).length} left · currently {currentMultiplier}x
        </p>
      )}

      {phase === "betting" && (
        <WagerStepper wager={wager} onChange={setWager} maxTokens={Math.max(1, tokens)} />
      )}

      {phase === "betting" && (
        <button type="button" onClick={buyTicket} disabled={!canBuy}
          className="text-sm font-semibold px-5 py-2 rounded-xl bg-primary/80 hover:bg-primary text-white transition-colors disabled:opacity-30">
          Buy Ticket ({wager} 🪙)
        </button>
      )}

      {phase === "scratching" && (
        <div className="flex items-center gap-2">
          <button type="button" onClick={cashOut} disabled={!revealed.some(Boolean)}
            className="text-xs font-semibold px-4 py-1.5 rounded-lg bg-primary/80 hover:bg-primary text-white transition-colors disabled:opacity-30">
            Cash Out ({currentMultiplier}x)
          </button>
          <button type="button" onClick={revealAll}
            className="text-xs px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors">
            Scratch All
          </button>
        </div>
      )}

      {phase === "done" && outcome && (
        <>
          <p className={`text-sm font-bold ${payout > wager ? "text-emerald-300" : payout === wager ? "text-amber-300" : "text-red-300"}`}>
            {payout > wager ? `${outcome.multiplier}x — you won ${payout - wager} tokens.`
              : payout === wager ? `${outcome.multiplier}x — you got your wager back.`
              : `${outcome.multiplier}x — you kept ${payout} of your ${wager} wager.`}
          </p>
          <button type="button" onClick={newTicket}
            className="text-sm font-semibold px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors">
            New Ticket
          </button>
        </>
      )}

      {phase === "betting" && tokens < 1 && <p className="text-xs text-white/30 italic">Not enough tokens to play.</p>}
      <p className="text-[10px] text-white/25 text-center">Each 💎 adds to the payout · each 💣 takes a bigger bite out of it</p>
    </div>
  )
}
