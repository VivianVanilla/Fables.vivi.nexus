// ════════════════════════════════════════════════════════════════════════════
// InitiativeTracker.tsx — DM encounter builder + turn-order tracker
//
// Lives inside CampaignView (Initiative tab). Encounters are persisted onto
// the campaign object's own `data.encounters` — the DM is always the owner of
// that object, so plain updateObject() writes are enough (matches the rest of
// this codebase's optimistic-local-state pattern; no realtime sync).
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react"
import type { SidebarObject } from "@/components/sidebar-utils"
import type { userInfo } from "@/types/userInfo"
import { useUserContext } from "../../../src/contexts/UserContext"
import { safeParseJson, nanoid } from "../character-utils"
import { FloatingPanel } from "../character/ui/FloatingPanel"
import { FamiliarMonsterView } from "../monster"

interface Combatant {
  id: string
  refType: "monster" | "character"
  refId: string
  name: string
  initiative: number
  // Monsters only — snapshotted at add-time, independent per combatant, NOT
  // linked to the source object, so e.g. two Skeletons in one encounter can
  // each take different damage without clobbering each other or the library
  // monster. PCs go the other way: there's only ever one of each character,
  // and the DM adjusting HP here should hit their real character sheet.
  hp?: number
  maxHp?: number
}

interface SourceHp { hp?: number; maxHp?: number }

interface Encounter {
  id: string
  name: string
  round: number
  turnIndex: number
  combatants: Combatant[]
}

interface EncounterStoreData {
  encounters?: Encounter[]
  [key: string]: unknown  // preserve any other fields already on the campaign object
}

interface Props {
  campaign: SidebarObject
  partyMembers: SidebarObject[]
  onUpdateCharacterHp: (characterId: string, hp: number) => void
}

export function InitiativeTracker({ campaign, partyMembers, onUpdateCharacterHp }: Props) {
  const { objects, updateObject } = useUserContext()
  const monsters = objects.filter(o => o.type === "monster") as userInfo.Objects[]

  const stored     = safeParseJson(campaign.data) as EncounterStoreData
  const encounters = stored.encounters ?? []

  const [activeId, setActiveId]         = useState<string | null>(encounters[0]?.id ?? null)
  const [popouts, setPopouts]           = useState<Record<string, { x: number; y: number; w?: number; h?: number }>>({})
  const [addMonsterId, setAddMonsterId] = useState("")
  const [addCharId, setAddCharId]       = useState("")
  const [hpStep, setHpStep]             = useState(1)

  // Keep a valid selection as encounters are created/removed
  useEffect(() => {
    if (activeId && encounters.some(e => e.id === activeId)) return
    setActiveId(encounters[0]?.id ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounters.map(e => e.id).join(",")])

  const active = encounters.find(e => e.id === activeId) ?? null

  function persist(next: Encounter[]) {
    updateObject(campaign.id, { data: { ...stored, encounters: next } as unknown as JSON }).catch(e => console.error(e))
  }

  function createEncounter() {
    const enc: Encounter = { id: nanoid(), name: `Encounter ${encounters.length + 1}`, round: 1, turnIndex: 0, combatants: [] }
    persist([...encounters, enc])
    setActiveId(enc.id)
  }
  function deleteEncounter(id: string) {
    persist(encounters.filter(e => e.id !== id))
  }
  function updateActive(patch: Partial<Encounter>) {
    if (!active) return
    persist(encounters.map(e => e.id === active.id ? { ...e, ...patch } : e))
  }

  function addMonster() {
    if (!addMonsterId || !active) return
    const m = monsters.find(o => o.id === addMonsterId)
    if (!m) return
    const src = safeParseJson(m.data) as SourceHp
    updateActive({ combatants: [...active.combatants, {
      id: nanoid(), refType: "monster", refId: m.id, name: m.name, initiative: 10,
      hp: src.hp ?? src.maxHp ?? 0, maxHp: src.maxHp ?? 0,
    }] })
    setAddMonsterId("")
  }
  function addCharacter() {
    if (!addCharId || !active) return
    const c = partyMembers.find(o => o.id === addCharId)
    if (!c) return
    // No hp/maxHp snapshot — PCs read live off the character object instead (see below).
    updateActive({ combatants: [...active.combatants, {
      id: nanoid(), refType: "character", refId: c.id, name: c.name, initiative: 10,
    }] })
    setAddCharId("")
  }
  function setInitiative(id: string, val: number) {
    if (!active) return
    updateActive({ combatants: active.combatants.map(c => c.id === id ? { ...c, initiative: val } : c) })
  }
  // Monsters: adjust the combatant's own independent HP snapshot.
  // Characters: adjust the real character object's HP — the DM edits the PC's actual sheet.
  function adjustHp(c: Combatant, delta: number) {
    if (c.refType === "character") {
      const charObj = partyMembers.find(p => p.id === c.refId)
      if (!charObj) return
      const src  = safeParseJson(charObj.data) as SourceHp
      const max  = src.maxHp
      const next = (src.hp ?? 0) + delta
      onUpdateCharacterHp(c.refId, Math.max(0, max ? Math.min(max, next) : next))
      return
    }
    if (!active) return
    updateActive({ combatants: active.combatants.map(cc => {
      if (cc.id !== c.id) return cc
      const max  = cc.maxHp
      const next = (cc.hp ?? 0) + delta
      return { ...cc, hp: Math.max(0, max ? Math.min(max, next) : next) }
    }) })
  }
  function removeCombatant(id: string) {
    if (!active) return
    const combatants = active.combatants.filter(c => c.id !== id)
    updateActive({ combatants, turnIndex: Math.min(active.turnIndex, Math.max(0, combatants.length - 1)) })
  }

  const ordered = active ? [...active.combatants].sort((a, b) => b.initiative - a.initiative) : []

  function nextTurn() {
    if (!active || ordered.length === 0) return
    const isLast = active.turnIndex >= ordered.length - 1
    updateActive({ turnIndex: isLast ? 0 : active.turnIndex + 1, round: isLast ? active.round + 1 : active.round })
  }
  function prevTurn() {
    if (!active || ordered.length === 0) return
    const isFirst = active.turnIndex <= 0
    updateActive({ turnIndex: isFirst ? ordered.length - 1 : active.turnIndex - 1, round: isFirst ? Math.max(1, active.round - 1) : active.round })
  }

  function togglePopout(monsterId: string) {
    setPopouts(prev => {
      if (prev[monsterId]) { const { [monsterId]: _removed, ...rest } = prev; return rest }
      const count = Object.keys(prev).length
      return { ...prev, [monsterId]: { x: 96 + count * 28, y: 96 + count * 28 } }
    })
  }
  function movePopout(id: string, x: number, y: number) {
    setPopouts(prev => prev[id] ? { ...prev, [id]: { ...prev[id], x, y } } : prev)
  }
  function resizePopout(id: string, w: number, h: number, x: number) {
    setPopouts(prev => prev[id] ? { ...prev, [id]: { ...prev[id], w, h, x } } : prev)
  }

  return (
    <div className="flex flex-col gap-4 p-4 overflow-auto flex-1">

      {/* Encounter chooser */}
      <div className="flex items-center gap-2 flex-wrap">
        {encounters.map(e => (
          <button key={e.id} type="button" onClick={() => setActiveId(e.id)}
            className={`px-3 py-1.5 text-xs rounded-full font-semibold transition-colors ${activeId === e.id ? "bg-foreground/20 text-foreground" : "bg-foreground/5 text-foreground/50 hover:text-foreground/80 hover:bg-foreground/10"}`}>
            {e.name}
          </button>
        ))}
        <button type="button" onClick={createEncounter}
          className="px-3 py-1.5 text-xs rounded-full bg-primary/70 hover:bg-primary text-foreground font-semibold transition-colors">
          + New Encounter
        </button>
      </div>

      {!active && (
        <p className="text-sm text-foreground/30 italic text-center py-10">No encounter selected — create one above.</p>
      )}

      {active && (
        <div className="flex flex-col gap-4 animate-in fade-in duration-200">
          {/* Header row */}
          <div className="rounded-xl bg-muted ring-1 ring-border p-4 flex items-center gap-3 flex-wrap">
            <input value={active.name} onChange={e => updateActive({ name: e.target.value })}
              className="bg-transparent text-sm font-bold text-foreground outline-none border-b border-transparent focus:border-foreground/20 transition-colors flex-1 min-w-32" />
            <span className="text-xs text-foreground/40 tabular-nums">Round {active.round}</span>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={prevTurn}
                className="text-xs px-2.5 py-1.5 rounded-full bg-foreground/10 hover:bg-foreground/20 text-foreground/60 hover:text-foreground transition-colors">
                ◀ Prev
              </button>
              <button type="button" onClick={nextTurn}
                className="text-xs px-2.5 py-1.5 rounded-full bg-primary/70 hover:bg-primary text-foreground font-semibold transition-colors">
                Next Turn ▶
              </button>
            </div>
            <button type="button" onClick={() => deleteEncounter(active.id)}
              className="text-xs text-red-400/60 hover:text-red-400 transition-colors">
              Delete Encounter
            </button>
          </div>

          {/* Add combatants */}
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <select value={addMonsterId} onChange={e => setAddMonsterId(e.target.value)}
                className="bg-muted rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none">
                <option value="">Add a monster…</option>
                {monsters.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <button type="button" onClick={addMonster} disabled={!addMonsterId}
                className="text-xs px-3 py-1.5 rounded-lg bg-foreground/10 hover:bg-foreground/20 disabled:opacity-30 text-foreground/70 hover:text-foreground transition-colors">
                + Add
              </button>
            </div>
            <div className="flex items-center gap-2">
              <select value={addCharId} onChange={e => setAddCharId(e.target.value)}
                className="bg-muted rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none">
                <option value="">Add a character…</option>
                {partyMembers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button type="button" onClick={addCharacter} disabled={!addCharId}
                className="text-xs px-3 py-1.5 rounded-lg bg-foreground/10 hover:bg-foreground/20 disabled:opacity-30 text-foreground/70 hover:text-foreground transition-colors">
                + Add
              </button>
            </div>
          </div>

          {/* Combatant list, sorted by initiative */}
          <div className="flex flex-col gap-1.5">
            {ordered.length > 0 && (
              <div className="flex items-center gap-1.5 self-end text-[10px] text-foreground/30">
                <span className="uppercase tracking-widest">HP step</span>
                <input type="number" min={1} value={hpStep}
                  onFocus={e => e.target.select()}
                  onChange={e => setHpStep(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-10 bg-foreground/10 rounded px-1 py-0.5 text-center text-foreground outline-none transition-colors focus:bg-foreground/15" />
              </div>
            )}
            {ordered.length === 0 && (
              <p className="text-xs text-foreground/25 italic text-center py-6">No combatants yet — add monsters or characters above.</p>
            )}
            {ordered.map((c, i) => {
              const isTurn      = i === active.turnIndex
              const monsterObj  = c.refType === "monster" ? monsters.find(m => m.id === c.refId) : undefined
              const charObj     = c.refType === "character" ? partyMembers.find(p => p.id === c.refId) : undefined
              const charHp      = charObj ? (safeParseJson(charObj.data) as SourceHp) : undefined
              const hp          = c.refType === "character" ? (charHp?.hp ?? 0) : (c.hp ?? 0)
              const maxHp       = c.refType === "character" ? charHp?.maxHp : c.maxHp
              const hpPercent   = maxHp ? Math.max(0, Math.min(100, Math.round(hp / maxHp * 100))) : null
              const hpBarColor  = hpPercent == null ? "bg-foreground/20" : hpPercent > 50 ? "bg-green-500" : hpPercent > 25 ? "bg-yellow-500" : "bg-red-500"
              return (
                <div key={c.id}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-all duration-200 ${isTurn ? "bg-primary/20 ring-1 ring-primary/60" : "bg-foreground/5 ring-1 ring-foreground/5"}`}>
                  {isTurn
                    ? <span className="text-primary text-xs shrink-0 animate-pulse" title="Current turn">▶</span>
                    : <span className="size-3 shrink-0" />}
                  <input type="number" value={c.initiative}
                    onChange={e => setInitiative(c.id, parseInt(e.target.value) || 0)}
                    className="w-12 bg-foreground/10 rounded px-1.5 py-1 text-center text-foreground text-xs font-bold outline-none transition-colors focus:bg-foreground/15" />
                  <span className={`text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-full shrink-0 ${c.refType === "monster" ? "bg-red-500/15 text-red-300" : "bg-sky-500/15 text-sky-300"}`}>
                    {c.refType === "monster" ? "Monster" : "PC"}
                  </span>
                  <span className="flex-1 min-w-0 text-sm text-foreground truncate">{c.name}</span>

                  {/* HP — monsters track an independent per-combatant snapshot; PCs are
                      live-linked to (and editable straight through to) the real character */}
                  <div className="flex items-center gap-1.5 shrink-0" title={c.refType === "character" ? "Linked to this character's sheet" : undefined}>
                    <button type="button" onClick={() => adjustHp(c, -hpStep)}
                      className="size-6 rounded-full bg-foreground/10 hover:bg-red-900 text-foreground hover:text-red-200 flex items-center justify-center text-xs font-bold transition-colors">
                      −
                    </button>
                    <div className="flex flex-col items-center gap-0.5 w-16">
                      <span className="text-xs font-mono text-foreground tabular-nums">{hp}{maxHp ? `/${maxHp}` : ""}</span>
                      {hpPercent != null && (
                        <div className="w-full h-1 rounded-full bg-foreground/10 overflow-hidden">
                          <div className={`h-full ${hpBarColor} transition-all duration-300`} style={{ width: `${hpPercent}%` }} />
                        </div>
                      )}
                    </div>
                    <button type="button" onClick={() => adjustHp(c, hpStep)}
                      className="size-6 rounded-full bg-foreground/10 hover:bg-green-900 text-foreground hover:text-green-200 flex items-center justify-center text-xs font-bold transition-colors">
                      +
                    </button>
                  </div>

                  {monsterObj && (
                    <button type="button" onClick={() => togglePopout(monsterObj.id)}
                      title={popouts[monsterObj.id] ? "Already popped out" : "Pop out stat block"}
                      className={`size-7 flex items-center justify-center rounded-lg hover:bg-foreground/10 text-sm shrink-0 transition-colors ${popouts[monsterObj.id] ? "text-primary" : "text-foreground/50 hover:text-foreground"}`}>
                      ⧉
                    </button>
                  )}
                  <button type="button" onClick={() => removeCombatant(c.id)}
                    className="text-foreground/20 hover:text-red-400 text-xs shrink-0 transition-colors">
                    ✕
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Popped-out monster stat blocks — draggable + resizable, same as familiars */}
      {Object.entries(popouts).map(([id, pos]) => {
        const m = monsters.find(o => o.id === id)
        if (!m) return null
        return (
          <FloatingPanel key={id} title={m.name}
            x={pos.x} y={pos.y} width={pos.w} height={pos.h}
            onMove={(x, y) => movePopout(id, x, y)}
            onResize={(w, h, x) => resizePopout(id, w, h, x)}
            onClose={() => togglePopout(id)}>
            <FamiliarMonsterView monster={m} />
          </FloatingPanel>
        )
      })}
    </div>
  )
}
