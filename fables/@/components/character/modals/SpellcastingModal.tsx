import { useState } from "react"
import { Modal } from "../ui/Modal"
import { NumInput } from "../ui/NumInput"
import type { CharacterData, SpellSlot } from "../../character-types"
import { TracingSlider } from "../../ui/tracing-slider"
import { slotLevelColor } from "../../character-themes"
import { profBonus } from "../../character-utils"
import { SAVE_TO_ABILITY } from "../../character-constants"

interface Props {
  data: CharacterData
  spellSlots: SpellSlot[]
  readOnly?: boolean
  slotAccent: string
  onUpdate: (patch: Partial<CharacterData>) => void
  onChangeSlot: (id: string, patch: Partial<SpellSlot>) => void
  onAddSlot: (level: number, total: number, resetsOn: "short" | "long") => void
  onRemoveSlot: (id: string) => void
  onClose: () => void
}

export function SpellcastingModal({
  data, spellSlots, readOnly, slotAccent,
  onUpdate, onChangeSlot, onAddSlot, onRemoveSlot, onClose,
}: Props) {
  const [newSlotLevel, setNewSlotLevel] = useState(1)
  const [newSlotTotal, setNewSlotTotal] = useState(2)
  const [newSlotRests, setNewSlotRests] = useState<"short" | "long">("long")

  const pb = profBonus(data.level ?? 1)
  const spellAbilityKey = data.spellcastingAbility ? SAVE_TO_ABILITY[data.spellcastingAbility.toLowerCase()] : undefined
  const spellAbilityMod = spellAbilityKey ? Math.floor(((data[spellAbilityKey as keyof CharacterData] as number ?? 10) - 10) / 2) : 0
  const saveDC    = data.spellcastingAbility ? 8 + pb + spellAbilityMod + (data.spellSaveDCBonus ?? 0) : undefined
  const atkBonus  = data.spellcastingAbility ? pb + spellAbilityMod + (data.spellAttackBonusBonus ?? 0) : undefined

  return (
    <Modal onClose={onClose}>
      <div className="bg-zinc-900 border border-white/20 rounded-2xl shadow-2xl w-125 max-h-[85vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <p className="text-base font-bold text-white">Spellcasting</p>
          <button type="button" onClick={onClose}
            className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-5">

          {/* Spell stats */}
          <div className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-widest text-white/40 font-semibold">Spell Stats</p>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-white/40">Ability</span>
              <select value={data.spellcastingAbility ?? ""} disabled={readOnly}
                onChange={e => onUpdate({ spellcastingAbility: e.target.value })}
                className="bg-black/30 rounded-lg px-2 py-2 text-white outline-none text-sm disabled:opacity-50">
                <option value="">—</option>
                {["STR","DEX","CON","INT","WIS","CHA"].map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5 bg-black/20 rounded-lg p-2.5">
                <span className="text-xs text-white/40">Save DC <span className="text-white/25">(8 + PB + mod)</span></span>
                <span className="text-2xl font-bold text-white tabular-nums">{saveDC ?? "—"}</span>
                <label className="flex items-center gap-1.5 text-[11px] text-white/40">
                  Extra bonus
                  <NumInput value={data.spellSaveDCBonus ?? ""} disabled={readOnly}
                    onFocus={e => e.target.select()} placeholder="0"
                    onChange={e => onUpdate({ spellSaveDCBonus: parseInt(e.target.value) || 0 })}
                    className="w-14 bg-white/10 rounded px-1.5 py-1 text-center text-white outline-none text-xs disabled:opacity-50" />
                </label>
              </div>
              <div className="flex flex-col gap-1.5 bg-black/20 rounded-lg p-2.5">
                <span className="text-xs text-white/40">Attack Bonus <span className="text-white/25">(PB + mod)</span></span>
                <span className="text-2xl font-bold text-white tabular-nums">{atkBonus != null ? (atkBonus >= 0 ? `+${atkBonus}` : atkBonus) : "—"}</span>
                <label className="flex items-center gap-1.5 text-[11px] text-white/40">
                  Extra bonus
                  <NumInput value={data.spellAttackBonusBonus ?? ""} disabled={readOnly}
                    onFocus={e => e.target.select()} placeholder="0"
                    onChange={e => onUpdate({ spellAttackBonusBonus: parseInt(e.target.value) || 0 })}
                    className="w-14 bg-white/10 rounded px-1.5 py-1 text-center text-white outline-none text-xs disabled:opacity-50" />
                </label>
              </div>
            </div>
          </div>

          {/* Known / Prepared */}
          <div className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-widest text-white/40 font-semibold">Known / Prepared</p>
            <div className="grid grid-cols-3 gap-3">
              {([["Cantrips", "cantripsKnown"], ["Known", "spellsKnown"], ["Prepared", "spellsPrepared"]] as const).map(([label, key]) => (
                <label key={key} className="flex flex-col gap-1">
                  <span className="text-xs text-white/40">{label}</span>
                  <NumInput value={(data[key] as number | undefined) ?? ""} disabled={readOnly}
                    onFocus={e => e.target.select()} placeholder="0" min={0}
                    onChange={e => onUpdate({ [key]: parseInt(e.target.value) || 0 })}
                    className="bg-white/10 rounded-lg px-2 py-2 text-center text-white outline-none text-sm disabled:opacity-50" />
                </label>
              ))}
            </div>
          </div>

          {/* Spell slots */}
          <div className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-widest text-white/40 font-semibold">Spell Slots</p>
            <div className="flex flex-col gap-2">
              {spellSlots.map(slot => {
                const rem = Math.max(0, slot.total - slot.used)
                return (
                  <div key={slot.id} className="flex items-center gap-2">
                    <div className="flex items-center gap-1  shrink-0">
                      <span className="text-xs text-white/50 w-8 shrink-0">Lv {slot.level}</span>
                      {!readOnly && (
                        <button type="button"
                          title={slot.pact ? "Pact Magic (click to unmark)" : "Mark as Pact Magic"}
                          onClick={() => onChangeSlot(slot.id, { pact: slot.pact ? undefined : true, resetsOn: slot.pact ? "long" : "short" })}
                          className={`text-[10px] px-1 py-0.5 rounded font-semibold transition-colors leading-none ${slot.pact ? "bg-violet-500/25 text-violet-300 hover:bg-violet-500/40" : "bg-white/5 text-white/20 hover:text-white/50"}`}>
                          {slot.pact ? "Pact" : "P"}
                        </button>
                      )}
                      {readOnly && slot.pact && (
                        <span className="text-[10px] px-1 py-0.5 rounded bg-violet-500/20 text-violet-300 font-semibold leading-none">Pact</span>
                      )}
                    </div>
                    <TracingSlider
                      value={rem} max={slot.total} disabled={readOnly}
                      showButtons buttonSize="sm"
                      color={slotLevelColor(slotAccent, slot.level)}
                      onChange={val => onChangeSlot(slot.id, { used: Math.max(0, slot.total - val) })}
                    />
                    {!readOnly && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button type="button" disabled={slot.total <= 1}
                          onClick={() => onChangeSlot(slot.id, { total: slot.total - 1, used: Math.min(slot.used, slot.total - 1) })}
                          className="size-5 rounded bg-white/10 hover:bg-white/20 text-white/60 text-xs font-bold flex items-center justify-center disabled:opacity-20">−</button>
                        <span className="text-xs text-white/40 w-5 text-center tabular-nums">{slot.total}</span>
                        <button type="button"
                          onClick={() => onChangeSlot(slot.id, { total: slot.total + 1 })}
                          className="size-5 rounded bg-white/10 hover:bg-white/20 text-white/60 text-xs font-bold flex items-center justify-center">+</button>
                      </div>
                    )}
                    {!readOnly && (
                      <button type="button" onClick={() => onRemoveSlot(slot.id)}
                        className="text-white/20 hover:text-red-400 text-xs transition-colors shrink-0">✕</button>
                    )}
                  </div>
                )
              })}

              {!readOnly && (
                <div className="border-t border-white/10 pt-3 mt-1 flex flex-col gap-2">
                  <p className="text-xs text-white/40">Add slot row</p>
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <label className="flex items-center gap-1.5 text-white/50">Level
                      <select value={newSlotLevel} onChange={e => setNewSlotLevel(parseInt(e.target.value))}
                        className="bg-black/30 rounded-lg px-2 py-1 text-white outline-none">
                        {[1,2,3,4,5,6,7,8,9].map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </label>
                    <label className="flex items-center gap-1.5 text-white/50">Slots
                      <NumInput value={newSlotTotal} min={1}
                        onFocus={e => e.target.select()}
                        onChange={e => setNewSlotTotal(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-12 bg-white/10 rounded-lg px-2 py-1 text-center text-white outline-none" />
                    </label>
                    <label className="flex items-center gap-1.5 text-white/50">Resets
                      <select value={newSlotRests} onChange={e => setNewSlotRests(e.target.value as "short" | "long")}
                        className="bg-black/30 rounded-lg px-2 py-1 text-white outline-none">
                        <option value="long">Long</option>
                        <option value="short">Short</option>
                      </select>
                    </label>
                    <button type="button" onClick={() => { onAddSlot(newSlotLevel, newSlotTotal, newSlotRests); setNewSlotTotal(2) }}
                      className="px-3 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-sm font-medium transition-colors">Add</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
