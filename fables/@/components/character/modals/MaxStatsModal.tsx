import { Modal } from "../ui/Modal"
import { NumInput } from "../ui/NumInput"
import type { CharacterData } from "../../character-types"

interface Props {
  data: Pick<CharacterData, "maxHp" | "ac" | "tempHp" | "maxHpMod">
  effectiveMax: number
  onUpdate: (patch: Partial<CharacterData>) => void
  onClose: () => void
}

export function MaxStatsModal({ data, effectiveMax, onUpdate, onClose }: Props) {
  const maxHpMod = data.maxHpMod ?? 0
  return (
    <Modal onClose={onClose}>
      <div className="bg-zinc-900 border border-white/20 rounded-2xl shadow-2xl w-64 flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <p className="text-base font-bold text-white">Edit Stats</p>
        </div>
        <div className="px-5 py-4 flex flex-col gap-4">
          {(["maxHp", "ac", "tempHp"] as const).map(k => (
            <label key={k} className="flex flex-col gap-1.5">
              <span className="text-xs text-white/40 uppercase tracking-wider">
                {k === "maxHp" ? "Max HP" : k === "ac" ? "Armour Class" : "Temp HP"}
              </span>
              <NumInput
                value={(data[k] as number | undefined) ?? ""}
                onFocus={e => e.target.select()}
                onChange={e => onUpdate({ [k]: parseInt(e.target.value) || 0 })}
                className="text-center bg-white/10 rounded-xl px-3 py-3 text-xl font-bold text-white outline-none focus:ring-2 focus:ring-white/30"
              />
            </label>
          ))}
          <label className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-white/40 uppercase tracking-wider">Max HP Modifier</span>
              {maxHpMod !== 0 && (
                <span className={`text-xs font-semibold ${maxHpMod > 0 ? "text-emerald-400" : "text-red-400"}`}>
                  Effective: {effectiveMax}
                </span>
              )}
            </div>
            <NumInput
              value={data.maxHpMod ?? ""}
              placeholder="0"
              onFocus={e => e.target.select()}
              onChange={e => onUpdate({ maxHpMod: parseInt(e.target.value) || 0 })}
              className={`text-center bg-white/10 rounded-xl px-3 py-3 text-xl font-bold outline-none focus:ring-2 focus:ring-white/30 ${maxHpMod < 0 ? "text-red-400" : maxHpMod > 0 ? "text-emerald-400" : "text-white"}`}
            />
          </label>
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
