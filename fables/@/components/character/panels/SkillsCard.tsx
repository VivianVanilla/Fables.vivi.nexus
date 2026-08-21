import { useState } from "react"
import type { CharacterData } from "@/components/shared/types"
import { SKILLS } from "@/components/shared/constants"
import { nanoid } from "@/components/shared/utils"

const ABILITY_COLORS: Record<string, { text: string; subtle: string }> = {
  str: { text: "text-red-400",    subtle: "bg-red-500/8"    },
  dex: { text: "text-green-400",  subtle: "bg-green-500/8"  },
  con: { text: "text-orange-400", subtle: "bg-orange-500/8" },
  int: { text: "text-blue-400",   subtle: "bg-blue-500/8"   },
  wis: { text: "text-cyan-400",   subtle: "bg-cyan-500/8"   },
  cha: { text: "text-purple-400", subtle: "bg-purple-500/8" },
}

const STAT_ORDER = ["str","dex","con","int","wis","cha"] as const

type SkillEntry = { name: string; ability: string; customId?: string }

interface Props {
  card: string
  data: CharacterData
  characterId: string
  readOnly?: boolean
  getSkillMod: (skillName: string, abilityKey: string) => number
  onShowSkillModal: (name: string) => void
  onUpdate: (patch: Partial<CharacterData>) => void
}

export function SkillsCard({ card, data, characterId, readOnly, getSkillMod, onShowSkillModal, onUpdate }: Props) {
  const [groupBy, setGroupBy] = useState<"default" | "stat">(() => {
    try { return localStorage.getItem(`fables-skill-group-${characterId}`) === "stat" ? "stat" : "default" } catch { return "default" }
  })
  // Undocumented: right-click the Skills panel to add a custom skill tied to
  // any stat; right-click a custom skill's row to remove it again.
  const [menu, setMenu] = useState<{ x: number; y: number; mode: "add" | { removeId: string } } | null>(null)
  const [draftName, setDraftName] = useState("")
  const [draftAbility, setDraftAbility] = useState<typeof STAT_ORDER[number]>("str")

  const plain = data.plainSkills ?? false
  const customSkills: SkillEntry[] = (data.customSkills ?? []).map(c => ({ name: c.name, ability: c.ability, customId: c.id }))
  const allSkills: SkillEntry[] = [...SKILLS, ...customSkills]
  const removeTargetId = menu && menu.mode !== "add" ? menu.mode.removeId : null

  function openAddMenu(e: React.MouseEvent) {
    if (readOnly) return
    e.preventDefault()
    setDraftName("")
    setDraftAbility("str")
    setMenu({ x: e.clientX, y: e.clientY, mode: "add" })
  }
  function openRemoveMenu(e: React.MouseEvent, customId: string) {
    if (readOnly) return
    e.preventDefault()
    e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY, mode: { removeId: customId } })
  }
  function addCustomSkill() {
    const name = draftName.trim()
    if (!name || allSkills.some(s => s.name.toLowerCase() === name.toLowerCase())) return
    onUpdate({ customSkills: [...(data.customSkills ?? []), { id: nanoid(), name, ability: draftAbility }] })
    setMenu(null)
  }
  function removeCustomSkill(id: string) {
    const removed = (data.customSkills ?? []).find(s => s.id === id)
    const patch: Partial<CharacterData> = { customSkills: (data.customSkills ?? []).filter(s => s.id !== id) }
    if (removed?.name && data.skillProfs?.[removed.name]) {
      const profs = { ...data.skillProfs }; delete profs[removed.name]; patch.skillProfs = profs
    }
    if (removed?.name && data.skillBonuses?.[removed.name]) {
      const bonuses = { ...data.skillBonuses }; delete bonuses[removed.name]; patch.skillBonuses = bonuses
    }
    onUpdate(patch)
    setMenu(null)
  }

  function skillRow(skill: SkillEntry) {
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
        onContextMenu={e => skill.customId ? openRemoveMenu(e, skill.customId) : undefined}
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
    <div className={`${card} p-3 flex flex-col gap-2`} onContextMenu={openAddMenu}>
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
            const group = allSkills.filter(s => s.ability === stat)
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
          {[...allSkills].sort((a, b) => a.name.localeCompare(b.name)).map(skillRow)}
        </div>
      )}

      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} onContextMenu={e => { e.preventDefault(); setMenu(null) }} />
          <div style={{ left: menu.x, top: menu.y }} className="fixed z-50 rounded-lg bg-zinc-900 border border-white/10 shadow-xl overflow-hidden">
            {menu.mode === "add" ? (
              <div className="p-3 flex flex-col gap-2 w-56" onClick={e => e.stopPropagation()}>
                <input autoFocus value={draftName} onChange={e => setDraftName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addCustomSkill()}
                  placeholder="Custom skill name"
                  className="bg-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20" />
                <div className="grid grid-cols-3 gap-1">
                  {STAT_ORDER.map(s => {
                    const ac = ABILITY_COLORS[s]
                    const active = draftAbility === s
                    return (
                      <button key={s} type="button" onClick={() => setDraftAbility(s)}
                        className={`text-[10px] px-2 py-1.5 rounded-lg font-semibold uppercase transition-colors border ${active ? `${ac.subtle} ${ac.text} border-white/30` : "bg-white/5 text-white/40 border-white/10 hover:text-white/70"}`}>
                        {s}
                      </button>
                    )
                  })}
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setMenu(null)}
                    className="text-xs px-2.5 py-1 rounded-full text-white/50 hover:text-white transition-colors">Cancel</button>
                  <button type="button" disabled={!draftName.trim()} onClick={addCustomSkill}
                    className="text-xs px-3 py-1 rounded-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-semibold transition-colors">Add</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => removeTargetId && removeCustomSkill(removeTargetId)}
                className="flex items-center gap-2 px-3 py-2 text-xs text-red-300 hover:bg-red-500/10 transition-colors text-left w-full min-w-40">
                Remove custom skill
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
