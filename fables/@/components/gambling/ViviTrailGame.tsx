// ════════════════════════════════════════════════════════════════════════════
// ViviTrailGame.tsx — wager tokens, then click through the trail one leg at a
// time. Each leg risks a point of health; reach the end alive and the wager
// pays out at TRAIL_PAYOUT_MULTIPLIER, run out of health first and it's gone.
// ════════════════════════════════════════════════════════════════════════════

import { useState } from "react"
import { Coins } from "lucide-react"
import { useGamblingWallet } from "./useGamblingWallet"
import { WagerStepper } from "./WagerStepper"
import {
  rollEvent, rollDeathCause, TRAIL_LEGS, TRAIL_START_HEALTH, TRAIL_MAX_HEALTH,
  TRAIL_PAYOUT_MULTIPLIER, type TrailEvent,
} from "./viviTrailLogic"

type Phase = "betting" | "traveling" | "done"

export function ViviTrailGame() {
  const { tokens, settleWager } = useGamblingWallet()
  const [wager, setWager] = useState(1)
  const [phase, setPhase] = useState<Phase>("betting")
  const [health, setHealth] = useState(TRAIL_START_HEALTH)
  const [leg, setLeg] = useState(0)
  const [log, setLog] = useState<TrailEvent[]>([])
  const [deathCause, setDeathCause] = useState("")

  const canSetOut = phase === "betting" && wager >= 1 && wager <= tokens
  const survived = phase === "done" && health > 0

  function setOut() {
    if (!canSetOut) return
    setHealth(TRAIL_START_HEALTH)
    setLeg(0)
    setLog([])
    setDeathCause("")
    setPhase("traveling")
  }

  async function advance() {
    if (phase !== "traveling") return
    const event = rollEvent()
    const nextHealth = Math.max(0, Math.min(TRAIL_MAX_HEALTH, health + event.hpDelta))
    const nextLeg = leg + 1
    setLog(l => [event, ...l])
    setHealth(nextHealth)
    setLeg(nextLeg)

    if (nextHealth <= 0) {
      setDeathCause(rollDeathCause())
      await settleWager(wager, 0)
      setPhase("done")
      return
    }
    if (nextLeg >= TRAIL_LEGS) {
      await settleWager(wager, TRAIL_PAYOUT_MULTIPLIER)
      setPhase("done")
    }
  }

  function newTrip() {
    setLeg(0)
    setHealth(TRAIL_START_HEALTH)
    setLog([])
    setDeathCause("")
    setPhase("betting")
  }

  const payout = survived ? Math.round(wager * TRAIL_PAYOUT_MULTIPLIER) : 0

  return (
    <div className="flex flex-col items-center gap-4 py-4 w-full">
      <p className="text-sm font-bold text-white">🐂 The Vivi Trail</p>

      {phase !== "betting" && (
        <>
          <div className="flex items-center gap-1">
            {Array.from({ length: TRAIL_MAX_HEALTH }, (_, i) => (
              <span key={i} className="text-lg">{i < health ? "❤️" : "🖤"}</span>
            ))}
          </div>

          <div className="w-full max-w-xs flex flex-col gap-1">
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-primary transition-all duration-300" style={{ width: `${(leg / TRAIL_LEGS) * 100}%` }} />
            </div>
            <p className="text-[10px] text-white/40 text-center">
              {"🏕️ " + "·".repeat(Math.max(0, leg)) + "🐂" + "·".repeat(Math.max(0, TRAIL_LEGS - leg)) + " 🏁"}
              {" "}Leg {Math.min(leg, TRAIL_LEGS)}/{TRAIL_LEGS}
            </p>
          </div>

          {log.length > 0 && (
            <div className="w-full max-w-xs flex flex-col gap-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2">
              <p className={`text-xs font-semibold ${log[0].hpDelta < 0 ? "text-red-300" : log[0].hpDelta > 0 ? "text-emerald-300" : "text-white/60"}`}>
                {log[0].text}
              </p>
              {log.length > 1 && (
                <div className="flex flex-col gap-0.5 max-h-16 overflow-y-auto">
                  {log.slice(1).map((e, i) => (
                    <p key={i} className="text-[10px] text-white/30">{e.text}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {phase === "betting" && (
        <WagerStepper wager={wager} onChange={setWager} maxTokens={Math.max(1, tokens)} />
      )}

      {phase === "betting" && (
        <button type="button" onClick={setOut} disabled={!canSetOut}
          className="text-sm font-semibold px-5 py-2 rounded-xl bg-primary/80 hover:bg-primary text-white transition-colors disabled:opacity-30">
          Set Out ({wager} <Coins className="inline size-3.5 -mt-0.5" />)
        </button>
      )}

      {phase === "traveling" && (
        <button type="button" onClick={advance}
          className="text-sm font-semibold px-5 py-2 rounded-xl bg-primary/80 hover:bg-primary text-white transition-colors">
          Continue
        </button>
      )}

      {phase === "done" && survived && (
        <>
          <p className="text-sm font-bold text-emerald-300 flex items-center gap-1">
            You made it to Fabletown! {TRAIL_PAYOUT_MULTIPLIER}x — you won {payout - wager} <Coins className="inline size-3.5" /> tokens.
          </p>
          <button type="button" onClick={newTrip}
            className="text-sm font-semibold px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors">
            New Trip
          </button>
        </>
      )}

      {phase === "done" && !survived && (
        <>
          <p className="text-sm font-bold text-red-300">YOU HAVE DIED OF {deathCause.toUpperCase()}. Lost {wager} tokens.</p>
          <button type="button" onClick={newTrip}
            className="text-sm font-semibold px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors">
            New Trip
          </button>
        </>
      )}

      {phase === "betting" && tokens < 1 && <p className="text-xs text-white/30 italic">Not enough tokens to play.</p>}
      {phase === "betting" && (
        <p className="text-[10px] text-white/25 text-center max-w-xs">Survive {TRAIL_LEGS} legs of the trail to collect {TRAIL_PAYOUT_MULTIPLIER}x · run out of health and the wager is gone</p>
      )}
    </div>
  )
}
