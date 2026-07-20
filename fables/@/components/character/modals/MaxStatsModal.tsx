import { Modal } from "../ui/Modal"
import { NumInput } from "../ui/NumInput"
import type { CharacterData } from "../../character-types"

interface Props {
  data: Pick<CharacterData, "maxHp" | "tempHp" | "maxHpMod">
  effectiveMax: number
  onUpdate: (patch: Partial<CharacterData>) => void
  onClose: () => void
}

export function MaxStatsModal({ data, effectiveMax, onUpdate, onClose }: Props) {
  const maxHpMod   = data.maxHpMod ?? 0
  // Split into a sign toggle + always-positive magnitude — some mobile numeric
  // keypads don't offer a "-" key on a plain number input, so typing a
  // negative modifier there isn't reliably possible; picking the sign as a
  // button sidesteps that entirely.
  const isNegative = maxHpMod < 0
  const magnitude  = Math.abs(maxHpMod)
  function setSign(negative: boolean) { onUpdate({ maxHpMod: (negative ? -1 : 1) * magnitude }) }
  function setMagnitude(mag: number)  { onUpdate({ maxHpMod: (isNegative ? -1 : 1) * Math.max(0, mag) }) }
  return (
    <Modal onClose={onClose}>
      <div className="bg-zinc-900 border border-white/20 rounded-2xl shadow-2xl w-64 flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <p className="text-base font-bold text-white">Edit Stats</p>
        </div>
        <div className="px-5 py-4 flex flex-col gap-4">
          {(["maxHp", "tempHp"] as const).map(k => (
            <label key={k} className="flex flex-col gap-1.5">
              <span className="text-xs text-white/40 uppercase tracking-wider">
                {k === "maxHp" ? "Max HP" : "Temp HP"}
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
            <div className="flex items-stretch gap-1.5">
              <div className="flex rounded-xl overflow-hidden shrink-0">
                <button type="button" onClick={() => setSign(true)} title="Negative modifier"
                  className={`w-9 text-lg font-bold transition-colors ${isNegative ? "bg-red-500/30 text-red-300" : "bg-white/10 text-white/40 hover:text-white/70"}`}>
                  −
                </button>
                <button type="button" onClick={() => setSign(false)} title="Positive modifier"
                  className={`w-9 text-lg font-bold transition-colors ${!isNegative ? "bg-emerald-500/30 text-emerald-300" : "bg-white/10 text-white/40 hover:text-white/70"}`}>
                  +
                </button>
              </div>
              <NumInput
                min={0}
                value={magnitude || ""}
                placeholder="0"
                onFocus={e => e.target.select()}
                onChange={e => setMagnitude(parseInt(e.target.value) || 0)}
                className={`flex-1 min-w-0 text-center bg-white/10 rounded-xl px-3 py-3 text-xl font-bold outline-none focus:ring-2 focus:ring-white/30 ${maxHpMod < 0 ? "text-red-400" : maxHpMod > 0 ? "text-emerald-400" : "text-white"}`}
              />
            </div>
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
