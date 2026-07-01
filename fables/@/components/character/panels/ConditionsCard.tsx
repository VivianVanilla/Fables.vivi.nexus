import type { ActiveCondition } from "../../character-types"

const CONDITION_COLOR: Record<string, string> = {
  Concentrating: "bg-blue-500/25 text-blue-200 border-blue-500/40",
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
              <span className="flex items-center gap-0.5 ml-1">
                {!readOnly && (
                  <button type="button"
                    onClick={() => onUpdateLevel(cond.id, Math.max(1, (cond.level ?? 1) - 1))}
                    className="opacity-60 hover:opacity-100">−</button>
                )}
                <span className="font-bold">{cond.level ?? 1}</span>
                {!readOnly && (
                  <button type="button"
                    onClick={() => onUpdateLevel(cond.id, Math.min(6, (cond.level ?? 1) + 1))}
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
    </div>
  )
}
