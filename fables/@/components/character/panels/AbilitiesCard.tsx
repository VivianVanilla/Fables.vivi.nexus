import type { CharacterData } from "../../character-types"
import { ABILITY_KEYS, ABILITY_ABBR } from "../../character-constants"
import { abilityMod } from "../../character-utils"

interface Props {
  card: string
  data: CharacterData
  readOnly?: boolean
  onShowModal: () => void
}

export function AbilitiesCard({ card, data, readOnly, onShowModal }: Props) {
  return (
    <div className={`${card} p-3 flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-white/50 font-semibold">Abilities</span>
        {!readOnly && (
          <button type="button" onClick={onShowModal}
            className="size-6 flex items-center justify-center rounded-md hover:bg-white/10 text-white/70 hover:text-white text-xs transition-colors">✎</button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {ABILITY_KEYS.map(key => {
          const score = (data[key as keyof CharacterData] as number | undefined) ?? 10
          const mod   = abilityMod(score)
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs text-white/50 uppercase tracking-wider w-8">{ABILITY_ABBR[key]}</span>
              <span className="text-base font-bold text-white w-7 tabular-nums">{score}</span>
              <span className={`text-xs font-mono ${mod.startsWith("-") ? "text-red-400" : "text-green-400"}`}>{mod}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
