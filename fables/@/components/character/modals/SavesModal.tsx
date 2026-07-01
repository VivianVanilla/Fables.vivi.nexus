import { Modal } from "../ui/Modal"
import { NumInput } from "../ui/NumInput"
import type { CharacterData } from "../../character-types"
import { SAVE_KEYS } from "../../character-constants"
import { profBonus } from "../../character-utils"

const SAVE_FULL: Record<string, string> = {
  str: "Strength", dex: "Dexterity", con: "Constitution",
  int: "Intelligence", wis: "Wisdom", cha: "Charisma",
}

interface Props {
  data: CharacterData
  readOnly?: boolean
  getSaveMod: (save: typeof SAVE_KEYS[number]) => number
  onUpdate: (patch: Partial<CharacterData>) => void
  onClose: () => void
}

export function SavesModal({ data, readOnly, getSaveMod, onUpdate, onClose }: Props) {
  const pb = profBonus(data.level ?? 1)
  return (
    <Modal onClose={onClose}>
      <div className="bg-zinc-900 border border-white/20 rounded-2xl shadow-2xl w-72 flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <p className="text-base font-bold text-white">Saving Throws</p>
          <span className="text-sm text-white/40">Prof +{pb}</span>
        </div>
        <div className="px-2 py-3 flex flex-col gap-0.5">
          {SAVE_KEYS.map(save => {
            const prof  = data.savingThrowProfs?.[save] ?? false
            const bonus = data.saveBonuses?.[save] ?? 0
            const mod   = getSaveMod(save)
            return (
              <div key={save} className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors">
                <button type="button" disabled={readOnly}
                  onClick={() => onUpdate({ savingThrowProfs: { ...data.savingThrowProfs, [save]: !prof } })}
                  className={`size-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors disabled:cursor-default ${prof ? "bg-primary border-primary" : "border-white/30"}`}>
                  {prof && <span className="text-white text-[10px] font-bold">✓</span>}
                </button>
                <span className="text-sm text-white/70 flex-1">{SAVE_FULL[save]}</span>
                {!readOnly && (
                  <NumInput value={bonus || ""} placeholder="+0"
                    onFocus={e => e.target.select()}
                    onChange={e => onUpdate({ saveBonuses: { ...data.saveBonuses, [save]: parseInt(e.target.value) || 0 } })}
                    className="w-12 text-center bg-white/10 rounded-lg px-1 py-1 text-xs text-white/60 outline-none"
                    title="Additional flat bonus" />
                )}
                <span className={`text-base font-mono font-bold w-8 text-right ${mod >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {mod >= 0 ? `+${mod}` : mod}
                </span>
              </div>
            )
          })}
        </div>
        <div className="px-5 pb-5">
          <button type="button" onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-sm text-white font-semibold transition-colors">
            Done
          </button>
        </div>
      </div>
    </Modal>
  )
}
