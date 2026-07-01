import type { CharacterData } from "../../character-types"
import { SAVE_KEYS, ABILITY_ABBR, SAVE_TO_ABILITY } from "../../character-constants"

interface Props {
  card: string
  data: CharacterData
  readOnly?: boolean
  getSaveMod: (save: typeof SAVE_KEYS[number]) => number
  onShowModal: () => void
}

export function SavesCard({ card, data, readOnly, getSaveMod, onShowModal }: Props) {
  return (
    <div className={`${card} p-3 flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-white/50 font-semibold">Saving Throws</span>
        {!readOnly && (
          <button type="button" onClick={onShowModal}
            className="size-6 flex items-center justify-center rounded-md hover:bg-white/10 text-white/70 hover:text-white text-xs transition-colors">✎</button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {SAVE_KEYS.map(save => {
          const mod  = getSaveMod(save)
          const prof = data.savingThrowProfs?.[save] ?? false
          return (
            <div key={save} className="flex items-center gap-2">
              <span className={`size-2 rounded-full shrink-0 ${prof ? "bg-primary" : "bg-white/15"}`} />
              <span className="text-xs text-white/50 uppercase tracking-wider w-8">{ABILITY_ABBR[SAVE_TO_ABILITY[save]]}</span>
              <span className={`text-sm font-mono font-bold ${mod >= 0 ? "text-green-400" : "text-red-400"}`}>
                {mod >= 0 ? `+${mod}` : `${mod}`}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
