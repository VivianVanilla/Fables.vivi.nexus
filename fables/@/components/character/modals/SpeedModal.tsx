import { Modal } from "../ui/Modal"
import { NumInput } from "../ui/NumInput"
import type { CharacterData } from "../../character-types"

interface Props {
  data: CharacterData
  readOnly?: boolean
  overrideReason?: string   // e.g. "Grappled" — set when a condition forces speed to 0
  onUpdate: (patch: Partial<CharacterData>) => void
  onClose: () => void
}

export function SpeedModal({ data, readOnly, overrideReason, onUpdate, onClose }: Props) {
  return (
    <Modal onClose={onClose}>
      <div className="bg-zinc-900 border border-white/20 rounded-2xl shadow-2xl w-64 flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <p className="text-base font-bold text-white">Speed</p>
          <span className="text-xl font-mono font-bold text-white">{data.speed ?? 0}</span>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3">
          {!readOnly && (
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-widest text-white/40 font-semibold">Feet per round</span>
              <NumInput value={data.speed ?? ""} placeholder="30" min={0}
                onFocus={e => e.target.select()}
                onChange={e => onUpdate({ speed: Math.max(0, parseInt(e.target.value) || 0) })}
                className="w-full text-center bg-white/10 rounded-xl px-3 py-2 text-white outline-none text-lg font-bold"
              />
            </label>
          )}
          {overrideReason && (
            <p className="text-xs text-red-400/80 leading-relaxed">
              Currently shown as 0 — {overrideReason} sets your speed to 0 until the condition is removed. Your base speed above is unaffected.
            </p>
          )}
        </div>
        <div className="px-5 pb-5">
          <button type="button" onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm text-white font-semibold bg-white/15 hover:bg-white/25 transition-colors">
            Done
          </button>
        </div>
      </div>
    </Modal>
  )
}
