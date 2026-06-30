import React, { useState } from "react"
import type { CharacterData } from "../../character-types"
import { SKILLS } from "../../character-constants"

const ABILITY_COLORS: Record<string, { text: string; subtle: string }> = {
  str: { text: "text-red-400",    subtle: "bg-red-500/8"    },
  dex: { text: "text-green-400",  subtle: "bg-green-500/8"  },
  con: { text: "text-orange-400", subtle: "bg-orange-500/8" },
  int: { text: "text-blue-400",   subtle: "bg-blue-500/8"   },
  wis: { text: "text-cyan-400",   subtle: "bg-cyan-500/8"   },
  cha: { text: "text-purple-400", subtle: "bg-purple-500/8" },
}

const STAT_ORDER = ["str","dex","con","int","wis","cha"] as const

interface Props {
  card: string
  data: CharacterData
  characterId: string
  readOnly?: boolean
  getSkillMod: (skillName: string, abilityKey: string) => number
  onShowSkillModal: (name: string) => void
}

export function SkillsCard({ card, data, characterId, readOnly, getSkillMod, onShowSkillModal }: Props) {
  const [groupBy, setGroupBy] = useState<"default" | "stat">(() => {
    try { return localStorage.getItem(`fables-skill-group-${characterId}`) === "stat" ? "stat" : "default" } catch { return "default" }
  })

  const plain = data.plainSkills ?? false

  function skillRow(skill: typeof SKILLS[number]) {
    const profLevel = data.skillProfs?.[skill.name]
    const mod       = getSkillMod(skill.name, skill.ability)
    const ac        = ABILITY_COLORS[skill.ability] ?? { text: "text-white/40", subtle: "" }
    const dotClass  =
      profLevel === "exp"  ? "bg-yellow-400 border-yellow-400" :
      profLevel === "prof" ? "bg-primary border-primary" :
      profLevel === "half" ? "bg-primary/40 border-primary/60" :
                             "border-white/25 bg-transparent"
    return (
      <button key={skill.name} type="button"
        onClick={() => onShowSkillModal(skill.name)}
        className={`flex items-center gap-2 py-1 px-1 rounded-lg hover:bg-white/5 transition-colors w-full text-left ${plain ? "" : ac.subtle}`}>
        <span className={`size-3 rounded-full border-2 shrink-0 transition-colors ${dotClass}`} />
        <span className="text-xs text-white/70 flex-1 truncate leading-tight">{skill.name}</span>
        <span className={`text-[10px] w-6 text-right uppercase shrink-0 font-semibold ${plain ? "text-white/30" : ac.text}`}>{skill.ability}</span>
        <span className={`text-xs font-mono font-semibold w-7 text-right shrink-0 ${mod >= 0 ? "text-green-400" : "text-red-400"}`}>
          {mod >= 0 ? `+${mod}` : `${mod}`}
        </span>
      </button>
    )
  }

  return (
    <div className={`${card} p-3 flex flex-col gap-2`}>
      <div className="flex items-center justify-between shrink-0">
        <span className="text-xs uppercase tracking-widest text-white/50 font-semibold">Skills</span>
        <div className="flex items-center gap-0.5 rounded-full bg-white/10 p-0.5">
          <button type="button"
            onClick={() => { setGroupBy("default"); try { localStorage.setItem(`fables-skill-group-${characterId}`, "default") } catch {} }}
            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold transition-colors ${groupBy === "default" ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70"}`}>
            A–Z
          </button>
          <button type="button"
            onClick={() => { setGroupBy("stat"); try { localStorage.setItem(`fables-skill-group-${characterId}`, "stat") } catch {} }}
            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold transition-colors ${groupBy === "stat" ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70"}`}>
            Stat
          </button>
        </div>
      </div>

      {groupBy === "stat" ? (
        <div className="flex flex-col gap-2">
          {STAT_ORDER.map(stat => {
            const ac    = ABILITY_COLORS[stat] ?? { text: "text-white/40", subtle: "" }
            const group = SKILLS.filter(s => s.ability === stat)
            if (group.length === 0) return null
            return (
              <div key={stat}>
                <div className="flex items-center gap-1 px-1 py-0.5 mb-0.5">
                  <span className={`text-[9px] font-bold uppercase tracking-widest ${plain ? "text-white/30" : ac.text}`}>{stat.toUpperCase()}</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>
                {group.map(skillRow)}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {[...SKILLS].sort((a, b) => a.name.localeCompare(b.name)).map(skillRow)}
        </div>
      )}
    </div>
  )
}
