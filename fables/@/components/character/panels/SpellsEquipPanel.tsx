import React, { useState } from "react"
import type { CharacterData, SpellItem, EquipmentItem, SpellSlot } from "../../character-types"
import { SpellEntry }     from "../entries/SpellEntry"
import { EquipmentEntry } from "../entries/EquipmentEntry"
import { TracingSlider }  from "../../ui/tracing-slider"
import { slotLevelColor } from "../../character-themes"
import { profBonus }      from "../../character-utils"

interface Theme { accent: string }

interface Props {
  card: string
  theme: Theme
  data: CharacterData
  readOnly?: boolean
  spellItems: SpellItem[]
  equipItems: EquipmentItem[]
  spellSlots: SpellSlot[]
  slotAccent: string
  characterId: string
  onShowSpellcastingModal: () => void
  onChangeSlot: (id: string, patch: Partial<SpellSlot>) => void
  onAddSpell: () => void
  onChangeSpell: (id: string, patch: Partial<SpellItem>) => void
  onRemoveSpell: (id: string) => void
  onAddEquip: () => void
  onChangeEquip: (id: string, patch: Partial<EquipmentItem>) => void
  onRemoveEquip: (id: string) => void
}

export function SpellsEquipPanel({
  card, theme, data, readOnly,
  spellItems, equipItems, spellSlots, slotAccent, characterId,
  onShowSpellcastingModal, onChangeSlot,
  onAddSpell, onChangeSpell, onRemoveSpell,
  onAddEquip, onChangeEquip, onRemoveEquip,
}: Props) {
  const [showSpells, setShowSpells] = useState(true)
  const [spellSort, setSpellSort]   = useState<"level" | "alpha">("level")
  const [hideUnprepared, setHideUnprepared] = useState(() => {
    try { return localStorage.getItem(`fables-prep-filter-${characterId}`) === "1" } catch { return false }
  })
  const [collapsedLevels, setCollapsedLevels] = useState<Set<number>>(() => {
    try {
      const raw = localStorage.getItem(`fables-spell-collapsed-${characterId}`)
      return raw ? new Set(JSON.parse(raw) as number[]) : new Set()
    } catch { return new Set() }
  })

  const preparedCount  = spellItems.filter(s => s.prepared && !s.alwaysPrepared).length
  const visibleSpells  = spellItems
    .filter(s => !hideUnprepared || s.prepared || s.alwaysPrepared)
    .slice()
    .sort((a, b) => spellSort === "alpha" ? (a.name || "").localeCompare(b.name || "") : (a.level ?? 0) - (b.level ?? 0))

  const statMods = {
    str: Math.floor(((data.strength     ?? 10) - 10) / 2),
    dex: Math.floor(((data.dexterity    ?? 10) - 10) / 2),
    con: Math.floor(((data.constitution ?? 10) - 10) / 2),
    int: Math.floor(((data.intelligence ?? 10) - 10) / 2),
    wis: Math.floor(((data.wisdom       ?? 10) - 10) / 2),
    cha: Math.floor(((data.charisma     ?? 10) - 10) / 2),
  }

  return (
    <div className={`${card} p-4 flex flex-col gap-3`}>

      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap shrink-0">
        <div className="flex items-center gap-1 rounded-full bg-white/10 p-0.5 shrink-0">
          <button type="button" onClick={() => setShowSpells(true)}
            className={`text-xs px-3 py-1 rounded-full font-semibold transition-colors ${showSpells ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70"}`}>
            Spells
          </button>
          <button type="button" onClick={() => setShowSpells(false)}
            className={`text-xs px-3 py-1 rounded-full font-semibold transition-colors ${!showSpells ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70"}`}>
            Martial
          </button>
        </div>

        {showSpells && (
          <div className="flex items-center gap-5 flex-1 flex-wrap">
            {data.spellcastingAbility && (
              <div className="flex flex-col items-center leading-none gap-0.5">
                <span className="text-base font-bold text-white/70 uppercase tracking-wider">{data.spellcastingAbility}</span>
                <span className="text-[10px] text-white/35 uppercase tracking-wider">Ability</span>
              </div>
            )}
            <div className="flex flex-col items-center leading-none gap-0.5">
              <span className="text-lg font-bold text-white tabular-nums">{data.spellSaveDC ?? "—"}</span>
              <span className="text-[10px] text-white/40 uppercase tracking-wider">Save DC</span>
            </div>
            <div className="flex flex-col items-center leading-none gap-0.5">
              <span className="text-lg font-bold text-white tabular-nums">{data.spellAttackBonus != null ? `+${data.spellAttackBonus}` : "—"}</span>
              <span className="text-[10px] text-white/40 uppercase tracking-wider">Spell Atk</span>
            </div>
            <div className="flex flex-col items-center leading-none gap-0.5">
              <span className={`text-lg font-bold tabular-nums ${preparedCount > (data.spellsPrepared ?? data.spellsKnown ?? Infinity) ? "text-red-400" : "text-white"}`}>
                {preparedCount}<span className="text-white/30 text-sm">/{data.spellsPrepared ?? data.spellsKnown ?? "—"}</span>
              </span>
              <span className="text-[10px] text-white/40 uppercase tracking-wider">Prepared</span>
            </div>
            <div className="flex flex-col items-center leading-none gap-0.5">
              <span className="text-lg font-bold text-white tabular-nums">{data.cantripsKnown ?? "—"}</span>
              <span className="text-[10px] text-white/40 uppercase tracking-wider">Cantrips</span>
            </div>
            <button type="button" onClick={onShowSpellcastingModal}
              className="size-10 text-2xl flex items-center justify-center rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors ml-auto shrink-0"
              title="Configure spellcasting">⚙</button>
          </div>
        )}
      </div>

      {/* Spell slots */}
      {showSpells && spellSlots.length > 0 && (
        <div className="flex flex-col gap-2 border-b border-white/10 pb-3 shrink-0">
          {spellSlots.map(slot => {
            const rem = Math.max(0, slot.total - slot.used)
            return (
              <div key={slot.id} className="flex items-center gap-2">
                <div className="flex items-center gap-1 w-[72px] shrink-0">
                  <span className="text-xs text-white/50 w-8 shrink-0">Lv {slot.level}</span>
                  {slot.pact && (
                    <span className="text-[10px] px-1 py-0.5 rounded bg-violet-500/20 text-violet-300 font-semibold leading-none">Pact</span>
                  )}
                </div>
                <TracingSlider
                  value={rem} max={slot.total} disabled={readOnly}
                  showButtons buttonSize="sm"
                  color={slotLevelColor(slotAccent, slot.level)}
                  onChange={val => onChangeSlot(slot.id, { used: Math.max(0, slot.total - val) })}
                />
                <span className="text-xs text-white/30 w-8 text-right tabular-nums shrink-0">{rem}/{slot.total}</span>
              </div>
            )
          })}
        </div>
      )}
      {showSpells && spellSlots.length === 0 && !readOnly && (
        <button type="button" onClick={onShowSpellcastingModal}
          className="text-xs text-white/30 hover:text-white/60 transition-colors text-left shrink-0">
          + Add spell slots
        </button>
      )}

      {/* Sort / filter controls */}
      {showSpells && (
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <div className="flex items-center gap-0.5 rounded-full bg-white/10 p-0.5">
            <button type="button" onClick={() => setSpellSort("level")}
              className={`text-xs px-2.5 py-0.5 rounded-full font-semibold transition-colors ${spellSort === "level" ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70"}`}>
              Level
            </button>
            <button type="button" onClick={() => setSpellSort("alpha")}
              className={`text-xs px-2.5 py-0.5 rounded-full font-semibold transition-colors ${spellSort === "alpha" ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70"}`}>
              A–Z
            </button>
          </div>
          <button type="button"
            onClick={() => setHideUnprepared(h => {
              const next = !h
              try { localStorage.setItem(`fables-prep-filter-${characterId}`, next ? "1" : "0") } catch {}
              return next
            })}
            className={`text-xs px-2.5 py-0.5 rounded-full font-semibold transition-colors border ${hideUnprepared ? "bg-primary/20 border-primary/50 text-white" : "border-white/15 text-white/40 hover:text-white/70 hover:border-white/30"}`}>
            Prepared only
          </button>
          {hideUnprepared && visibleSpells.length === 0 && (
            <span className="text-xs text-white/25 italic">No prepared spells</span>
          )}
        </div>
      )}

      {/* Spell / martial list */}
      <div className="flex flex-col gap-1.5">
        {showSpells ? (
          <>
            {spellSort === "level" ? (() => {
              const grouped = new Map<number, typeof visibleSpells>()
              for (const s of visibleSpells) {
                const lvl = s.level ?? 0
                if (!grouped.has(lvl)) grouped.set(lvl, [])
                grouped.get(lvl)!.push(s)
              }
              const levels = Array.from(grouped.keys()).sort((a, b) => a - b)
              return levels.map(lvl => {
                const spells     = grouped.get(lvl)!
                const isOpen     = !collapsedLevels.has(lvl)
                const groupLabel = lvl === 0 ? "Cantrips" : `Level ${lvl}`
                return (
                  <div key={lvl} className="flex flex-col gap-1">
                    <button type="button"
                      onClick={() => setCollapsedLevels(prev => {
                        const next = new Set(prev)
                        next.has(lvl) ? next.delete(lvl) : next.add(lvl)
                        try { localStorage.setItem(`fables-spell-collapsed-${characterId}`, JSON.stringify([...next])) } catch {}
                        return next
                      })}
                      className="flex items-center gap-2 px-1 py-0.5 rounded-lg hover:bg-white/5 transition-colors select-none">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/35">{groupLabel}</span>
                      <span className="text-[10px] text-white/20">({spells.length})</span>
                    </button>
                    {isOpen && spells.map(spell => (
                      <SpellEntry key={spell.id} spell={spell} theme={theme} readOnly={readOnly}
                        onChange={p => onChangeSpell(spell.id, p)} onRemove={() => onRemoveSpell(spell.id)} />
                    ))}
                  </div>
                )
              })
            })() : visibleSpells.map(spell => (
              <SpellEntry key={spell.id} spell={spell} theme={theme} readOnly={readOnly}
                onChange={p => onChangeSpell(spell.id, p)} onRemove={() => onRemoveSpell(spell.id)} />
            ))}
            {!readOnly && (
              <button type="button" onClick={onAddSpell}
                className="text-sm text-white/40 hover:text-white border border-dashed border-white/15 hover:border-white/30 rounded-xl py-2.5 transition-colors shrink-0">
                + Add Spell
              </button>
            )}
          </>
        ) : (
          <>
            {equipItems.map(item => (
              <EquipmentEntry key={item.id} item={item} theme={theme} readOnly={readOnly}
                onChange={p => onChangeEquip(item.id, p)} onRemove={() => onRemoveEquip(item.id)}
                statMods={statMods}
                pb={profBonus(data.level ?? 1)}
              />
            ))}
            {!readOnly && (
              <button type="button" onClick={onAddEquip}
                className="text-sm text-white/40 hover:text-white border border-dashed border-white/15 hover:border-white/30 rounded-xl py-2.5 transition-colors shrink-0">
                + Add Item
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
