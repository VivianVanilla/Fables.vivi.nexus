import { Modal } from "../ui/Modal"
import { NumInput } from "../ui/NumInput"
import type { CharacterData } from "../../character-types"
import { computeAc } from "../../character-utils"

const ABILITY_COLORS: Record<string, { text: string }> = {
  str: { text: "text-red-400"    },
  dex: { text: "text-green-400"  },
  con: { text: "text-orange-400" },
  int: { text: "text-blue-400"   },
  wis: { text: "text-cyan-400"   },
  cha: { text: "text-purple-400" },
}

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const

interface Props {
  data: CharacterData
  readOnly?: boolean
  onUpdate: (patch: Partial<CharacterData>) => void
  onClose: () => void
  accentColor: string
}

export function ArmorClassModal({ data, readOnly, onUpdate, onClose, accentColor }: Props) {
  const primary = data.acAbility ?? "dex"
  const dual    = data.acAbility2 != null
  const misc    = data.acMiscBonus ?? 0
  const result  = computeAc(data)

  return (
    <Modal onClose={onClose}>
      <div className="bg-zinc-900 border border-white/20 rounded-2xl shadow-2xl w-72 flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <p className="text-base font-bold text-white">Armor Class</p>
          <span className="text-xl font-mono font-bold" style={{ color: accentColor }}>{result.total}</span>
        </div>
        <div className="px-5 py-4 flex flex-col gap-4">
          {result.armorName ? (
            <p className="text-xs text-white/50">
              Base AC set by <span className="text-white/80 font-semibold">{result.armorName}</span> ({result.base}) — unequip it to go back to ability-based AC.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <p className="text-xs uppercase tracking-widest text-white/40 font-semibold">Base AC</p>
                <NumInput value={data.acBase ?? ""} placeholder="10" disabled={readOnly}
                  onFocus={e => e.target.select()}
                  onChange={e => onUpdate({ acBase: e.target.value ? parseInt(e.target.value) || 0 : undefined })}
                  className="w-full text-center bg-white/10 rounded-xl px-3 py-2 text-white outline-none text-lg font-bold"
                />
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-xs uppercase tracking-widest text-white/40 font-semibold">+ Ability</p>
                <div className="grid grid-cols-3 gap-2">
                  {ABILITIES.map(s => {
                    const c        = ABILITY_COLORS[s]
                    const isActive = primary === s
                    return (
                      <button key={s} type="button" disabled={readOnly}
                        onClick={() => onUpdate({ acAbility: s })}
                        className={`px-3 py-2 rounded-xl text-sm font-semibold transition-colors border disabled:cursor-default ${isActive ? "border-white/40 text-white" : `bg-white/5 border-white/10 hover:bg-white/10 ${c.text}`}`}
                        style={isActive ? { backgroundColor: accentColor + "25", borderColor: accentColor + "80" } : {}}>
                        {s.toUpperCase()}
                      </button>
                    )
                  })}
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer select-none">
                <input type="checkbox" checked={dual} disabled={readOnly}
                  onChange={e => onUpdate({ acAbility2: e.target.checked ? (primary === "dex" ? "wis" : "dex") : undefined })} />
                Dual stat (Monk, Barbarian, etc.)
              </label>

              {dual && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs uppercase tracking-widest text-white/40 font-semibold">+ Second Ability</p>
                  <div className="grid grid-cols-3 gap-2">
                    {ABILITIES.map(s => {
                      const c        = ABILITY_COLORS[s]
                      const isActive = data.acAbility2 === s
                      const disabled = readOnly || s === primary
                      return (
                        <button key={s} type="button" disabled={disabled}
                          onClick={() => onUpdate({ acAbility2: s })}
                          className={`px-3 py-2 rounded-xl text-sm font-semibold transition-colors border disabled:opacity-30 disabled:cursor-default ${isActive ? "border-white/40 text-white" : `bg-white/5 border-white/10 hover:bg-white/10 ${c.text}`}`}
                          style={isActive ? { backgroundColor: accentColor + "25", borderColor: accentColor + "80" } : {}}>
                          {s.toUpperCase()}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {result.equipBonus > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs text-white/50">+{result.equipBonus} from equipped shields/items</p>
              <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer select-none">
                <input type="checkbox" checked={data.hideEquipAcBadge ?? false} disabled={readOnly}
                  onChange={e => onUpdate({ hideEquipAcBadge: e.target.checked })} />
                Hide "equip" AC bonus badge
              </label>
            </div>
          )}

          {!readOnly && (
            <div className="flex flex-col gap-2">
              <p className="text-xs uppercase tracking-widest text-white/40 font-semibold">Misc Bonus</p>
              <NumInput value={misc || ""} placeholder="0"
                onFocus={e => e.target.select()}
                onChange={e => onUpdate({ acMiscBonus: parseInt(e.target.value) || 0 })}
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
