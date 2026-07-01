import { useState } from "react"
import { NumInput } from "../ui/NumInput"

interface DeathSaves {
  successes: number
  failures: number
  dead?: boolean
}

interface Props {
  characterName: string
  saves: DeathSaves
  readOnly?: boolean
  onUpdate: (ds: DeathSaves) => void
  /** Called on 3 successes — always heals to 1 HP and clears saves */
  onStabilize: () => void
  /** Called by the manual heal button — heals by `amount` and clears saves */
  onHeal: (amount: number) => void
  card: string
}

export function DeathSavingThrows({ characterName, saves, readOnly, onUpdate, onStabilize, onHeal, card }: Props) {
  const [healStep, setHealStep] = useState(1)
  const { successes, failures, dead } = saves

  if (dead) {
    return (
      <div className={`${card} p-5 flex flex-col items-center gap-3`}>
        <div className="text-5xl select-none">☠</div>
        <p className="text-lg font-bold text-red-400 text-center leading-tight">
          {characterName} is Dead
        </p>
        {!readOnly && (
          <button
            type="button"
            onClick={() => onUpdate({ successes: 0, failures: 0, dead: false })}
            className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/50 hover:text-white transition-colors"
          >
            Revive
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={`${card} p-4 flex flex-col items-center gap-3`}>
      <p className="text-[10px] uppercase tracking-widest text-white/50 font-semibold">
        Death Saving Throws
      </p>

      {/* Failures — click filled skull to remove, empty skull to add */}
      <div className="flex flex-col items-center gap-1.5 w-full">
        <span className="text-[10px] text-red-400/80 uppercase tracking-widest font-semibold">Failures</span>
        <div className="flex gap-2.5">
          {Array.from({ length: 3 }).map((_, i) => {
            const filled = i < failures
            return (
              <button
                key={i}
                type="button"
                disabled={readOnly}
                onClick={() => {
                  // clicking the rightmost filled skull removes it; clicking any empty adds one
                  const next = filled && i === failures - 1 ? failures - 1 : Math.min(3, failures + 1)
                  onUpdate({ ...saves, failures: next, dead: next >= 3 ? true : false })
                }}
                className={`size-9 rounded-full border-2 flex items-center justify-center text-base select-none transition-all disabled:cursor-default ${
                  filled
                    ? "bg-red-500/25 border-red-400 text-red-300 shadow-[0_0_8px_rgba(239,68,68,0.3)] hover:bg-red-500/10 hover:border-red-400/50"
                    : "border-white/15 text-white/10 hover:border-red-400/40 hover:text-red-400/40"
                }`}
              >
                ☠
              </button>
            )
          })}
        </div>
      </div>

      {/* Successes — click filled heart to remove, empty heart to add */}
      <div className="flex flex-col items-center gap-1.5 w-full">
        <span className="text-[10px] text-emerald-400/80 uppercase tracking-widest font-semibold">Successes</span>
        <div className="flex gap-2.5">
          {Array.from({ length: 3 }).map((_, i) => {
            const filled = i < successes
            return (
              <button
                key={i}
                type="button"
                disabled={readOnly}
                onClick={() => {
                  const next = filled && i === successes - 1 ? successes - 1 : Math.min(3, successes + 1)
                  if (next >= 3) { onStabilize() } else { onUpdate({ ...saves, successes: next }) }
                }}
                className={`size-9 rounded-full border-2 flex items-center justify-center text-base select-none transition-all disabled:cursor-default ${
                  filled
                    ? "bg-emerald-500/25 border-emerald-400 text-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.3)] hover:bg-emerald-500/10 hover:border-emerald-400/50"
                    : "border-white/15 text-white/10 hover:border-emerald-400/40 hover:text-emerald-400/40"
                }`}
              >
                ♥
              </button>
            )
          })}
        </div>
      </div>

      {/* Emergency heal */}
      {!readOnly && (
        <div className="flex items-center gap-1.5 w-full border-t border-white/10 pt-3">
          <span className="text-[10px] text-white/35 uppercase tracking-widest shrink-0">Heal</span>
          <NumInput
            value={healStep}
            min={1}
            onFocus={e => e.target.select()}
            onChange={e => setHealStep(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-12 text-center text-sm font-bold bg-white/10 border border-white/15 rounded-lg py-1 text-white outline-none"
          />
          <button
            type="button"
            onClick={() => onHeal(healStep)}
            className="flex-1 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors"
          >
            +{healStep} HP
          </button>
        </div>
      )}
    </div>
  )
}
