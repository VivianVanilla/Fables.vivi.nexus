import React from "react"
import { Modal } from "../ui/Modal"
import { NumInput } from "../ui/NumInput"
import type { CharacterData } from "../../character-types"
import { SKILLS } from "../../character-constants"
import { profBonus } from "../../character-utils"

interface Props {
  skillName: string
  data: CharacterData
  readOnly?: boolean
  getSkillMod: (skillName: string, abilityKey: string) => number
  onUpdate: (patch: Partial<CharacterData>) => void
  onClose: () => void
}

export function SkillModal({ skillName, data, readOnly, getSkillMod, onUpdate, onClose }: Props) {
  const skill     = SKILLS.find(s => s.name === skillName)
  if (!skill) return null
  const profLevel = data.skillProfs?.[skillName] ?? "none"
  const bonus     = data.skillBonuses?.[skillName] ?? 0
  const mod       = getSkillMod(skillName, skill.ability)
  const pb        = profBonus(data.level ?? 1)

  return (
    <Modal onClose={onClose}>
      <div className="bg-zinc-900 border border-white/20 rounded-2xl shadow-2xl w-64 flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <p className="text-base font-bold text-white">{skillName}</p>
          <span className={`text-xl font-mono font-bold ${mod >= 0 ? "text-green-400" : "text-red-400"}`}>
            {mod >= 0 ? `+${mod}` : mod}
          </span>
        </div>
        <div className="px-5 py-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-widest text-white/40 font-semibold">Proficiency</p>
            <div className="grid grid-cols-2 gap-2">
              {(["none", "half", "prof", "exp"] as const).map(level => {
                const labels = { none: "None", half: `Half (+${Math.floor(pb/2)})`, prof: `Proficient (+${pb})`, exp: `Expertise (+${pb*2})` }
                const active = profLevel === level
                return (
                  <button key={level} type="button" disabled={readOnly}
                    onClick={() => {
                      const next = level === "none" ? undefined : level
                      const updated = { ...data.skillProfs }
                      if (next) updated[skillName] = next
                      else delete updated[skillName]
                      onUpdate({ skillProfs: updated as CharacterData["skillProfs"] })
                    }}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors border disabled:cursor-default ${active ? "bg-primary/20 border-primary/50 text-white" : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white/80"}`}>
                    {labels[level]}
                  </button>
                )
              })}
            </div>
          </div>
          {!readOnly && (
            <div className="flex flex-col gap-2">
              <p className="text-xs uppercase tracking-widest text-white/40 font-semibold">Extra Bonus</p>
              <NumInput value={bonus || ""} placeholder="0"
                onFocus={e => e.target.select()}
                onChange={e => onUpdate({ skillBonuses: { ...data.skillBonuses, [skillName]: parseInt(e.target.value) || 0 } })}
                className="w-full text-center bg-white/10 rounded-xl px-3 py-2 text-white outline-none text-lg font-bold"
              />
            </div>
          )}
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
