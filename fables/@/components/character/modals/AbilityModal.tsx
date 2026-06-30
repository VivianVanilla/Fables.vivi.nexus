import React, { useState } from "react"
import { Modal } from "../ui/Modal"
import { NumInput } from "../ui/NumInput"
import type { CharacterData } from "../../character-types"
import { ABILITY_KEYS, ABILITY_ABBR } from "../../character-constants"
import { abilityMod } from "../../character-utils"

interface Props {
  data: CharacterData
  readOnly?: boolean
  onUpdate: (patch: Partial<CharacterData>) => void
  onClose: () => void
}

export function AbilityModal({ data, readOnly, onUpdate, onClose }: Props) {
  const [inputs, setInputs] = useState<Record<string, string>>({})

  return (
    <Modal onClose={onClose}>
      <div className="bg-zinc-900 border border-white/20 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <p className="text-base font-bold text-white">Ability Scores</p>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3">
          {ABILITY_KEYS.map(key => {
            const stored  = (data[key as keyof CharacterData] as number | undefined) ?? 10
            const display = inputs[key] !== undefined ? inputs[key] : String(stored)
            const mod     = abilityMod(stored)
            return (
              <div key={key} className="flex items-center gap-3">
                <span className="text-sm text-white/60 uppercase tracking-wider w-10 shrink-0">{ABILITY_ABBR[key]}</span>
                <NumInput value={display}
                  onFocus={e => e.target.select()}
                  onChange={e => setInputs(prev => ({ ...prev, [key]: e.target.value }))}
                  onBlur={e => {
                    const v = e.target.value.trim()
                    onUpdate({ [key]: v === "" ? 0 : Math.max(1, Math.min(1000, parseInt(v) || 0)) })
                    setInputs(prev => { const n = { ...prev }; delete n[key]; return n })
                  }}
                  disabled={readOnly}
                  className="flex-1 text-center bg-white/10 rounded-xl px-3 py-2.5 text-lg font-bold text-white outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-50"
                />
                <span className={`text-sm font-mono font-bold w-10 text-right ${mod.startsWith("-") ? "text-red-400" : "text-green-400"}`}>{mod}</span>
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
