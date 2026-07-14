// ════════════════════════════════════════════════════════════════════════════
// monster.tsx — MonsterSheet root component + shared MonsterStatBlock
//
// MonsterStatBlock renders the stats/actions/spellcasting portion and is reused
// (via FamiliarMonsterView) by the character sheet's Familiars tab and its
// pop-out window, so editing a familiar's stat block there writes straight
// back to the shared Monster object — it's a live reference, not a copy.
//
// Stats/saves/skills/resistances and the section on/off toggles live behind an
// "Edit Stat Block" modal — the page itself only ever shows a clean read-out,
// so a freshly-created familiar doesn't show a "Legendary Actions" section (or
// any of the other rarely-used toggles) until someone deliberately turns it on.
// ════════════════════════════════════════════════════════════════════════════

import React, { useRef, useState } from "react"
import type { SidebarObject } from "@/components/sidebar-utils"
import type { userInfo } from "@/types/userInfo"
import { useUserContext } from "../../src/contexts/UserContext"

import type { MonsterData, MonsterAction, ActionCategory } from "./monster-types"
import type { SpellItem, SpellSlot } from "./character-types"
import type { Theme } from "./character-themes"
import { nanoid, safeParseJson } from "./character-utils"
import { slotLevelColor } from "./character-themes"
import { loadUserImages, uploadUserImage, type GalleryImage } from "./imageGallery"
import { spellItemFieldsFromSpell } from "./character-spell-utils"
import type { Spell } from "../../src/spells/types"

import { MarkdownTextarea } from "./ui/MarkdownTextarea"
import { Markdown } from "./ui/Markdown"
import { TracingSlider } from "./ui/tracing-slider"
import { NumInput } from "./character/ui/NumInput"
import { Modal } from "./character/ui/Modal"
import { PopTransition } from "./character/ui/PopTransition"
import { SpeedDisplay } from "./character/ui/SpeedDisplay"
import { PortraitModal } from "./character/modals/PortraitModal"
import { SpellPickerModal } from "./character/modals/SpellPickerModal"

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

const ACTION_SECTIONS: { key: "actions" | "bonusActions" | "reactions" | "legendaryActions" | "lairActions"; category: ActionCategory; label: string }[] = [
  { key: "actions", category: "action", label: "Actions" },
  { key: "bonusActions", category: "bonusAction", label: "Bonus Actions" },
  { key: "reactions", category: "reaction", label: "Reactions" },
  { key: "legendaryActions", category: "legendary", label: "Legendary Actions" },
  { key: "lairActions", category: "lair", label: "Lair Actions" },
]

const SECTION_HEADER_COLOR: Record<ActionCategory, string> = {
  trait: "text-emerald-300", action: "text-sky-300", bonusAction: "text-amber-300", reaction: "text-violet-300", legendary: "text-yellow-300", lair: "text-orange-300",
}

const CARD = "rounded-xl bg-zinc-900 ring-1 ring-zinc-700 transition-colors"

const NEUTRAL_THEME: Theme = {
  label: "Neutral",
  body: "bg-zinc-950", box: "bg-zinc-800", lightBody: "bg-zinc-800", lightBox: "bg-zinc-700",
  ring: "ring-zinc-700", header: "bg-zinc-950", color: "text-white", accent: "#F59E0B",
}

function abilityMod(score: number): string {
  const mod = Math.floor((score - 10) / 2)
  return mod >= 0 ? `+${mod}` : `${mod}`
}

// ── Small display/edit helpers (used inside the Edit Stat Block modal) ──────

function NumTile({ label, value, onChange }: { label: string; value?: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg bg-white/5 px-2.5 py-1.5 min-w-14 transition-colors focus-within:bg-white/10">
      <NumInput value={value ?? 0} onChange={e => onChange(parseInt(e.target.value) || 0)}
        className="w-10 text-center bg-transparent text-base font-bold text-white outline-none" />
      <span className="text-[9px] uppercase tracking-widest text-white/40 whitespace-nowrap">{label}</span>
    </div>
  )
}

function TextTile({ label, value, onChange, placeholder }: { label: string; value?: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg bg-white/5 px-2.5 py-1.5 min-w-16 max-w-28 transition-colors focus-within:bg-white/10">
      <input value={value ?? ""} placeholder={placeholder} onChange={e => onChange(e.target.value)}
        className="w-full text-center bg-transparent text-xs font-semibold text-white outline-none placeholder:text-white/20" />
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
          className="flex-1 min-w-0 bg-transparent outline-none text-white/70 border-b border-white/10 focus:border-white/30 py-0.5 transition-colors" />
      )}
    </div>
  )
}

function ActionSection({
  label, category, actions, readOnly, onAdd, onChange, onRemove, extra, beforeEntries,
}: {
  label: string; category: ActionCategory; actions: MonsterAction[]; readOnly?: boolean
  onAdd: () => void; onChange: (id: string, patch: Partial<MonsterAction>) => void; onRemove: (id: string) => void
  extra?: React.ReactNode
  beforeEntries?: React.ReactNode  // rendered above the entry list — e.g. the Multiattack block in Actions
}) {
  if (readOnly && actions.length === 0 && !beforeEntries) return null
  return (
    <div className={`${CARD} p-4 flex flex-col gap-2 animate-in fade-in duration-200`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className={`text-xs uppercase tracking-widest font-semibold ${SECTION_HEADER_COLOR[category]}`}>{label}</span>
        {extra}
        {!readOnly && (
          <button type="button" onClick={onAdd}
            className="text-xs px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors">
            + Add
          </button>
        )}
      </div>
      {beforeEntries}
      <div className="flex flex-col gap-1.5">
        {actions.length === 0 && !readOnly && <p className="text-xs text-white/20 italic">Nothing here yet.</p>}
        {actions.map(a => (
          <ActionEntry key={a.id} action={a} category={category} readOnly={readOnly}
            onChange={p => onChange(a.id, p)} onRemove={() => onRemove(a.id)} />
        ))}
      </div>
    </div>
  )
}

// Multiattack renders as one bolded lead-in sentence right above the action
// entries (like a real stat block: "**Multiattack.** The dragon makes..."),
// not a boxed sub-panel — both the on/off toggle AND the sentence itself are
// edited from the Edit Stat Block modal, so this is display-only.
function MultiattackBlock({ description, readOnly }: { description?: string; readOnly?: boolean }) {
  if (!description) {
    if (readOnly) return null
    return (
      <p className="text-sm text-white/30 italic">
        <span className="font-bold text-white/40 not-italic">Multiattack.</span> No description set — add one in Edit Stat Block.
      </p>
    )
  }
  return <Markdown text={`**Multiattack.** ${description}`} tone="dark" />
}

function LegendaryTracker({
  used, max, readOnly, onChangeUsed,
}: { used: number; max: number; readOnly?: boolean; onChangeUsed: (n: number) => void }) {
  const remaining = Math.max(0, max - used)
  return (
    <div className="flex items-center gap-2 flex-1 min-w-40">
      <TracingSlider value={remaining} max={max} disabled={readOnly} showButtons buttonSize="sm"
        color="#EAB308" onChange={val => onChangeUsed(Math.max(0, max - val))} className="flex-1 min-w-0" />
      <span className="text-xs text-white/40 tabular-nums shrink-0">{remaining}/{max} left</span>
    </div>
  )
}

// Most monsters cast innate spells "X/day" rather than off leveled slots —
// this is the per-spell version of that: an "At will" pill until a limit is
// set, then a remaining-uses slider identical in spirit to LegendaryTracker.
function PerDaySpellTracker({
  spell, readOnly, onChange,
}: { spell: SpellItem; readOnly?: boolean; onChange: (patch: Partial<SpellItem>) => void }) {
  const max = spell.usesPerDay ?? 0
  const isDaily = max > 0
  const used = spell.usesPerDayUsed ?? 0
  const remaining = Math.max(0, max - used)

  if (readOnly) {
    return isDaily ? (
      <span className="text-[10px] text-white/40 tabular-nums shrink-0">{remaining}/{max}/day</span>
    ) : (
      <span className="text-[10px] text-white/25 italic shrink-0">At will</span>
    )
  }

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <div className="flex items-center gap-0.5 rounded-full bg-white/10 p-0.5 shrink-0">
        <button type="button" onClick={() => onChange({ usesPerDay: undefined, usesPerDayUsed: undefined })}
          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${!isDaily ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70"}`}>
          At Will
        </button>
        <button type="button" onClick={() => { if (!isDaily) onChange({ usesPerDay: 1, usesPerDayUsed: 0 }) }}
          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${isDaily ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70"}`}>
          Daily
        </button>
      </div>
      {isDaily && (
        <>
          <TracingSlider value={remaining} max={max} disabled={readOnly} showButtons buttonSize="sm"
            onChange={val => onChange({ usesPerDayUsed: Math.max(0, max - val) })} className="w-24" />
          <span className="text-[10px] text-white/40 tabular-nums shrink-0">{remaining}/{max}/day</span>
          <NumInput value={max} min={1}
            onChange={e => onChange({ usesPerDay: Math.max(1, parseInt(e.target.value) || 1) })}
            className="w-8 bg-white/10 rounded px-1 py-0.5 text-center text-white text-[10px] outline-none" />
        </>
      )}
    </div>
  )
}

// ── Compact, always-visible stat-block summary ───────────────────────────────

const COMPACT_FIELD_ROWS: { key: keyof MonsterData; label: string }[] = [
  { key: "savingThrows",         label: "Saving Throws" },
  { key: "skills",               label: "Skills" },
  { key: "damageResistances",    label: "Dmg Resistances" },
  { key: "damageImmunities",     label: "Dmg Immunities" },
  { key: "damageVulnerabilities",label: "Dmg Vulnerabilities" },
  { key: "conditionImmunities",  label: "Condition Immunities" },
  { key: "senses",               label: "Senses" },
  { key: "languages",            label: "Languages" },
  { key: "challengeRating",      label: "Challenge" },
]

function StatsSummary({ data, onUpdate, readOnly, onEdit }: { data: MonsterData; onUpdate: (patch: Partial<MonsterData>) => void; readOnly?: boolean; onEdit: () => void }) {
  const hasStructuredSpeed = !!(data.speeds && Object.values(data.speeds).some(v => v))
  const [hpStep, setHpStep] = useState(1)

  function adjustHp(delta: number) {
    const max = data.maxHp
    const next = (data.hp ?? 0) + delta
    onUpdate({ hp: Math.max(0, max != null ? Math.min(max, next) : next) })
  }

  return (
    <div className={`${CARD} p-3 flex flex-col gap-2.5`}>
      <div className="flex items-start justify-between gap-2">
        {/* flex-wrap, not grid — a grid's columns stretch to fill the row's full width even
            when the container is way wider than the tiles need, which on a wide desktop page
            left each tile centered in a huge mostly-empty box. Flex just sizes tiles to their
            own content and wraps once it runs out of room. */}
        <div className="flex flex-wrap gap-1.5 min-w-0">
          <div className="flex flex-col items-center justify-center gap-0.5 rounded-lg bg-white/5 px-3 py-1.5 min-w-14">
            <span className="text-base font-bold text-white">{data.ac ?? 0}</span>
            <span className="text-[9px] uppercase tracking-widest text-white/40">AC</span>
          </div>
          <div className="flex flex-col items-center justify-center gap-1 rounded-lg bg-white/5 px-2.5 py-1.5 min-w-16">
            <div className="flex items-center gap-1.5">
              {!readOnly && (
                <button type="button" onClick={() => adjustHp(-hpStep)}
                  className="size-5 rounded-full bg-white/10 hover:bg-red-900 text-white hover:text-red-200 flex items-center justify-center text-xs font-bold transition-colors shrink-0">
                  −
                </button>
              )}
              <span className="text-base font-bold text-white tabular-nums">{data.hp ?? 0}<span className="text-xs text-white/30">/{data.maxHp ?? 0}</span></span>
              {!readOnly && (
                <button type="button" onClick={() => adjustHp(hpStep)}
                  className="size-5 rounded-full bg-white/10 hover:bg-green-900 text-white hover:text-green-200 flex items-center justify-center text-xs font-bold transition-colors shrink-0">
                  +
                </button>
              )}
            </div>
            {!readOnly && (
              <div className="flex items-center gap-1">
                
                <NumInput value={hpStep} min={1}
                  onFocus={e => e.target.select()}
                  onChange={e => setHpStep(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-7 text-center text-[10px] bg-white/10 rounded px-0.5 py-0.5 text-white outline-none" />
                   <span className="text-[9px] uppercase tracking-widest text-white/40">HP</span>
              </div>
              
            )}
           
          </div>
          {data.hitDice && (
            <div className="flex flex-col items-center justify-center gap-0.5 rounded-lg bg-white/5 px-3 py-1.5 min-w-16 animate-in fade-in duration-200">
              <span className="text-xs font-semibold text-white">{data.hitDice}</span>
              <span className="text-[9px] uppercase tracking-widest text-white/40">Hit Dice</span>
            </div>
          )}
          <div className="flex flex-col items-center justify-center gap-0.5 rounded-lg bg-white/5 px-3 py-1.5 min-w-16">
            {hasStructuredSpeed ? (
              <SpeedDisplay speeds={data.speeds!} size="lg" />
            ) : (
              <span className="text-xs font-semibold text-white">{data.speed || "—"}</span>
            )}
            <span className="text-[9px] uppercase tracking-widest text-white/40">Speed</span>
          </div>
          {(data.creatureType || data.alignment) && (
            <div className="flex flex-col items-center justify-center gap-0.5 rounded-lg bg-white/5 px-3 py-1.5 min-w-24 max-w-44 animate-in fade-in duration-200">
              {data.creatureType && <span className="text-[11px] font-semibold text-white/80 text-center leading-tight truncate max-w-full">{data.creatureType}</span>}
              {data.alignment && <span className="text-[9px] text-white/40 text-center leading-tight truncate max-w-full">{data.alignment}</span>}
            </div>
          )}
        </div>
        {!readOnly && (
          <button type="button" onClick={onEdit} title="Edit stat block"
            className="shrink-0 size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors">
            ✎
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {ABILITY_KEYS.map(key => {
          const score = (data[key] as number | undefined) ?? 10
          return (
            <div key={key} className="flex flex-col items-center gap-0.5 rounded-lg bg-white/5 px-3 py-1.5">
              <span className={`text-[9px] uppercase tracking-widest font-bold ${ABILITY_COLORS[key]}`}>{ABILITY_ABBR[key]}</span>
              <span className="text-sm font-bold text-white">{score}</span>
              <span className={`text-[10px] font-mono ${ABILITY_COLORS[key]}`}>{abilityMod(score)}</span>
            </div>
          )
        })}
      </div>

      {/* Each field is its own full-width line (not paired into columns) — pairing e.g. a
          short "Skills" with a long "Condition Immunities" into equal-width grid columns left
          a wall of blank space in whichever column had the shorter value. */}
      {COMPACT_FIELD_ROWS.some(r => data[r.key]) && (
        <div className="flex flex-col gap-1 border-t border-white/10 pt-2.5">
          {COMPACT_FIELD_ROWS.map(r => (
            <CompactField key={r.key} label={r.label} value={data[r.key] as string | undefined} onChange={() => {}} readOnly />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Edit Stat Block modal — everything configuration-shaped lives here ──────

const SPEED_FIELDS = ["walk", "fly", "swim", "climb", "burrow", "hover"] as const

function EditStatsModal({ data, onUpdate, onClose }: { data: MonsterData; onUpdate: (patch: Partial<MonsterData>) => void; onClose: () => void }) {
  const speeds = data.speeds ?? {}
  function setSpeed(key: typeof SPEED_FIELDS[number], v: number) {
    onUpdate({ speeds: { ...speeds, [key]: v || undefined } })
  }

  const traitsEnabled  = data.hasTraits ?? (data.traits ?? []).length > 0
  const multiEnabled   = data.hasMultiattack ?? !!data.multiattackDescription
  const bonusEnabled   = data.hasBonusActions ?? (data.bonusActions ?? []).length > 0
  const reactEnabled   = data.hasReactions ?? (data.reactions ?? []).length > 0
  const legendEnabled  = data.hasLegendaryActions ?? (data.legendaryActions ?? []).length > 0
  const lairEnabled    = data.hasLairActions ?? (data.lairActions ?? []).length > 0
  const spellEnabled   = data.hasSpellcasting ?? ((data.spellItems ?? []).length > 0 || !!data.spellcastingAbility)

  return (
    <Modal onClose={onClose}>
      <div className="bg-zinc-900 border border-white/15 rounded-2xl shadow-2xl w-[min(720px,calc(100vw-2rem))] max-h-[85vh] overflow-y-auto p-5 flex flex-col gap-5 text-white animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between shrink-0">
          <p className="text-sm font-bold">Edit Stat Block</p>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white text-sm transition-colors">✕</button>
        </div>

        {/* Identity */}
        <div className="flex gap-2">
          <input value={data.creatureType ?? ""} placeholder="Medium beast, unaligned"
            onChange={e => onUpdate({ creatureType: e.target.value })}
            className="flex-1 min-w-0 bg-white/5 rounded-lg px-2.5 py-1.5 text-xs text-white/80 outline-none placeholder:text-white/20 transition-colors focus:bg-white/10" />
          <input value={data.alignment ?? ""} placeholder="unaligned"
            onChange={e => onUpdate({ alignment: e.target.value })}
            className="w-32 shrink-0 bg-white/5 rounded-lg px-2.5 py-1.5 text-xs text-white/80 outline-none placeholder:text-white/20 transition-colors focus:bg-white/10" />
        </div>

        {/* Core stats */}
        <div className="flex flex-wrap gap-1.5">
          <NumTile label="AC" value={data.ac} onChange={v => onUpdate({ ac: v })} />
          <div className="flex flex-col items-center gap-0.5 rounded-lg bg-white/5 px-2.5 py-1.5 min-w-14 transition-colors focus-within:bg-white/10">
            <div className="flex items-baseline gap-1">
              <NumInput value={data.hp ?? 0} onChange={e => onUpdate({ hp: parseInt(e.target.value) || 0 })}
                className="w-9 text-center bg-transparent text-base font-bold text-white outline-none" />
              <span className="text-xs text-white/30">/</span>
              <NumInput value={data.maxHp ?? 0} onChange={e => onUpdate({ maxHp: parseInt(e.target.value) || 0 })}
                className="w-9 text-center bg-transparent text-xs text-white/50 outline-none" />
            </div>
            <span className="text-[9px] uppercase tracking-widest text-white/40">HP</span>
          </div>
          <TextTile label="Hit Dice" value={data.hitDice} onChange={v => onUpdate({ hitDice: v })} placeholder="9d8+18" />
        </div>

        {/* Speeds */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Speed (ft/round)</span>
          <div className="flex flex-wrap gap-1.5">
            {SPEED_FIELDS.map(k => (
              <label key={k} className="flex flex-col items-center gap-1">
                <span className="text-[9px] uppercase text-white/40">{k}</span>
                <NumInput value={speeds[k] ?? ""} min={0} placeholder="—"
                  onChange={e => setSpeed(k, parseInt(e.target.value) || 0)}
                  className="w-14 bg-white/10 rounded px-1.5 py-1 text-center text-white outline-none text-sm transition-colors focus:bg-white/15" />
              </label>
            ))}
          </div>
          <input value={data.speed ?? ""} placeholder="Other movement notes (e.g. can't be knocked prone)"
            onChange={e => onUpdate({ speed: e.target.value })}
            className="bg-white/5 rounded-lg px-2.5 py-1.5 text-xs text-white/70 outline-none placeholder:text-white/20 transition-colors focus:bg-white/10" />
        </div>

        {/* Ability scores */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Ability Scores</span>
          <div className="flex flex-wrap gap-1.5">
            {ABILITY_KEYS.map(key => {
              const score = (data[key] as number | undefined) ?? 10
              return (
                <div key={key} className="flex flex-col items-center gap-0.5 rounded-lg bg-white/5 px-1.5 py-1.5 transition-colors focus-within:bg-white/10">
                  <span className={`text-[9px] uppercase tracking-widest font-bold ${ABILITY_COLORS[key]}`}>{ABILITY_ABBR[key]}</span>
                  <NumInput value={score} onChange={e => onUpdate({ [key]: parseInt(e.target.value) || 0 } as Partial<MonsterData>)}
                    className="w-8 text-center bg-transparent text-sm font-bold text-white outline-none" />
                  <span className={`text-[10px] font-mono ${ABILITY_COLORS[key]}`}>{abilityMod(score)}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Saves/skills/resistances/senses — not to be confused with the Traits *section* (passive feature entries), toggled below.
            One full-width line per field rather than paired columns — pairing e.g. a short
            "Skills" with a long "Condition Immunities" left a wall of blank space in whichever
            column had the shorter value. This is also exactly where the modal's extra width goes:
            each field gets a nearly-full-width single-line input to type a long value into. */}
        <div className="flex flex-col gap-1.5 border-t border-white/10 pt-3">
          <CompactField label="Saving Throws"        value={data.savingThrows}         onChange={v => onUpdate({ savingThrows: v })} />
          <CompactField label="Skills"               value={data.skills}               onChange={v => onUpdate({ skills: v })} />
          <CompactField label="Dmg Resistances"      value={data.damageResistances}     onChange={v => onUpdate({ damageResistances: v })} />
          <CompactField label="Dmg Immunities"       value={data.damageImmunities}      onChange={v => onUpdate({ damageImmunities: v })} />
          <CompactField label="Dmg Vulnerabilities"  value={data.damageVulnerabilities} onChange={v => onUpdate({ damageVulnerabilities: v })} />
          <CompactField label="Condition Immunities" value={data.conditionImmunities}   onChange={v => onUpdate({ conditionImmunities: v })} />
          <CompactField label="Senses"                value={data.senses}               onChange={v => onUpdate({ senses: v })} />
          <CompactField label="Languages"              value={data.languages}            onChange={v => onUpdate({ languages: v })} />
          <CompactField label="Challenge"              value={data.challengeRating}      onChange={v => onUpdate({ challengeRating: v })} />
          <CompactField label="Prof. Bonus"            value={data.proficiencyBonus != null ? String(data.proficiencyBonus) : ""}
            onChange={v => onUpdate({ proficiencyBonus: v ? parseInt(v) || 0 : undefined })} />
        </div>

        {/* Section toggles */}
        <div className="flex flex-col gap-2.5 border-t border-white/10 pt-3">
          <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Sections</span>
          <label className="flex items-center justify-between text-sm text-white/70 cursor-pointer select-none">
            Traits
            <input type="checkbox" checked={traitsEnabled} onChange={e => onUpdate({ hasTraits: e.target.checked })} />
          </label>
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center justify-between text-sm text-white/70 cursor-pointer select-none">
              Multiattack
              <input type="checkbox" checked={multiEnabled} onChange={e => onUpdate({ hasMultiattack: e.target.checked })} />
            </label>
            <PopTransition show={multiEnabled}>
              <MarkdownTextarea value={data.multiattackDescription ?? ""} onChange={v => onUpdate({ multiattackDescription: v })}
                placeholder="The monster makes two attacks: one with its bite and one with its claws."
                rows={2}
                className="bg-white/10 rounded-lg px-2.5 py-2 text-xs text-white/70 outline-none placeholder:text-white/20 resize-none leading-relaxed transition-colors focus:bg-white/15 w-full"
                variant="light" />
            </PopTransition>
          </div>
          <label className="flex items-center justify-between text-sm text-white/70 cursor-pointer select-none">
            Bonus Actions
            <input type="checkbox" checked={bonusEnabled} onChange={e => onUpdate({ hasBonusActions: e.target.checked })} />
          </label>
          <label className="flex items-center justify-between text-sm text-white/70 cursor-pointer select-none">
            Reactions
            <input type="checkbox" checked={reactEnabled} onChange={e => onUpdate({ hasReactions: e.target.checked })} />
          </label>
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center justify-between text-sm text-white/70 cursor-pointer select-none">
              Legendary Actions
              <input type="checkbox" checked={legendEnabled} onChange={e => onUpdate({ hasLegendaryActions: e.target.checked })} />
            </label>
            <PopTransition show={legendEnabled}>
              <label className="flex items-center justify-between text-xs text-white/40 pl-3">
                Max per round
                <NumInput value={data.legendaryActionsMax ?? 3} min={0}
                  onChange={e => onUpdate({ legendaryActionsMax: parseInt(e.target.value) || 0 })}
                  className="w-14 bg-white/10 rounded px-1.5 py-1 text-center text-white outline-none transition-colors focus:bg-white/15" />
              </label>
            </PopTransition>
          </div>
          <label className="flex items-center justify-between text-sm text-white/70 cursor-pointer select-none">
            Lair Actions
            <input type="checkbox" checked={lairEnabled} onChange={e => onUpdate({ hasLairActions: e.target.checked })} />
          </label>
          <label className="flex items-center justify-between text-sm text-white/70 cursor-pointer select-none">
            Spellcasting
            <input type="checkbox" checked={spellEnabled} onChange={e => onUpdate({ hasSpellcasting: e.target.checked })} />
          </label>
        </div>

        <button type="button" onClick={onClose}
          className="shrink-0 text-sm font-semibold px-4 py-2 rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors self-end">
          Done
        </button>
      </div>
    </Modal>
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
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAddSlotMenu, setShowAddSlotMenu] = useState(false)
  const [newSlotLevel, setNewSlotLevel] = useState(1)
  const [newSlotCount, setNewSlotCount] = useState(1)

  const actionsBySection = {
    actions: data.actions ?? [],
    bonusActions: data.bonusActions ?? [],
    reactions: data.reactions ?? [],
    legendaryActions: data.legendaryActions ?? [],
    lairActions: data.lairActions ?? [],
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

  const traits = data.traits ?? []
  function addTrait()                                     { onUpdate({ traits: [...traits, { id: nanoid(), name: "" }] }) }
  function changeTrait(id: string, patch: Partial<MonsterAction>) { onUpdate({ traits: traits.map(t => t.id === id ? { ...t, ...patch } : t) }) }
  function removeTrait(id: string)                        { onUpdate({ traits: traits.filter(t => t.id !== id) }) }

  const spellItems = data.spellItems ?? []
  const spellSlots = data.spellSlots ?? []
  const [pendingSpellId, setPendingSpellId] = useState<string | null>(null)
  const [showSpellPicker, setShowSpellPicker] = useState(false)

  // Blank entry the user fills in by hand — the fallback for homebrew/monster
  // abilities that aren't a real SRD spell. The picker menu is the main path.
  function addCustomSpell() {
    const id = nanoid()
    onUpdate({ spellItems: [...spellItems, { id, name: "", level: 0 }] })
    setPendingSpellId(id)
  }
  function addSpellFromPicker(s: Spell) {
    onUpdate({ spellItems: [...spellItems, { id: nanoid(), ...spellItemFieldsFromSpell(s) }] })
    setShowSpellPicker(false)
  }
  function addSpellsFromPicker(spells: Spell[]) {
    onUpdate({ spellItems: [...spellItems, ...spells.map(s => ({ id: nanoid(), ...spellItemFieldsFromSpell(s) }))] })
    setShowSpellPicker(false)
  }
  function changeSpell(id: string, patch: Partial<SpellItem>) { onUpdate({ spellItems: spellItems.map(s => s.id === id ? { ...s, ...patch } : s) }) }
  function removeSpell(id: string)                          { onUpdate({ spellItems: spellItems.filter(s => s.id !== id) }) }

  const usedSlotLevels = new Set(spellSlots.map(s => s.level))
  const openSlotLevels = Array.from({ length: 9 }, (_, i) => i + 1).filter(lvl => !usedSlotLevels.has(lvl))

  function openAddSlotMenu() {
    setNewSlotLevel(openSlotLevels[0] ?? 1)
    setNewSlotCount(1)
    setShowAddSlotMenu(true)
  }
  function confirmAddSlot() {
    onUpdate({ spellSlots: [...spellSlots, { id: nanoid(), level: newSlotLevel, total: Math.max(1, newSlotCount), used: 0, resetsOn: "long" }] })
    setShowAddSlotMenu(false)
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

  // Explicit toggles, editable only from the Edit Stat Block modal — fall back
  // to auto-detecting existing data for monsters created before the toggle
  // existed, so nothing that already had content quietly disappears.
  const traitsEnabled      = data.hasTraits ?? traits.length > 0
  const multiattackEnabled = data.hasMultiattack ?? !!data.multiattackDescription
  const bonusEnabled       = data.hasBonusActions ?? (data.bonusActions ?? []).length > 0
  const reactEnabled       = data.hasReactions ?? (data.reactions ?? []).length > 0
  const legendaryEnabled   = data.hasLegendaryActions ?? (data.legendaryActions ?? []).length > 0
  const lairEnabled        = data.hasLairActions ?? (data.lairActions ?? []).length > 0
  const spellcastingEnabled = data.hasSpellcasting ?? (levels.length > 0 || !!data.spellcastingAbility)
  const spellUsageMode      = data.spellUsageMode ?? "slots"

  const sectionEnabled: Record<string, boolean> = {
    actions: true,
    bonusActions: bonusEnabled,
    reactions: reactEnabled,
    legendaryActions: legendaryEnabled,
    lairActions: lairEnabled,
  }

  function feelingLucky() {
    if (spellItems.length === 0) return
    setLuckySpell(spellItems[Math.floor(Math.random() * spellItems.length)])
  }

  return (
    <div className="flex flex-col gap-4">

      {/* ── Stats (read-only summary — edit via the modal) ──────────────────── */}
      <StatsSummary data={data} onUpdate={onUpdate} readOnly={readOnly} onEdit={() => setShowEditModal(true)} />

      {/* ── Traits — right before Actions, same shape but passive (no attack/damage/save) ── */}
      {traitsEnabled && (
        <ActionSection label="Traits" category="trait" actions={traits} readOnly={readOnly}
          onAdd={addTrait}
          onChange={changeTrait}
          onRemove={removeTrait}
        />
      )}

      {/* ── Action sections ──────────────────────────────────────────────── */}
      {ACTION_SECTIONS.filter(({ key }) => sectionEnabled[key]).map(({ key, category, label }) => (
        <ActionSection key={key} label={label} category={category}
          actions={actionsBySection[key]} readOnly={readOnly}
          onAdd={() => addAction(key)}
          onChange={(id, patch) => changeAction(key, id, patch)}
          onRemove={id => removeAction(key, id)}
          beforeEntries={key === "actions" && multiattackEnabled ? (
            <MultiattackBlock description={data.multiattackDescription} readOnly={readOnly} />
          ) : undefined}
          extra={key === "legendaryActions" ? (
            <LegendaryTracker
              used={data.legendaryActionsUsed ?? 0}
              max={data.legendaryActionsMax ?? 3}
              readOnly={readOnly}
              onChangeUsed={n => onUpdate({ legendaryActionsUsed: n })}
            />
          ) : undefined}
        />
      ))}

      {/* ── Spellcasting ─────────────────────────────────────────────────── */}
      {spellcastingEnabled && (
        <div className={`${CARD} p-4 flex flex-col gap-3 animate-in fade-in duration-200`}>
          <span className="text-xs uppercase tracking-widest text-white/50 font-semibold">Spellcasting</span>

          <div className="flex flex-wrap items-center gap-2">
            {readOnly ? (
              <>
                {data.spellcastingLevel && <span className="text-xs text-white/60">{data.spellcastingLevel}</span>}
                {data.spellcastingAbility && <span className="text-xs text-white/50">{data.spellcastingAbility}</span>}
                {data.spellAttackBonus != null && <span className="text-xs text-white/50">Atk +{data.spellAttackBonus}</span>}
                {data.spellSaveDC != null && <span className="text-xs text-white/50">DC {data.spellSaveDC}</span>}
              </>
            ) : (
              <>
                <TextTile label="Caster Level" value={data.spellcastingLevel} onChange={v => onUpdate({ spellcastingLevel: v })} placeholder="9th" />
                <NumTile label="Spell Atk" value={data.spellAttackBonus} onChange={v => onUpdate({ spellAttackBonus: v })} />
                <NumTile label="Spell Save DC" value={data.spellSaveDC} onChange={v => onUpdate({ spellSaveDC: v })} />
                <TextTile label="Ability" value={data.spellcastingAbility} onChange={v => onUpdate({ spellcastingAbility: v })} placeholder="INT" />
              </>
            )}
            {!readOnly && (
              <div className="flex items-center gap-1 rounded-full bg-white/10 p-0.5 shrink-0" title="Most monsters cast innate spells X/day rather than off leveled slots">
                <button type="button" onClick={() => onUpdate({ spellUsageMode: "slots" })}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors ${spellUsageMode !== "perDay" ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70"}`}>
                  Slots
                </button>
                <button type="button" onClick={() => onUpdate({ spellUsageMode: "perDay" })}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors ${spellUsageMode === "perDay" ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70"}`}>
                  Per Day
                </button>
              </div>
            )}
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

          {/* Rendered as ONE flat list of siblings (not nested per-level containers) so that
              changing a spell's level — which moves it between groups — reorders it within the
              same parent instead of unmounting/remounting it (which would lose the spell's own
              open edit/detail modal state). */}
          <div className="flex flex-col gap-1.5">
            {levels.flatMap(lvl => {
              const nodes: React.ReactNode[] = [
                <div key={`header-${lvl}`} className="flex items-center gap-3 flex-wrap px-1">
                  <span className="text-sm font-bold uppercase tracking-widest text-white/75">{lvl === 0 ? "Cantrips" : `Level ${lvl}`}</span>
                  {spellUsageMode !== "perDay" && spellSlots.filter(s => s.level === lvl).map(slot => {
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
                              className="text-white/20 hover:text-red-400 text-xs px-1 transition-colors" title="Remove slot row">✕</button>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              ]
              for (const spell of grouped.get(lvl)!) {
                nodes.push(
                  <div key={spell.id} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <SpellEntry spell={spell} theme={NEUTRAL_THEME} readOnly={readOnly} showPrepToggle={false}
                        autoEdit={spell.id === pendingSpellId} onAutoEditConsumed={() => setPendingSpellId(null)}
                        onChange={p => changeSpell(spell.id, p)} onRemove={() => removeSpell(spell.id)} />
                    </div>
                    {spellUsageMode === "perDay" && (
                      <PerDaySpellTracker spell={spell} readOnly={readOnly} onChange={p => changeSpell(spell.id, p)} />
                    )}
                  </div>
                )
              }
              return nodes
            })}
          </div>

          {!readOnly && (
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={() => setShowSpellPicker(true)}
                className="text-sm text-white/40 hover:text-white border border-dashed border-white/15 hover:border-white/30 rounded-xl py-2 px-3 transition-colors">
                + Add Spell
              </button>
              {spellUsageMode !== "perDay" && !showAddSlotMenu && (
                <button type="button" onClick={openAddSlotMenu} disabled={openSlotLevels.length === 0}
                  className="text-sm text-white/40 hover:text-white border border-dashed border-white/15 hover:border-white/30 rounded-xl py-2 px-3 transition-colors disabled:opacity-30 disabled:cursor-default disabled:hover:text-white/40 disabled:hover:border-white/15">
                  + Add Slot Level
                </button>
              )}
              {spellUsageMode !== "perDay" && showAddSlotMenu && (
                <div className="flex items-center gap-2 flex-wrap border border-white/15 rounded-xl py-2 px-3">
                  <span className="text-xs text-white/40">Level</span>
                  <div className="flex items-center gap-1 flex-wrap">
                    {openSlotLevels.map(lvl => (
                      <button key={lvl} type="button" onClick={() => setNewSlotLevel(lvl)}
                        className={`size-6 rounded-full text-[11px] font-semibold transition-colors ${newSlotLevel === lvl ? "bg-white/25 text-white" : "bg-white/10 text-white/40 hover:text-white/70"}`}>
                        {lvl}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-white/40">Slots</span>
                  <NumInput value={newSlotCount} min={1}
                    onChange={e => setNewSlotCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-12 bg-white/10 rounded px-1 py-1 text-center text-white text-xs outline-none" />
                  <button type="button" onClick={confirmAddSlot}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-500/25 hover:bg-emerald-500/35 text-emerald-200 transition-colors">
                    Add
                  </button>
                  <button type="button" onClick={() => setShowAddSlotMenu(false)}
                    className="text-xs text-white/40 hover:text-white/70 px-2 transition-colors">
                    Cancel
                  </button>
                </div>
              )}
            </div>
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

      {showEditModal && !readOnly && (
        <EditStatsModal data={data} onUpdate={onUpdate} onClose={() => setShowEditModal(false)} />
      )}

      {showSpellPicker && !readOnly && (
        <SpellPickerModal
          onClose={() => setShowSpellPicker(false)}
          onPick={addSpellFromPicker}
          onImportAll={addSpellsFromPicker}
          onCustom={() => { setShowSpellPicker(false); addCustomSpell() }}
        />
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
  const [showPortraitPicker, setShowPortraitPicker] = useState(false)
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([])
  const [galleryLoading, setGalleryLoading] = useState(false)

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

  async function openPortraitPicker() {
    setShowPortraitPicker(true)
    if (!user?.id) return
    setGalleryLoading(true)
    setGalleryImages(await loadUserImages(user.id))
    setGalleryLoading(false)
  }

  async function uploadPortrait(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return
    setUploading(true)
    const url = await uploadUserImage(user.id, file, `monster_${monster.id}`)
    if (url) update({ portrait: url })
    setUploading(false)
    setShowPortraitPicker(false)
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
        {saving && <span className="text-xs text-white/40 shrink-0 animate-pulse">saving…</span>}
        <button type="button" onClick={onClose}
          className="size-7 flex items-center justify-center rounded-md hover:bg-white/10 text-white/50 hover:text-white transition-colors shrink-0">
          ✕
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-auto p-4 flex flex-col gap-4">

        {/* Description + artwork — creature type/alignment now live in the stat block summary/modal */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            {readOnly ? (
              data.description
                ? <Markdown text={data.description} tone="dark" />
                : <p className="text-sm text-white/20 italic">No description.</p>
            ) : (
              <MarkdownTextarea value={data.description ?? ""} onChange={v => update({ description: v })}
                placeholder="Description…" rows={6}
                className="bg-white/5 rounded-lg px-3 py-2 outline-none text-sm text-white/70 placeholder:text-white/20 resize-none leading-relaxed transition-colors focus:bg-white/10"
                variant="light" />
            )}
          </div>

          {/* Artwork */}
          <div className="lg:w-72 shrink-0 flex flex-col gap-2">
            <div className="relative aspect-square rounded-xl overflow-hidden bg-white/5 ring-1 ring-white/10 flex items-center justify-center">
              {data.portrait ? (
                <img src={data.portrait} alt="portrait" className="w-full h-full object-cover transition-[filter] duration-200" style={{ filter: filterCss }} />
              ) : (
                <span className="text-xs text-white/20">No artwork</span>
              )}

              {!readOnly && (
                <div className="absolute bottom-2 right-2 flex gap-1">
                  <button type="button" onClick={() => setShowLighting(v => !v)}
                    className="size-8 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white/70 hover:text-white text-xs backdrop-blur-sm transition-colors"
                    title="Lighting adjustments">☀</button>
                  <button type="button" onClick={openPortraitPicker}
                    className="size-8 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white/70 hover:text-white text-xs backdrop-blur-sm transition-colors"
                    title="Choose image">
                    {uploading ? "…" : "↑"}
                  </button>
                </div>
              )}

              {showLighting && !readOnly && (
                <div className="absolute inset-x-2 bottom-12 bg-black/80 backdrop-blur-sm rounded-lg p-3 flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-1 duration-150">
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
                    className="text-[10px] text-white/30 hover:text-white/60 self-end transition-colors">Reset</button>
                </div>
              )}
            </div>
          </div>
        </div>

        <input ref={portraitRef} type="file" accept="image/*" className="hidden" onChange={uploadPortrait} />

        {showPortraitPicker && (
          <PortraitModal
            currentPortrait={data.portrait}
            galleryImages={galleryImages}
            galleryLoading={galleryLoading}
            onChoose={url => { update({ portrait: url }); setShowPortraitPicker(false) }}
            onUploadClick={() => portraitRef.current?.click()}
            onClose={() => setShowPortraitPicker(false)}
          />
        )}

        <MonsterStatBlock data={data} onUpdate={update} readOnly={readOnly} />
      </div>
    </div>
  )
}
