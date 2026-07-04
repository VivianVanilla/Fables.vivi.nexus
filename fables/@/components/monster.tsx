// ════════════════════════════════════════════════════════════════════════════
// monster.tsx — MonsterSheet root component + shared MonsterStatBlock
//
// MonsterStatBlock renders the stats/actions/spellcasting portion and is reused
// (via FamiliarMonsterView) by the character sheet's Familiars tab and its
// pop-out window, so editing a familiar's stat block there writes straight
// back to the shared Monster object — it's a live reference, not a copy.
// ════════════════════════════════════════════════════════════════════════════

import React, { useRef, useState } from "react"
import type { SidebarObject } from "@/components/sidebar-utils"
import type { userInfo } from "@/types/userInfo"
import { useUserContext } from "../../src/contexts/UserContext"
import { supabase } from "../../src/supabase"

import type { MonsterData, MonsterAction, ActionCategory } from "./monster-types"
import type { SpellItem, SpellSlot } from "./character-types"
import type { Theme } from "./character-themes"
import { SUPABASE_BUCKET } from "./character-constants"
import { nanoid, safeParseJson } from "./character-utils"
import { slotLevelColor } from "./character-themes"

import { MarkdownTextarea } from "./ui/MarkdownTextarea"
import { Markdown } from "./ui/Markdown"
import { TracingSlider } from "./ui/tracing-slider"
import { NumInput } from "./character/ui/NumInput"
import { Modal } from "./character/ui/Modal"

import { ActionEntry } from "./character/entries/ActionEntry"
import { SpellEntry } from "./character/entries/SpellEntry"

const LUCKY_EMAIL = "loganadsit@gmail.com"

// ── Constants ─────────────────────────────────────────────────────────────────

interface Props {
  monster: SidebarObject
  onClose: () => void
  readOnly?: boolean
}

const ABILITY_KEYS = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"] as const
const ABILITY_ABBR: Record<string, string> = {
  strength: "STR", dexterity: "DEX", constitution: "CON",
  intelligence: "INT", wisdom: "WIS", charisma: "CHA",
}
const ABILITY_COLORS: Record<string, string> = {
  strength: "text-red-400", dexterity: "text-green-400", constitution: "text-orange-400",
  intelligence: "text-blue-400", wisdom: "text-purple-400", charisma: "text-pink-400",
}

const ACTION_SECTIONS: { key: "actions" | "bonusActions" | "reactions" | "legendaryActions"; category: ActionCategory; label: string }[] = [
  { key: "actions", category: "action", label: "Actions" },
  { key: "bonusActions", category: "bonusAction", label: "Bonus Actions" },
  { key: "reactions", category: "reaction", label: "Reactions" },
  { key: "legendaryActions", category: "legendary", label: "Legendary Actions" },
]

const SECTION_HEADER_COLOR: Record<ActionCategory, string> = {
  action: "text-sky-300", bonusAction: "text-amber-300", reaction: "text-violet-300", legendary: "text-yellow-300",
}

const CARD = "rounded-xl bg-zinc-900 ring-1 ring-zinc-700"

const NEUTRAL_THEME: Theme = {
  label: "Neutral",
  body: "bg-zinc-950", box: "bg-zinc-800", lightBody: "bg-zinc-800", lightBox: "bg-zinc-700",
  ring: "ring-zinc-700", header: "bg-zinc-950", color: "text-white", accent: "#F59E0B",
}

function abilityMod(score: number): string {
  const mod = Math.floor((score - 10) / 2)
  return mod >= 0 ? `+${mod}` : `${mod}`
}

// ── Small display/edit helpers ──────────────────────────────────────────────

function NumTile({ label, value, onChange, readOnly }: { label: string; value?: number; onChange: (v: number) => void; readOnly?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg bg-white/5 px-2.5 py-1.5 min-w-14">
      {readOnly ? (
        <span className="text-base font-bold text-white">{value ?? 0}</span>
      ) : (
        <NumInput value={value ?? 0} onChange={e => onChange(parseInt(e.target.value) || 0)}
          className="w-10 text-center bg-transparent text-base font-bold text-white outline-none" />
      )}
      <span className="text-[9px] uppercase tracking-widest text-white/40 whitespace-nowrap">{label}</span>
    </div>
  )
}

function TextTile({ label, value, onChange, readOnly, placeholder }: { label: string; value?: string; onChange: (v: string) => void; readOnly?: boolean; placeholder?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg bg-white/5 px-2.5 py-1.5 min-w-16 max-w-28">
      {readOnly ? (
        <span className="text-xs font-semibold text-white truncate max-w-full">{value || "—"}</span>
      ) : (
        <input value={value ?? ""} placeholder={placeholder} onChange={e => onChange(e.target.value)}
          className="w-full text-center bg-transparent text-xs font-semibold text-white outline-none placeholder:text-white/20" />
      )}
      <span className="text-[9px] uppercase tracking-widest text-white/40 whitespace-nowrap">{label}</span>
    </div>
  )
}

function CompactField({ label, value, onChange, readOnly }: { label: string; value?: string; onChange: (v: string) => void; readOnly?: boolean }) {
  if (readOnly && !value) return null
  return (
    <div className="flex items-center gap-1.5 text-xs min-w-0">
      <span className="text-white/40 uppercase tracking-wider text-[9px] shrink-0 w-20 sm:w-24">{label}</span>
      {readOnly ? (
        <span className="text-white/70 truncate min-w-0">{value || "—"}</span>
      ) : (
        <input value={value ?? ""} onChange={e => onChange(e.target.value)}
          className="flex-1 min-w-0 bg-transparent outline-none text-white/70 border-b border-white/10 focus:border-white/30 py-0.5" />
      )}
    </div>
  )
}

function ActionSection({
  label, category, actions, readOnly, onAdd, onChange, onRemove, extra, toggle,
}: {
  label: string; category: ActionCategory; actions: MonsterAction[]; readOnly?: boolean
  onAdd: () => void; onChange: (id: string, patch: Partial<MonsterAction>) => void; onRemove: (id: string) => void
  extra?: React.ReactNode
  toggle?: { enabled: boolean; onChange: (v: boolean) => void }
}) {
  const enabled = toggle ? toggle.enabled : true
  if (readOnly && (!enabled || actions.length === 0)) return null
  return (
    <div className={`${CARD} p-4 flex flex-col gap-2`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className={`text-xs uppercase tracking-widest font-semibold ${SECTION_HEADER_COLOR[category]}`}>{label}</span>
        {enabled && extra}
        {toggle && !readOnly && (
          <label className="flex items-center gap-2 text-xs text-white/50 cursor-pointer select-none">
            <input type="checkbox" checked={toggle.enabled} onChange={e => toggle.onChange(e.target.checked)} />
            Has {label.toLowerCase()}
          </label>
        )}
        {!readOnly && enabled && (
          <button type="button" onClick={onAdd}
            className="text-xs px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors">
            + Add
          </button>
        )}
      </div>
      {enabled && (
        <>
          {actions.length === 0 && !readOnly && <p className="text-xs text-white/20 italic">Nothing here yet.</p>}
          <div className="flex flex-col gap-1.5">
            {actions.map(a => (
              <ActionEntry key={a.id} action={a} category={category} readOnly={readOnly}
                onChange={p => onChange(a.id, p)} onRemove={() => onRemove(a.id)} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function LegendaryTracker({
  used, max, readOnly, onChangeMax, onChangeUsed,
}: { used: number; max: number; readOnly?: boolean; onChangeMax: (n: number) => void; onChangeUsed: (n: number) => void }) {
  const remaining = Math.max(0, max - used)
  return (
    <div className="flex items-center gap-2 flex-1 min-w-40">
      <TracingSlider value={remaining} max={max} disabled={readOnly} showButtons buttonSize="sm"
        color="#EAB308" onChange={val => onChangeUsed(Math.max(0, max - val))} className="flex-1 min-w-0" />
      <span className="text-xs text-white/40 tabular-nums shrink-0">{remaining}/{max} left</span>
      {!readOnly && (
        <label className="flex items-center gap-1 text-[10px] text-white/30 shrink-0">
          Max
          <NumInput value={max} min={0} onChange={e => onChangeMax(parseInt(e.target.value) || 0)}
            className="w-10 bg-white/10 rounded px-1 text-center text-white outline-none" />
        </label>
      )}
    </div>
  )
}

// ── Shared stat-block body ──────────────────────────────────────────────────

interface StatBlockProps {
  data: MonsterData
  onUpdate: (patch: Partial<MonsterData>) => void
  readOnly?: boolean
}

export function MonsterStatBlock({ data, onUpdate, readOnly = false }: StatBlockProps) {
  const { user } = useUserContext()
  const isLucky = user?.email === LUCKY_EMAIL
  const [luckySpell, setLuckySpell] = useState<SpellItem | null>(null)

  const actionsBySection = {
    actions: data.actions ?? [],
    bonusActions: data.bonusActions ?? [],
    reactions: data.reactions ?? [],
    legendaryActions: data.legendaryActions ?? [],
  }

  function addAction(key: keyof typeof actionsBySection) {
    onUpdate({ [key]: [...actionsBySection[key], { id: nanoid(), name: "" }] } as Partial<MonsterData>)
  }
  function changeAction(key: keyof typeof actionsBySection, id: string, patch: Partial<MonsterAction>) {
    onUpdate({ [key]: actionsBySection[key].map(a => a.id === id ? { ...a, ...patch } : a) } as Partial<MonsterData>)
  }
  function removeAction(key: keyof typeof actionsBySection, id: string) {
    onUpdate({ [key]: actionsBySection[key].filter(a => a.id !== id) } as Partial<MonsterData>)
  }

  const spellItems = data.spellItems ?? []
  const spellSlots = data.spellSlots ?? []

  function addSpell()                                       { onUpdate({ spellItems: [...spellItems, { id: nanoid(), name: "", level: 0 }] }) }
  function changeSpell(id: string, patch: Partial<SpellItem>) { onUpdate({ spellItems: spellItems.map(s => s.id === id ? { ...s, ...patch } : s) }) }
  function removeSpell(id: string)                          { onUpdate({ spellItems: spellItems.filter(s => s.id !== id) }) }

  function addSlotLevel() {
    const nextLevel = Math.min(9, (spellSlots.reduce((max, s) => Math.max(max, s.level), 0) || 0) + 1)
    onUpdate({ spellSlots: [...spellSlots, { id: nanoid(), level: nextLevel, total: 1, used: 0, resetsOn: "long" }] })
  }
  function changeSlot(id: string, patch: Partial<SpellSlot>) { onUpdate({ spellSlots: spellSlots.map(s => s.id === id ? { ...s, ...patch } : s) }) }
  function removeSlot(id: string)                            { onUpdate({ spellSlots: spellSlots.filter(s => s.id !== id) }) }

  const grouped = new Map<number, SpellItem[]>()
  for (const s of spellItems) {
    const lvl = s.level ?? 0
    if (!grouped.has(lvl)) grouped.set(lvl, [])
    grouped.get(lvl)!.push(s)
  }
  for (const slot of spellSlots) if (!grouped.has(slot.level)) grouped.set(slot.level, [])
  const levels = Array.from(grouped.keys()).sort((a, b) => a - b)

  // Explicit toggles — fall back to auto-detecting existing data for monsters
  // created before the toggle existed.
  const spellcastingEnabled = data.hasSpellcasting ?? (levels.length > 0 || !!data.spellcastingAbility)
  const legendaryEnabled    = data.hasLegendaryActions ?? (data.legendaryActions ?? []).length > 0

  function feelingLucky() {
    if (spellItems.length === 0) return
    setLuckySpell(spellItems[Math.floor(Math.random() * spellItems.length)])
  }

  return (
    <div className="flex flex-col gap-4">

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <div className={`${CARD} p-3 flex flex-col gap-2.5`}>
        <div className="flex flex-wrap gap-1.5">
          <NumTile label="AC" value={data.ac} onChange={v => onUpdate({ ac: v })} readOnly={readOnly} />
          <div className="flex flex-col items-center gap-0.5 rounded-lg bg-white/5 px-2.5 py-1.5 min-w-14">
            <div className="flex items-baseline gap-1">
              {readOnly ? <span className="text-base font-bold text-white">{data.hp ?? 0}</span> :
                <NumInput value={data.hp ?? 0} onChange={e => onUpdate({ hp: parseInt(e.target.value) || 0 })}
                  className="w-9 text-center bg-transparent text-base font-bold text-white outline-none" />}
              <span className="text-xs text-white/30">/</span>
              {readOnly ? <span className="text-xs text-white/40">{data.maxHp ?? 0}</span> :
                <NumInput value={data.maxHp ?? 0} onChange={e => onUpdate({ maxHp: parseInt(e.target.value) || 0 })}
                  className="w-9 text-center bg-transparent text-xs text-white/50 outline-none" />}
            </div>
            <span className="text-[9px] uppercase tracking-widest text-white/40">HP</span>
          </div>
          <TextTile label="Hit Dice" value={data.hitDice} onChange={v => onUpdate({ hitDice: v })} readOnly={readOnly} placeholder="9d8+18" />
          <TextTile label="Speed" value={data.speed} onChange={v => onUpdate({ speed: v })} readOnly={readOnly} placeholder="30 ft." />
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
          {ABILITY_KEYS.map(key => {
            const score = (data[key] as number | undefined) ?? 10
            return (
              <div key={key} className="flex flex-col items-center gap-0.5 rounded-lg bg-white/5 py-1.5">
                <span className={`text-[9px] uppercase tracking-widest font-bold ${ABILITY_COLORS[key]}`}>{ABILITY_ABBR[key]}</span>
                {readOnly ? (
                  <span className="text-sm font-bold text-white">{score}</span>
                ) : (
                  <NumInput value={score} onChange={e => onUpdate({ [key]: parseInt(e.target.value) || 0 } as Partial<MonsterData>)}
                    className="w-8 text-center bg-transparent text-sm font-bold text-white outline-none" />
                )}
                <span className={`text-[10px] font-mono ${ABILITY_COLORS[key]}`}>{abilityMod(score)}</span>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 border-t border-white/10 pt-2.5">
          <CompactField label="Saving Throws"         value={data.savingThrows}          onChange={v => onUpdate({ savingThrows: v })}          readOnly={readOnly} />
          <CompactField label="Skills"                value={data.skills}                onChange={v => onUpdate({ skills: v })}                readOnly={readOnly} />
          <CompactField label="Dmg Resistances"       value={data.damageResistances}      onChange={v => onUpdate({ damageResistances: v })}     readOnly={readOnly} />
          <CompactField label="Dmg Immunities"        value={data.damageImmunities}       onChange={v => onUpdate({ damageImmunities: v })}      readOnly={readOnly} />
          <CompactField label="Dmg Vulnerabilities"   value={data.damageVulnerabilities}  onChange={v => onUpdate({ damageVulnerabilities: v })} readOnly={readOnly} />
          <CompactField label="Condition Immunities"  value={data.conditionImmunities}    onChange={v => onUpdate({ conditionImmunities: v })}   readOnly={readOnly} />
          <CompactField label="Senses"                value={data.senses}                onChange={v => onUpdate({ senses: v })}                readOnly={readOnly} />
          <CompactField label="Languages"              value={data.languages}             onChange={v => onUpdate({ languages: v })}             readOnly={readOnly} />
          <CompactField label="Challenge"              value={data.challengeRating}       onChange={v => onUpdate({ challengeRating: v })}       readOnly={readOnly} />
          <CompactField label="Prof. Bonus"            value={data.proficiencyBonus != null ? String(data.proficiencyBonus) : ""}
            onChange={v => onUpdate({ proficiencyBonus: v ? parseInt(v) || 0 : undefined })} readOnly={readOnly} />
        </div>
      </div>

      {/* ── Action sections ──────────────────────────────────────────────── */}
      {ACTION_SECTIONS.map(({ key, category, label }) => (
        <ActionSection key={key} label={label} category={category}
          actions={actionsBySection[key]} readOnly={readOnly}
          onAdd={() => addAction(key)}
          onChange={(id, patch) => changeAction(key, id, patch)}
          onRemove={id => removeAction(key, id)}
          toggle={key === "legendaryActions" ? {
            enabled: legendaryEnabled,
            onChange: v => onUpdate({ hasLegendaryActions: v }),
          } : undefined}
          extra={key === "legendaryActions" ? (
            <LegendaryTracker
              used={data.legendaryActionsUsed ?? 0}
              max={data.legendaryActionsMax ?? 3}
              readOnly={readOnly}
              onChangeMax={n => onUpdate({ legendaryActionsMax: n })}
              onChangeUsed={n => onUpdate({ legendaryActionsUsed: n })}
            />
          ) : undefined}
        />
      ))}

      {/* ── Spellcasting ─────────────────────────────────────────────────── */}
      {(!readOnly || spellcastingEnabled) && (
        <div className={`${CARD} p-4 flex flex-col gap-3`}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs uppercase tracking-widest text-white/50 font-semibold">Spellcasting</span>
            {!readOnly && (
              <label className="flex items-center gap-2 text-xs text-white/50 cursor-pointer select-none">
                <input type="checkbox" checked={spellcastingEnabled}
                  onChange={e => onUpdate({ hasSpellcasting: e.target.checked })} />
                Has spellcasting
              </label>
            )}
          </div>

          {spellcastingEnabled && (
      <>
          <div className="flex flex-wrap items-center gap-2">
            <TextTile label="Caster Level" value={data.spellcastingLevel} onChange={v => onUpdate({ spellcastingLevel: v })} readOnly={readOnly} placeholder="9th" />
            <NumTile label="Spell Atk" value={data.spellAttackBonus} onChange={v => onUpdate({ spellAttackBonus: v })} readOnly={readOnly} />
            <NumTile label="Spell Save DC" value={data.spellSaveDC} onChange={v => onUpdate({ spellSaveDC: v })} readOnly={readOnly} />
            <TextTile label="Ability" value={data.spellcastingAbility} onChange={v => onUpdate({ spellcastingAbility: v })} readOnly={readOnly} placeholder="INT" />
            {isLucky && spellItems.length > 0 && (
              <button type="button" onClick={feelingLucky}
                className="ml-auto text-xs font-extrabold px-3 py-1.5 rounded-full text-white shadow-lg transition-transform hover:scale-105 active:scale-95 shrink-0"
                style={{
                  backgroundImage: "linear-gradient(90deg, #ff0000, #ff9900, #33cc33, #0066ff, #9900cc, #ff0000)",
                  backgroundSize: "200% 100%",
                  animation: "fables-rainbow 3s linear infinite",
                }}>
                IM FEELING HEBI
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {levels.map(lvl => (
              <div key={lvl} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-3 flex-wrap px-1">
                  <span className="text-sm font-bold uppercase tracking-widest text-white/75">{lvl === 0 ? "Cantrips" : `Level ${lvl}`}</span>
                  {spellSlots.filter(s => s.level === lvl).map(slot => {
                    const rem = Math.max(0, slot.total - slot.used)
                    return (
                      <div key={slot.id} className="flex items-center gap-1.5">
                        <TracingSlider value={rem} max={slot.total} disabled={readOnly}
                          showButtons buttonSize="sm" color={slotLevelColor("#F59E0B", lvl || 1)}
                          onChange={val => changeSlot(slot.id, { used: Math.max(0, slot.total - val) })}
                          className="w-32" />
                        <span className="text-xs text-white/30 tabular-nums shrink-0">{rem}/{slot.total}</span>
                        {!readOnly && (
                          <>
                            <NumInput value={slot.total} min={0} onChange={e => changeSlot(slot.id, { total: parseInt(e.target.value) || 0 })}
                              className="w-12 bg-white/10 rounded px-1 py-0.5 text-center text-white text-xs outline-none" />
                            <button type="button" onClick={() => removeSlot(slot.id)}
                              className="text-white/20 hover:text-red-400 text-xs px-1" title="Remove slot row">✕</button>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
                {grouped.get(lvl)!.map(spell => (
                  <SpellEntry key={spell.id} spell={spell} theme={NEUTRAL_THEME} readOnly={readOnly} showPrepToggle={false}
                    onChange={p => changeSpell(spell.id, p)} onRemove={() => removeSpell(spell.id)} />
                ))}
              </div>
            ))}

            {!readOnly && (
              <div className="flex items-center gap-2 flex-wrap">
                <button type="button" onClick={addSpell}
                  className="text-sm text-white/40 hover:text-white border border-dashed border-white/15 hover:border-white/30 rounded-xl py-2 px-3 transition-colors">
                  + Add Spell
                </button>
                <button type="button" onClick={addSlotLevel}
                  className="text-sm text-white/40 hover:text-white border border-dashed border-white/15 hover:border-white/30 rounded-xl py-2 px-3 transition-colors">
                  + Add Slot Level
                </button>
              </div>
            )}
          </div>
      </>
          )}
        </div>
      )}

      {isLucky && (
        <style>{"@keyframes fables-rainbow { from { background-position: 0% 50%; } to { background-position: 200% 50%; } }"}</style>
      )}

      {luckySpell && (
        <Modal onClose={() => setLuckySpell(null)}>
          <div className="bg-zinc-900 border border-white/15 rounded-2xl shadow-2xl w-[min(420px,calc(100vw-2rem))] overflow-hidden">
            <div className="p-6 flex flex-col items-center text-center gap-3"
              style={{ backgroundImage: "linear-gradient(135deg, #ff000033, #ff990033, #33cc3333, #0066ff33, #9900cc33)" }}>
              <p className="text-2xl font-black text-white drop-shadow">YAYAY OMFG NEW SPELL :D</p>
              <p className="text-lg font-bold text-white">{luckySpell.name || "Unnamed Spell"}</p>
              <p className="text-sm text-white/70">
                {luckySpell.level === 0 ? "Cantrip" : `Level ${luckySpell.level}`}{luckySpell.school ? ` · ${luckySpell.school}` : ""}
              </p>
              {luckySpell.notes && (
                <div className="max-h-40 overflow-y-auto text-left w-full">
                  <Markdown text={luckySpell.notes} tone="dark" />
                </div>
              )}
              <button type="button" onClick={() => setLuckySpell(null)}
                className="mt-2 text-sm font-semibold px-4 py-2 rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors">
                Nice!
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Shared data hook — debounced load/save against the Monster object ───────
//
// Used by MonsterSheet (the full editor) and FamiliarMonsterView (the compact
// view rendered from a character's Familiars tab / pop-out window) so editing
// a familiar's stat block writes straight back to the shared Monster object.

export function useMonsterData(monster: userInfo.Objects, readOnly = false) {
  const { updateObject } = useUserContext()
  const [data, setData] = useState<MonsterData>(() => safeParseJson(monster.data) as MonsterData)
  const [saving, setSaving] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function update(patch: Partial<MonsterData>) {
    if (readOnly) return
    const next = { ...data, ...patch }
    setData(next)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      try { await updateObject(monster.id, { data: next as unknown as JSON }) }
      catch (e) { console.error(e) }
      setSaving(false)
    }, 700)
  }

  return { data, update, saving }
}

// ── Compact editable view for a familiar's shortcut (Familiars tab / pop-out) ─

export function FamiliarMonsterView({ monster, readOnly = false }: { monster: userInfo.Objects; readOnly?: boolean }) {
  const { data, update } = useMonsterData(monster, readOnly)
  return <MonsterStatBlock data={data} onUpdate={update} readOnly={readOnly} />
}

// ── Root sheet ───────────────────────────────────────────────────────────────

export function MonsterSheet({ monster, onClose, readOnly = false }: Props) {
  const { user, updateObject } = useUserContext()

  const { data, update, saving } = useMonsterData(monster, readOnly)
  const [uploading, setUploading] = useState(false)
  const [showLighting, setShowLighting] = useState(false)
  const [name, setName] = useState(monster.name)

  const nameTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const portraitRef = useRef<HTMLInputElement>(null)

  function handleNameChange(v: string) {
    if (readOnly) return
    setName(v)
    if (nameTimer.current) clearTimeout(nameTimer.current)
    nameTimer.current = setTimeout(async () => {
      try { await updateObject(monster.id, { name: v || "Unnamed Monster" }) }
      catch (e) { console.error(e) }
    }, 700)
  }

  async function uploadPortrait(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return
    setUploading(true)
    const ext  = file.name.split(".").pop() ?? "png"
    const path = `${user.id}/monster_${monster.id}.${ext}`
    const { error } = await supabase.storage.from(SUPABASE_BUCKET).upload(path, file, { upsert: true })
    if (!error) {
      const { data: urlData } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(path)
      update({ portrait: urlData.publicUrl })
    }
    setUploading(false)
    e.target.value = ""
  }

  const filter    = data.portraitFilter ?? { brightness: 100, contrast: 100, saturate: 100 }
  const filterCss = `brightness(${filter.brightness}%) contrast(${filter.contrast}%) saturate(${filter.saturate}%)`

  return (
    <div className="flex flex-col h-full min-h-0 text-white rounded-xl overflow-hidden bg-zinc-950">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 shrink-0 bg-zinc-950">
        {readOnly ? (
          <p className="flex-1 min-w-0 text-base font-bold tracking-wide truncate">{name || "Unnamed Monster"}</p>
        ) : (
          <input value={name} placeholder="Monster name" onChange={e => handleNameChange(e.target.value)}
            className="flex-1 min-w-0 bg-transparent outline-none text-base font-bold tracking-wide truncate placeholder:text-white/30" />
        )}
        {readOnly && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/40 uppercase tracking-widest shrink-0">View Only</span>
        )}
        {saving && <span className="text-xs text-white/40 shrink-0">saving…</span>}
        <button type="button" onClick={onClose}
          className="size-7 flex items-center justify-center rounded-md hover:bg-white/10 text-white/50 hover:text-white transition-colors shrink-0">
          ✕
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-auto p-4 flex flex-col gap-4">

        {/* Name/description + artwork */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <div className="flex gap-2">
              <input value={data.creatureType ?? ""} readOnly={readOnly} placeholder="Medium beast"
                onChange={e => update({ creatureType: e.target.value })}
                className="flex-1 min-w-0 bg-white/5 rounded-lg px-2 py-1 text-xs text-white/70 outline-none placeholder:text-white/20" />
              <input value={data.alignment ?? ""} readOnly={readOnly} placeholder="unaligned"
                onChange={e => update({ alignment: e.target.value })}
                className="w-32 shrink-0 bg-white/5 rounded-lg px-2 py-1 text-xs text-white/70 outline-none placeholder:text-white/20" />
            </div>
            {readOnly ? (
              data.description
                ? <Markdown text={data.description} tone="dark" />
                : <p className="text-sm text-white/20 italic">No description.</p>
            ) : (
              <MarkdownTextarea value={data.description ?? ""} onChange={v => update({ description: v })}
                placeholder="Description…" rows={6}
                className="bg-white/5 rounded-lg px-3 py-2 outline-none text-sm text-white/70 placeholder:text-white/20 resize-none leading-relaxed"
                variant="light" />
            )}
          </div>

          {/* Artwork */}
          <div className="lg:w-72 shrink-0 flex flex-col gap-2">
            <div className="relative aspect-square rounded-xl overflow-hidden bg-white/5 ring-1 ring-white/10 flex items-center justify-center">
              {data.portrait ? (
                <img src={data.portrait} alt="portrait" className="w-full h-full object-cover" style={{ filter: filterCss }} />
              ) : (
                <span className="text-xs text-white/20">No artwork</span>
              )}

              {!readOnly && (
                <div className="absolute bottom-2 right-2 flex gap-1">
                  <button type="button" onClick={() => setShowLighting(v => !v)}
                    className="size-8 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white/70 hover:text-white text-xs backdrop-blur-sm transition-colors"
                    title="Lighting adjustments">☀</button>
                  <button type="button" onClick={() => portraitRef.current?.click()}
                    className="size-8 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white/70 hover:text-white text-xs backdrop-blur-sm transition-colors"
                    title="Upload image">
                    {uploading ? "…" : "↑"}
                  </button>
                </div>
              )}

              {showLighting && !readOnly && (
                <div className="absolute inset-x-2 bottom-12 bg-black/80 backdrop-blur-sm rounded-lg p-3 flex flex-col gap-2">
                  {(["brightness", "contrast", "saturate"] as const).map(key => (
                    <label key={key} className="flex items-center gap-2 text-[10px] text-white/50">
                      <span className="w-16 uppercase tracking-wider shrink-0">{key}</span>
                      <input type="range" min={40} max={160} value={filter[key]}
                        onChange={e => update({ portraitFilter: { ...filter, [key]: parseInt(e.target.value) } })}
                        className="flex-1" />
                      <span className="w-8 text-right tabular-nums shrink-0">{filter[key]}%</span>
                    </label>
                  ))}
                  <button type="button" onClick={() => update({ portraitFilter: { brightness: 100, contrast: 100, saturate: 100 } })}
                    className="text-[10px] text-white/30 hover:text-white/60 self-end">Reset</button>
                </div>
              )}
            </div>
          </div>
        </div>

        <input ref={portraitRef} type="file" accept="image/*" className="hidden" onChange={uploadPortrait} />

        <MonsterStatBlock data={data} onUpdate={update} readOnly={readOnly} />
      </div>
    </div>
  )
}
