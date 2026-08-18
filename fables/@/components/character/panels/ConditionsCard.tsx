import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { ActiveCondition } from "@/components/shared/types"
import { EXHAUSTION_EFFECTS } from "@/components/shared/constants"

const CONDITION_COLOR: Record<string, string> = {
  Concentrating: "bg-blue-500/25 text-blue-200 border-blue-500/40",
  Deathward:     "bg-amber-500/25 text-amber-200 border-amber-500/40",
  Exhaustion:    "bg-orange-500/25 text-orange-200 border-orange-500/40",
  Poisoned:      "bg-green-700/25 text-green-200 border-green-700/40",
  Charmed:       "bg-pink-500/25 text-pink-200 border-pink-500/40",
  Frightened:    "bg-pink-700/25 text-pink-200 border-pink-700/40",
  Stunned:       "bg-red-500/25 text-red-200 border-red-500/40",
  Paralyzed:     "bg-red-700/25 text-red-200 border-red-700/40",
  Unconscious:   "bg-zinc-700/40 text-zinc-300 border-zinc-600/60",
}

interface Props {
  card: string
  conditions: ActiveCondition[]
  readOnly?: boolean
  onShowPicker: () => void
  onRemove: (id: string) => void
  onUpdateLevel: (id: string, level: number) => void
}

export function ConditionsCard({ card, conditions, readOnly, onShowPicker, onRemove, onUpdateLevel }: Props) {
  // A bare "Exhaustion: 3" pill doesn't say what 3 means — this pops a
  // bottom-right notice of what the new level does whenever it changes, on
  // top of the persistent tooltip/summary pill (see CharacterSheet.tsx's
  // conditionEffectText) that covers "what does it do right now."
  const [toastLevel, setToastLevel] = useState<number | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])

  function changeExhaustionLevel(id: string, level: number) {
    onUpdateLevel(id, level)
    setToastLevel(level)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastLevel(null), 5000)
  }

  return (
    <div className={`${card} p-3 flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-white/50 font-semibold">Conditions</span>
        {!readOnly && (
          <button type="button" onClick={onShowPicker}
            className="text-xs px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white/50 hover:text-white transition-colors">
            + Add
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {conditions.length === 0 && <span className="text-xs text-white/25 italic">None</span>}
        {conditions.map(cond => (
          <span key={cond.id}
            className={`flex items-center gap-1 text-xs border rounded-full px-2.5 py-0.5 ${CONDITION_COLOR[cond.name] ?? "bg-white/10 text-white/70 border-white/20"}`}>
            {cond.name}
            {cond.name === "Exhaustion" && (
              <span className="flex items-center gap-0.5 ml-1" title={EXHAUSTION_EFFECTS[cond.level ?? 1]}>
                {!readOnly && (
                  <button type="button"
                    onClick={() => changeExhaustionLevel(cond.id, Math.max(1, (cond.level ?? 1) - 1))}
                    className="opacity-60 hover:opacity-100">−</button>
                )}
                <span className="font-bold">{cond.level ?? 1}</span>
                {!readOnly && (
                  <button type="button"
                    onClick={() => changeExhaustionLevel(cond.id, Math.min(6, (cond.level ?? 1) + 1))}
                    className="opacity-60 hover:opacity-100">+</button>
                )}
              </span>
            )}
            {!readOnly && (
              <button type="button" onClick={() => onRemove(cond.id)}
                className="opacity-50 hover:opacity-100 ml-0.5 text-xs">✕</button>
            )}
          </span>
        ))}
      </div>
      {toastLevel != null && createPortal(
        <div className="fixed bottom-4 right-4 z-50 flex items-start gap-2 px-3 py-2 rounded-lg bg-zinc-900 border border-orange-500/40 text-white text-xs shadow-xl max-w-xs">
          <span className="font-bold text-orange-300 shrink-0">Exhaustion {toastLevel}</span>
          <span className="text-white/70">{EXHAUSTION_EFFECTS[toastLevel]}</span>
        </div>,
        document.body
      )}
    </div>
  )
}
