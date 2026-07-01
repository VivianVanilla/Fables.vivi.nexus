import { Modal } from "../ui/Modal"
import { NumInput } from "../ui/NumInput"
import type { CharacterData } from "../../character-types"
import { SAVE_TO_ABILITY } from "../../character-constants"

const ABILITY_COLORS: Record<string, { text: string }> = {
  str: { text: "text-red-400"    },
  dex: { text: "text-green-400"  },
  con: { text: "text-orange-400" },
  int: { text: "text-blue-400"   },
  wis: { text: "text-cyan-400"   },
  cha: { text: "text-purple-400" },
}

interface Props {
  data: CharacterData
  readOnly?: boolean
  onUpdate: (patch: Partial<CharacterData>) => void
  onClose: () => void
  accentColor: string
}

export function InitiativeModal({ data, readOnly, onUpdate, onClose, accentColor }: Props) {
  const initStat = data.initiativeStat ?? "dex"
  const bonus    = data.initiativeBonus ?? 0
  const fullKey  = SAVE_TO_ABILITY[initStat] ?? "dexterity"
  const score    = (data[fullKey as keyof CharacterData] as number | undefined) ?? 10
  const mod      = Math.floor((score - 10) / 2)
  const total    = mod + bonus
  const totalStr = total >= 0 ? `+${total}` : `${total}`

  return (
    <Modal onClose={onClose}>
      <div className="bg-zinc-900 border border-white/20 rounded-2xl shadow-2xl w-64 flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <p className="text-base font-bold text-white">Initiative</p>
          <span className="text-xl font-mono font-bold" style={{ color: accentColor }}>{totalStr}</span>
        </div>
        <div className="px-5 py-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-widest text-white/40 font-semibold">Ability Score</p>
            <div className="grid grid-cols-3 gap-2">
              {(["str","dex","con","int","wis","cha"] as const).map(s => {
                const ac       = ABILITY_COLORS[s]
                const isActive = initStat === s
                return (
                  <button key={s} type="button" disabled={readOnly}
                    onClick={() => onUpdate({ initiativeStat: s })}
                    className={`px-3 py-2 rounded-xl text-sm font-semibold transition-colors border disabled:cursor-default ${isActive ? "border-white/40 text-white" : `bg-white/5 border-white/10 hover:bg-white/10 ${ac.text}`}`}
                    style={isActive ? { backgroundColor: accentColor + "25", borderColor: accentColor + "80" } : {}}>
                    {s.toUpperCase()}
                  </button>
                )
              })}
            </div>
          </div>
          {!readOnly && (
            <div className="flex flex-col gap-2">
              <p className="text-xs uppercase tracking-widest text-white/40 font-semibold">Extra Bonus</p>
              <NumInput value={bonus || ""} placeholder="0"
                onFocus={e => e.target.select()}
                onChange={e => onUpdate({ initiativeBonus: parseInt(e.target.value) || 0 })}
                className="w-full text-center bg-white/10 rounded-xl px-3 py-2 text-white outline-none text-lg font-bold"
              />
            </div>
          )}
        </div>
        <div className="px-5 pb-5">
          <button type="button" onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm text-white font-semibold transition-colors"
            style={{ backgroundColor: accentColor + "30" }}>
            Done
          </button>
        </div>
      </div>
    </Modal>
  )
}
