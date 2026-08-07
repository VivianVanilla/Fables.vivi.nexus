import { Modal } from "../ui/Modal"
import { NumInput } from "../ui/NumInput"
import type { CharacterData } from "../../character-types"

interface Props {
  data: CharacterData
  readOnly?: boolean
  onUpdate: (patch: Partial<CharacterData>) => void
  onClose: () => void
  accentColor: string
}

export function CarryCapacityModal({ data, readOnly, onUpdate, onClose, accentColor }: Props) {
  const base  = (data.strength ?? 10) * 15
  const bonus = data.carryCapacityBonus ?? 0
  const total = base + bonus

  return (
    <Modal onClose={onClose}>
      <div className="bg-zinc-900 border border-white/20 rounded-2xl shadow-2xl w-64 flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <p className="text-base font-bold text-white">Carrying Capacity</p>
          <span className="text-xl font-mono font-bold" style={{ color: accentColor }}>{total} lb</span>
        </div>
        <div className="px-5 py-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-xs uppercase tracking-widest text-white/40 font-semibold">Base (STR × 15)</p>
            <p className="text-sm text-white/60">{data.strength ?? 10} × 15 = {base} lb</p>
          </div>
          {!readOnly && (
            <div className="flex flex-col gap-2">
              <p className="text-xs uppercase tracking-widest text-white/40 font-semibold">Flat Bonus</p>
              <NumInput value={bonus || ""} placeholder="0"
                onFocus={e => e.target.select()}
                onChange={e => onUpdate({ carryCapacityBonus: parseInt(e.target.value) || 0 })}
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
