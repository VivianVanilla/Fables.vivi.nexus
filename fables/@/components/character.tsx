// ════════════════════════════════════════════════════════════════════════════
// character.tsx — CharacterSheet root component
//
// Layout
//   Header (portrait, name/race/class/level, theme picker, close)
//   Tab bar  Combat | Info
//   Body
//     Combat tab
//       Left column  HP ring · speed/init · hit dice · quick search
//       Right area   Saves+Abilities+Conditions card
//                    Spells⇄Equipment panel  |  Favorites panel
//     Info tab  (see character/tabs/InfoTab.tsx)
//
// Sub-components live in character/entries/ and character/tabs/
// ════════════════════════════════════════════════════════════════════════════

// ── IMPORTS ───────────────────────────────────────────────────────────────────

import React, { useState, useRef } from "react"
import { Shield } from "lucide-react"

import type { SidebarObject } from "@/components/sidebar-utils"
import { useUserContext } from "../../src/contexts/UserContext"
import { supabase } from "../../src/supabase"

import type {
  CharacterData, HitDicePool, SpellItem, EquipmentItem,
  SpellSlot, FavoriteRef, ActiveCondition,
} from "./character-types"
import { ABILITY_KEYS, ABILITY_ABBR, SAVE_KEYS, SAVE_TO_ABILITY, SUPABASE_BUCKET } from "./character-constants"
import { abilityMod, profBonus, nanoid, safeParseJson } from "./character-utils"
import { THEMES, DEFAULT_THEME } from "./character-themes"

import { SpellEntry }     from "./character/entries/SpellEntry"
import { EquipmentEntry } from "./character/entries/EquipmentEntry"
import { InfoTab }        from "./character/tabs/InfoTab"

// ── CONDITION DATA ────────────────────────────────────────────────────────────

const ALL_CONDITIONS = [
  "Blinded", "Charmed", "Concentrating", "Deafened", "Exhaustion",
  "Frightened", "Grappled", "Incapacitated", "Invisible", "Paralyzed",
  "Petrified", "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious",
]

const CONDITION_COLOR: Record<string, string> = {
  Concentrating: "bg-blue-500/25 text-blue-200 border-blue-500/40",
  Exhaustion:    "bg-orange-500/25 text-orange-200 border-orange-500/40",
  Poisoned:      "bg-green-700/25 text-green-200 border-green-700/40",
  Charmed:       "bg-pink-500/25 text-pink-200 border-pink-500/40",
  Frightened:    "bg-pink-700/25 text-pink-200 border-pink-700/40",
  Stunned:       "bg-red-500/25 text-red-200 border-red-500/40",
  Paralyzed:     "bg-red-700/25 text-red-200 border-red-700/40",
  Unconscious:   "bg-zinc-700/40 text-zinc-300 border-zinc-600/60",
}

// ── TYPES ─────────────────────────────────────────────────────────────────────

interface Props {
  character: SidebarObject
  onClose: () => void
  readOnly?: boolean
}

type Tab = "combat" | "info"

// ════════════════════════════════════════════════════════════════════════════
// CharacterSheet
// ════════════════════════════════════════════════════════════════════════════

export function CharacterSheet({ character, onClose, readOnly = false }: Props) {
  const { user, updateObject } = useUserContext()

  // ── STATE ─────────────────────────────────────────────────────────────────

  // UI toggles
  const [saving,             setSaving]             = useState(false)
  const [uploading,          setUploading]           = useState(false)
  const [activeTab,          setActiveTab]           = useState<Tab>("combat")
  const [showSpells,         setShowSpells]          = useState(true)
  const [showMaxMenu,        setShowMaxMenu]         = useState(false)
  const [showThemePicker,    setShowThemePicker]     = useState(false)
  const [showConditionPicker,setShowConditionPicker] = useState(false)
  const [showPortraitPicker, setShowPortraitPicker]  = useState(false)
  const [galleryImages,      setGalleryImages]       = useState<{ name: string; publicUrl: string }[]>([])
  const [galleryLoading,     setGalleryLoading]      = useState(false)

  // HP controls
  const [hpStep,   setHpStep]   = useState(1)
  const [hpTarget, setHpTarget] = useState<"hp" | "temp">("hp")

  // Hit dice edit state
  const [editingPools, setEditingPools] = useState(false)
  const [showAddPool,  setShowAddPool]  = useState(false)
  const [newPoolDie,   setNewPoolDie]   = useState("d8")
  const [newPoolCount, setNewPoolCount] = useState(1)

  // Spell slot add form
  const [showAddSlot,  setShowAddSlot]  = useState(false)
  const [newSlotLevel, setNewSlotLevel] = useState(1)
  const [newSlotTotal, setNewSlotTotal] = useState(2)
  const [newSlotRests, setNewSlotRests] = useState<"short" | "long">("long")

  // Favorites drag-and-drop
  const [favDragOver, setFavDragOver] = useState(false)

  // Quick search
  const [quickSearch, setQuickSearch] = useState("")

  // Ability score local buffer (allows clearing "0")
  const [abilityInputs, setAbilityInputs] = useState<Record<string, string>>({})

  // Refs
  const portraitRef = useRef<HTMLInputElement>(null)
  const saveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Character data
  const [data, setData] = useState<CharacterData>(() => safeParseJson(character.data) as CharacterData)

  // ── SAVE ──────────────────────────────────────────────────────────────────

  function scheduleSave(next: CharacterData) {
    if (readOnly) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      try { await updateObject(character.id, { data: next as unknown as JSON }) }
      catch (e) { console.error(e) }
      setSaving(false)
    }, 700)
  }

  function update(patch: Partial<CharacterData>) {
    if (readOnly) return
    const next = { ...data, ...patch }
    setData(next)
    scheduleSave(next)
  }

  // ── PORTRAIT ──────────────────────────────────────────────────────────────

  async function openPortraitPicker() {
    setShowPortraitPicker(true)
    if (!user?.id) return
    setGalleryLoading(true)
    const { data: files } = await supabase.storage.from(SUPABASE_BUCKET).list(`${user.id}`, { limit: 100 })
    if (files) {
      setGalleryImages(
        files
          .filter(f => f.name !== ".emptyFolderPlaceholder")
          .map(f => ({
            name: f.name,
            publicUrl: supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(`${user.id}/${f.name}`).data.publicUrl,
          }))
      )
    }
    setGalleryLoading(false)
  }

  async function uploadPortrait(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return
    setUploading(true)
    const ext  = file.name.split(".").pop() ?? "png"
    const path = `${user.id}/portrait_${character.id}.${ext}`
    const { error } = await supabase.storage.from(SUPABASE_BUCKET).upload(path, file, { upsert: true })
    if (!error) {
      const { data: urlData } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(path)
      update({ portrait: urlData.publicUrl })
    }
    setUploading(false)
    setShowPortraitPicker(false)
    e.target.value = ""
  }

  // ── HP COMPUTED ───────────────────────────────────────────────────────────

  const hp         = data.hp    ?? 0
  const maxHp      = data.maxHp ?? 0
  const tempHp     = data.tempHp ?? 0
  const hpPercent  = maxHp > 0 ? Math.min(100, (hp / maxHp) * 100) : 0
  const tempHpPct  = maxHp > 0 ? Math.min(100, (tempHp / maxHp) * 100) : 0
  const hpColor    = hpPercent > 50 ? "#22c55e" : hpPercent > 25 ? "#eab308" : "#ef4444"
  const RING_R     = 32
  const TEMP_R     = 43
  const ringC      = 2 * Math.PI * RING_R
  const tempC      = 2 * Math.PI * TEMP_R

  // ── SPELL / EQUIPMENT HELPERS ─────────────────────────────────────────────

  const spellItems = data.spellItems   ?? []
  const equipItems = data.equipmentItems ?? []
  const spellSlots = data.spellSlots   ?? []
  const favorites  = data.favorites    ?? []
  const conditions = data.conditions   ?? []

  function addSpell()                                { update({ spellItems: [...spellItems, { id: nanoid(), name: "", level: 0 }] }) }
  function changeSpell(id: string, p: Partial<SpellItem>)   { update({ spellItems: spellItems.map(s => s.id === id ? { ...s, ...p } : s) }) }
  function removeSpell(id: string)                   { update({ spellItems: spellItems.filter(s => s.id !== id) }) }

  function addEquip()                                { update({ equipmentItems: [...equipItems, { id: nanoid(), name: "", type: "melee" }] }) }
  function changeEquip(id: string, p: Partial<EquipmentItem>) { update({ equipmentItems: equipItems.map(i => i.id === id ? { ...i, ...p } : i) }) }
  function removeEquip(id: string)                   { update({ equipmentItems: equipItems.filter(i => i.id !== id) }) }

  // ── SPELL SLOT HELPERS ────────────────────────────────────────────────────

  function changeSlot(level: number, p: Partial<SpellSlot>) {
    update({ spellSlots: spellSlots.map(s => s.level === level ? { ...s, ...p } : s) })
  }
  function addSlot() {
    if (spellSlots.find(s => s.level === newSlotLevel)) return
    update({
      spellSlots: [
        ...spellSlots,
        { level: newSlotLevel, total: newSlotTotal, used: 0, resetsOn: newSlotRests },
      ].sort((a, b) => a.level - b.level),
    })
    setShowAddSlot(false); setNewSlotLevel(1); setNewSlotTotal(2)
  }
  function removeSlot(level: number) {
    update({ spellSlots: spellSlots.filter(s => s.level !== level) })
  }

  // ── FAVORITES HELPERS ─────────────────────────────────────────────────────

  function addFavorite(ref: FavoriteRef) {
    if (favorites.find(f => f.refId === ref.refId)) return
    update({ favorites: [...favorites, ref] })
  }
  function removeFavorite(refId: string) {
    update({ favorites: favorites.filter(f => f.refId !== refId) })
  }

  // ── CONDITION HELPERS ─────────────────────────────────────────────────────

  function addCondition(name: string) {
    if (conditions.find(c => c.name === name)) return
    update({ conditions: [...conditions, { id: nanoid(), name }] })
    setShowConditionPicker(false)
  }
  function removeCondition(id: string) {
    update({ conditions: conditions.filter(c => c.id !== id) })
  }
  function updateCondition(id: string, p: Partial<ActiveCondition>) {
    update({ conditions: conditions.map(c => c.id === id ? { ...c, ...p } : c) })
  }

  // ── QUICK SEARCH ──────────────────────────────────────────────────────────

  const q = quickSearch.toLowerCase().trim()
  const searchResults: { id: string; label: string; category: string; refType: FavoriteRef["refType"] }[] = q ? [
    ...spellItems.filter(s => s.name.toLowerCase().includes(q)).map(s => ({ id: s.id, label: s.name, category: "Spell",   refType: "spell"     as const })),
    ...equipItems.filter(i => i.name.toLowerCase().includes(q)).map(i => ({ id: i.id, label: i.name, category: "Item",    refType: "equipment" as const })),
    ...(data.racialTraits   ?? []).filter(f => f.name.toLowerCase().includes(q)).map(f => ({ id: f.id, label: f.name, category: "Trait",   refType: "feature"   as const })),
    ...(data.feats          ?? []).filter(f => f.name.toLowerCase().includes(q)).map(f => ({ id: f.id, label: f.name, category: "Feat",    refType: "feature"   as const })),
    ...(data.classFeatures  ?? []).filter(f => f.name.toLowerCase().includes(q)).map(f => ({ id: f.id, label: f.name, category: "Feature", refType: "feature"   as const })),
  ] : []

  // ── COMPUTED THEME / CARD ─────────────────────────────────────────────────

  const theme = THEMES[data.theme ?? DEFAULT_THEME] ?? THEMES[DEFAULT_THEME]
  const card  = `rounded-xl ${theme.box} ring-1 ${theme.ring}`

  // ── SAVING THROW MODIFIER ─────────────────────────────────────────────────

  function getSaveMod(save: typeof SAVE_KEYS[number]): number {
    const score   = (data[SAVE_TO_ABILITY[save] as keyof CharacterData] as number | undefined) ?? 10
    const base    = Math.floor((score - 10) / 2)
    const proficient = data.savingThrowProfs?.[save] ?? false
    return base + (proficient ? profBonus(data.level ?? 1) : 0)
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: HP PANEL
  // ══════════════════════════════════════════════════════════════════════════

  function renderHpPanel() {
    return (
      <div className="flex flex-col gap-3">

        {/* HP ring card */}
        <div className={`${card} p-3 flex flex-col items-center gap-2`}>

          {/* Edit max stats button */}
          <div className="relative w-full flex justify-end">
            <button
              type="button"
              onClick={() => { setShowMaxMenu(v => !v); setShowThemePicker(false) }}
              className="size-5 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-[9px] text-white transition-colors"
              title="Edit Max HP / AC / Temp HP"
            >✎</button>

            {showMaxMenu && (
              <div className={`absolute top-6 right-0 z-50 ${theme.box} border border-white/10 rounded-xl p-3 flex flex-col gap-2.5 min-w-36 shadow-xl`}>
                {(["maxHp", "ac", "tempHp"] as const).map(k => (
                  <label key={k} className="flex items-center gap-2">
                    <span className="text-[10px] text-white/70 w-14 shrink-0">
                      {k === "maxHp" ? "Max HP" : k === "ac" ? "AC" : "Temp HP"}
                    </span>
                    <input
                      type="number"
                      value={(data[k] as number | undefined) ?? ""}
                      onChange={e => update({ [k]: parseInt(e.target.value) || 0 })}
                      className="flex-1 text-center bg-white/10 rounded px-1 py-0.5 text-xs text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* SVG ring */}
          <div className="relative size-28">
            <svg viewBox="0 0 96 96" className="absolute inset-0 w-full h-full -rotate-90">
              <circle cx="48" cy="48" r={TEMP_R} fill="none" stroke="rgba(59,130,246,0.12)" strokeWidth="4" />
              {tempHp > 0 && (
                <circle cx="48" cy="48" r={TEMP_R} fill="none" stroke="#60a5fa" strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={tempC} strokeDashoffset={tempC * (1 - tempHpPct / 100)}
                  style={{ transition: "stroke-dashoffset 0.4s ease" }} />
              )}
              <circle cx="48" cy="48" r={RING_R} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
              <circle cx="48" cy="48" r={RING_R} fill="none" stroke={hpColor} strokeWidth="8" strokeLinecap="round"
                strokeDasharray={ringC} strokeDashoffset={ringC * (1 - hpPercent / 100)}
                style={{ transition: "stroke-dashoffset 0.4s ease, stroke 0.4s ease" }} />
            </svg>
            {/* AC shield overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <Shield className="size-10 text-white/60" />
              <span className="absolute text-sm font-bold text-white leading-none">{data.ac ?? 0}</span>
            </div>
          </div>

          {/* HP value */}
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-white leading-none">{hp}</span>
            {tempHp > 0 && <span className="text-xs font-bold text-blue-400 leading-none">+{tempHp}</span>}
            <span className="text-[9px] text-white/40">/ {maxHp}</span>
          </div>

          {/* HP controls */}
          <div className="flex flex-col items-center gap-1.5">
            <div className={`flex rounded-full text-[9px] font-semibold uppercase tracking-wide overflow-hidden ring-1 ${theme.ring}`}>
              <button type="button" onClick={() => setHpTarget("hp")}
                className={`px-2.5 py-1 transition-colors ${hpTarget === "hp" ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70"}`}>HP</button>
              <button type="button" onClick={() => setHpTarget("temp")}
                className={`px-2.5 py-1 transition-colors ${hpTarget === "temp" ? "bg-blue-500/40 text-blue-200" : "text-white/40 hover:text-white/70"}`}>Temp</button>
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button"
                onClick={() => hpTarget === "hp" ? update({ hp: Math.max(0, hp - hpStep) }) : update({ tempHp: Math.max(0, tempHp - hpStep) })}
                className="size-7 rounded-full bg-white/10 hover:bg-red-900 text-white hover:text-red-200 flex items-center justify-center text-base font-bold transition-colors">−</button>
              <input type="number" value={hpStep} onChange={e => setHpStep(Math.max(1, parseInt(e.target.value) || 1))} min={1}
                className={`w-10 text-center text-xs font-bold ${theme.box} border border-white/15 rounded-md py-1 text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`} />
              <button type="button"
                onClick={() => hpTarget === "hp" ? update({ hp: maxHp > 0 ? Math.min(maxHp, hp + hpStep) : hp + hpStep }) : update({ tempHp: tempHp + hpStep })}
                className="size-7 rounded-full bg-white/10 hover:bg-green-900 text-white hover:text-green-200 flex items-center justify-center text-base font-bold transition-colors">+</button>
            </div>
          </div>
        </div>

        {/* Speed / Initiative */}
        <div className="grid grid-cols-2 gap-1.5">
          {(["speed", "initiative"] as const).map(k => (
            <div key={k} className={`${card} p-2 flex flex-col items-center gap-0.5`}>
              <input type="number" value={(data[k] as number | undefined) ?? ""} onChange={e => update({ [k]: parseInt(e.target.value) || 0 })} placeholder="0"
                className="w-full text-center text-base font-bold bg-transparent outline-none text-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
              <span className="text-[8px] uppercase tracking-widest text-white/50">{k === "speed" ? "Spd" : "Init"}</span>
            </div>
          ))}
        </div>

        {/* Hit Dice */}
        {renderHitDice()}

        {/* Quick Search */}
        {renderQuickSearch()}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: HIT DICE
  // ══════════════════════════════════════════════════════════════════════════

  function renderHitDice() {
    const pools: HitDicePool[] = data.hitDicePools ?? []

    function updatePool(id: string, p: Partial<HitDicePool>) {
      update({ hitDicePools: pools.map(pl => pl.id === id ? { ...pl, ...p } : pl) })
    }
    function removePool(id: string) {
      update({ hitDicePools: pools.filter(pl => pl.id !== id) })
    }
    function commitAddPool() {
      update({ hitDicePools: [...pools, { id: nanoid(), dieType: newPoolDie, total: newPoolCount, used: 0 }] })
      setShowAddPool(false); setNewPoolDie("d8"); setNewPoolCount(1)
    }

    return (
      <div className={`${card} p-3 flex flex-col gap-2`}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest text-white/50 font-semibold">Hit Dice</span>
          <button
            type="button"
            onClick={() => { setEditingPools(v => !v); setShowAddPool(false); setNewPoolDie("d8"); setNewPoolCount(1) }}
            className={`text-[9px] px-2 py-0.5 rounded-full transition-colors ${editingPools ? "bg-yellow-500/20 text-yellow-300" : "bg-white/10 hover:bg-white/20 text-white/50 hover:text-white"}`}
          >
            {editingPools ? "Done" : "✎ Edit"}
          </button>
        </div>

        {/* View mode: dot grid */}
        {!editingPools && (
          <>
            {pools.length === 0 && (
              <p className="text-[10px] text-white/30 italic text-center py-1">No hit dice — click ✎ Edit to add</p>
            )}
            {pools.map(pool => {
              const rem = Math.max(0, pool.total - pool.used)
              return (
                <div key={pool.id} className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-white/70 w-7">{pool.dieType}</span>
                  <div className="flex flex-wrap gap-1 flex-1">
                    {Array.from({ length: pool.total }).map((_, i) => {
                      const avail = i < rem
                      return (
                        <button key={i} type="button"
                          title={avail ? "Click to use" : "Click to recover"}
                          onClick={() => updatePool(pool.id, { used: avail ? pool.used + 1 : Math.max(0, pool.used - 1) })}
                          className={`size-5 rounded text-[8px] font-bold border transition-colors ${
                            avail ? "bg-white/15 border-white/20 text-white hover:bg-red-900/60 hover:border-red-400/40"
                                  : "bg-transparent border-white/10 text-white/20 hover:bg-green-900/40 hover:border-green-400/30"
                          }`}>◆</button>
                      )
                    })}
                  </div>
                  <span className="text-[9px] text-white/30">{rem}/{pool.total}</span>
                </div>
              )
            })}
          </>
        )}

        {/* Edit mode: change die/count + delete + add row */}
        {editingPools && (
          <div className="flex flex-col gap-1.5">
            {pools.map(pool => (
              <div key={pool.id} className="flex items-center gap-1.5">
                <select value={pool.dieType} onChange={e => updatePool(pool.id, { dieType: e.target.value })}
                  className="bg-white/10 rounded px-1.5 py-1 text-[10px] text-white outline-none w-14">
                  {["d4","d6","d8","d10","d12"].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <div className="flex items-center gap-1 flex-1">
                  <button type="button" onClick={() => updatePool(pool.id, { total: Math.max(1, pool.total - 1), used: Math.min(pool.used, pool.total - 1) })}
                    className="size-5 rounded bg-white/10 hover:bg-white/20 text-white text-xs flex items-center justify-center">−</button>
                  <span className="text-xs text-white w-5 text-center">{pool.total}</span>
                  <button type="button" onClick={() => updatePool(pool.id, { total: pool.total + 1 })}
                    className="size-5 rounded bg-white/10 hover:bg-white/20 text-white text-xs flex items-center justify-center">+</button>
                  <span className="text-[9px] text-white/30 ml-1">used {pool.used}</span>
                </div>
                <button type="button" onClick={() => removePool(pool.id)}
                  className="size-5 flex items-center justify-center rounded text-white/30 hover:text-red-400 hover:bg-red-900/30 text-[9px] transition-colors">✕</button>
              </div>
            ))}

            {/* Add new pool row */}
            {!showAddPool ? (
              <button type="button" onClick={() => setShowAddPool(true)}
                className="text-[10px] border border-dashed border-white/15 hover:border-white/30 rounded-lg py-1 text-white/40 hover:text-white transition-colors">
                + Add pool
              </button>
            ) : (
              <div className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2 py-1.5">
                <select value={newPoolDie} onChange={e => setNewPoolDie(e.target.value)}
                  className="bg-white/10 rounded px-1.5 py-1 text-[10px] text-white outline-none w-14">
                  {["d4","d6","d8","d10","d12"].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <div className="flex items-center gap-1 flex-1">
                  <button type="button" onClick={() => setNewPoolCount(c => Math.max(1, c - 1))}
                    className="size-5 rounded bg-white/10 hover:bg-white/20 text-white text-xs flex items-center justify-center">−</button>
                  <span className="text-xs text-white w-5 text-center">{newPoolCount}</span>
                  <button type="button" onClick={() => setNewPoolCount(c => c + 1)}
                    className="size-5 rounded bg-white/10 hover:bg-white/20 text-white text-xs flex items-center justify-center">+</button>
                </div>
                <button type="button" onClick={commitAddPool}
                  className="text-[9px] px-2 py-0.5 rounded bg-white/15 hover:bg-white/25 text-white transition-colors">Add</button>
                <button type="button" onClick={() => setShowAddPool(false)}
                  className="size-5 flex items-center justify-center rounded text-white/30 hover:text-white text-[9px] transition-colors">✕</button>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: QUICK SEARCH
  // ══════════════════════════════════════════════════════════════════════════

  function renderQuickSearch() {
    return (
      <div className="relative">
        <div className={`${card} px-2 py-1.5 flex items-center gap-1.5`}>
          <span className="text-white/30 text-[10px]">⌕</span>
          <input
            value={quickSearch}
            onChange={e => setQuickSearch(e.target.value)}
            placeholder="Quick search…"
            className="flex-1 bg-transparent outline-none text-[10px] text-white placeholder:text-white/25"
          />
          {quickSearch && (
            <button type="button" onClick={() => setQuickSearch("")} className="text-white/30 hover:text-white text-[9px]">✕</button>
          )}
        </div>

        {searchResults.length > 0 && (
          <div className={`absolute top-full left-0 right-0 z-40 mt-1 ${theme.box} border border-white/10 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto`}>
            {searchResults.map(r => (
              <div key={r.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/10 border-b border-white/5 last:border-0">
                <span className="text-[8px] text-white/30 uppercase tracking-wider w-10 shrink-0">{r.category}</span>
                <span className="text-[10px] text-white flex-1 truncate">{r.label}</span>
                <button type="button"
                  onClick={() => addFavorite({ refId: r.id, refType: r.refType, label: r.label })}
                  className={`text-[10px] shrink-0 transition-colors ${favorites.find(f => f.refId === r.id) ? "text-yellow-400" : "text-white/20 hover:text-yellow-400"}`}
                  title="Add to favorites">★</button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: SAVES + ABILITIES + CONDITIONS
  // ══════════════════════════════════════════════════════════════════════════

  function renderSavesAbilitiesConditions() {
    return (
      <div className={`${card} p-3 flex flex-col gap-2`}>
        <div className="flex gap-4">

          {/* Saving Throws column */}
          <div className="flex-1 min-w-0">
            <span className="text-[10px] uppercase tracking-widest text-white/50 font-semibold block mb-1.5">Saving Throws</span>
            <div className="flex flex-col gap-1.5">
              {SAVE_KEYS.map(save => {
                const mod = getSaveMod(save)
                const prof = data.savingThrowProfs?.[save] ?? false
                return (
                  <div key={save} className="flex items-center gap-2">
                    <button type="button"
                      onClick={() => update({ savingThrowProfs: { ...data.savingThrowProfs, [save]: !prof } })}
                      className={`size-3.5 rounded-full border-2 shrink-0 transition-colors ${prof ? "bg-primary border-primary" : "border-white/30 bg-transparent hover:border-white/60"}`} />
                    <span className="text-[10px] text-white/70 w-7 uppercase tracking-wider">{ABILITY_ABBR[SAVE_TO_ABILITY[save]]}</span>
                    <span className={`text-xs font-mono font-bold w-7 ${mod >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {mod >= 0 ? `+${mod}` : `${mod}`}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Abilities column */}
          <div className="flex-1 min-w-0">
            <span className="text-[10px] uppercase tracking-widest text-white/50 font-semibold block mb-1.5">Abilities</span>
            <div className="flex flex-col gap-1.5">
              {ABILITY_KEYS.map(key => {
                const stored  = (data[key as keyof CharacterData] as number | undefined) ?? 10
                const display = abilityInputs[key] !== undefined ? abilityInputs[key] : String(stored)
                const mod     = abilityMod(stored)
                return (
                  <div key={key} className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase tracking-widest text-white/50 w-7">{ABILITY_ABBR[key]}</span>
                    <input
                      type="number"
                      value={display}
                      onChange={e => setAbilityInputs(prev => ({ ...prev, [key]: e.target.value }))}
                      onBlur={e => {
                        const v = e.target.value.trim()
                        update({ [key]: v === "" ? 0 : Math.max(1, Math.min(30, parseInt(v) || 0)) })
                        setAbilityInputs(prev => { const n = { ...prev }; delete n[key]; return n })
                      }}
                      placeholder="10"
                      className="w-10 text-center bg-white/10 rounded px-1 py-0.5 text-sm font-bold text-white outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <span className={`text-xs font-mono w-6 ${mod.startsWith("-") ? "text-red-400" : "text-green-400"}`}>{mod}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Conditions row */}
        <div className="border-t border-white/10 pt-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold shrink-0">Conditions</span>
            {conditions.map(cond => (
              <span key={cond.id}
                className={`flex items-center gap-1 text-[9px] border rounded-full px-2 py-0.5 ${CONDITION_COLOR[cond.name] ?? "bg-white/10 text-white/70 border-white/20"}`}>
                {cond.name}
                {cond.name === "Exhaustion" && (
                  <span className="flex items-center gap-0.5 ml-0.5">
                    <button type="button" onClick={() => updateCondition(cond.id, { level: Math.max(1, (cond.level ?? 1) - 1) })} className="opacity-60 hover:opacity-100 text-[8px]">−</button>
                    <span className="font-bold">{cond.level ?? 1}</span>
                    <button type="button" onClick={() => updateCondition(cond.id, { level: Math.min(6, (cond.level ?? 1) + 1) })} className="opacity-60 hover:opacity-100 text-[8px]">+</button>
                  </span>
                )}
                {!readOnly && (
                  <button type="button" onClick={() => removeCondition(cond.id)} className="opacity-50 hover:opacity-100 text-[8px] ml-0.5">✕</button>
                )}
              </span>
            ))}
            {!readOnly && (
              <div className="relative">
                <button type="button" onClick={() => setShowConditionPicker(v => !v)}
                  className="text-[9px] px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-white/50 hover:text-white transition-colors">
                  + Add
                </button>
                {showConditionPicker && (
                  <div className={`absolute left-0 top-full mt-1 z-50 ${theme.box} border border-white/10 rounded-xl p-2 shadow-xl w-40 max-h-48 overflow-y-auto`}>
                    {ALL_CONDITIONS.map(name => (
                      <button key={name} type="button" onClick={() => addCondition(name)}
                        className="w-full text-left text-[10px] px-2 py-1 rounded hover:bg-white/10 text-white/70 hover:text-white transition-colors">
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: SPELL SLOTS
  // ══════════════════════════════════════════════════════════════════════════

  function renderSpellSlots() {
    if (spellSlots.length === 0 && !showAddSlot) {
      return (
        <button type="button" onClick={() => setShowAddSlot(true)}
          className="text-[9px] text-white/30 hover:text-white/60 transition-colors">
          + Add Spell Slots
        </button>
      )
    }
    return (
      <div className="flex flex-col gap-1">
        {spellSlots.map(slot => {
          const rem = slot.total - slot.used
          return (
            <div key={slot.level} className="flex items-center gap-1.5">
              <span className="text-[9px] text-white/50 w-8 shrink-0">Lv {slot.level}</span>
              <div className="flex gap-0.5 flex-1">
                {Array.from({ length: slot.total }).map((_, i) => {
                  const avail = i < rem
                  return (
                    <button key={i} type="button"
                      onClick={() => changeSlot(slot.level, { used: avail ? slot.used + 1 : Math.max(0, slot.used - 1) })}
                      title={avail ? "Expend slot" : "Recover slot"}
                      className={`size-3.5 rounded-sm border transition-colors ${
                        avail ? "bg-primary/60 border-primary/60 hover:bg-red-500/60 hover:border-red-400/60"
                              : "bg-transparent border-white/15 hover:bg-green-900/40 hover:border-green-400/30"
                      }`} />
                  )
                })}
              </div>
              <span className="text-[8px] text-white/30 shrink-0">{rem}/{slot.total}</span>
              <span className="text-[8px] text-white/30 shrink-0">{slot.resetsOn === "short" ? "☀" : "🌙"}</span>
              {!readOnly && (
                <button type="button" onClick={() => removeSlot(slot.level)}
                  className="text-white/20 hover:text-red-400 text-[9px] transition-colors shrink-0">✕</button>
              )}
            </div>
          )
        })}
        {!readOnly && !showAddSlot && (
          <button type="button" onClick={() => setShowAddSlot(true)}
            className="text-[9px] text-white/30 hover:text-white/60 transition-colors text-left">+ Add Slot</button>
        )}
        {showAddSlot && (
          <div className="rounded-lg border border-white/10 bg-white/5 p-2 flex flex-col gap-1.5 mt-1">
            <div className="flex items-center gap-2 text-[10px]">
              <label className="flex items-center gap-1 text-white/50">
                Lv
                <select value={newSlotLevel} onChange={e => setNewSlotLevel(parseInt(e.target.value))}
                  className="bg-white/10 rounded px-1 text-white outline-none">
                  {[1,2,3,4,5,6,7,8,9].filter(l => !spellSlots.find(s => s.level === l)).map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1 text-white/50">
                Slots
                <input type="number" value={newSlotTotal} onChange={e => setNewSlotTotal(Math.max(1, parseInt(e.target.value) || 1))} min={1}
                  className="w-10 bg-white/10 rounded px-1 text-center text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
              </label>
              <label className="flex items-center gap-1 text-white/50">
                Resets
                <select value={newSlotRests} onChange={e => setNewSlotRests(e.target.value as "short" | "long")}
                  className="bg-white/10 rounded px-1 text-white outline-none">
                  <option value="long">Long</option>
                  <option value="short">Short</option>
                </select>
              </label>
            </div>
            <div className="flex gap-1.5">
              <button type="button" onClick={addSlot} className="flex-1 text-[10px] rounded bg-white/15 hover:bg-white/25 text-white py-0.5">Add</button>
              <button type="button" onClick={() => setShowAddSlot(false)} className="text-[10px] rounded hover:bg-white/10 text-white/40 px-2 py-0.5">Cancel</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: SPELLS / EQUIPMENT PANEL
  // ══════════════════════════════════════════════════════════════════════════

  function renderSpellsEquipPanel() {
    return (
      <div className={`${card} p-3 flex flex-col gap-2 flex-1 min-h-0 min-w-0`}>

        {/* Panel header */}
        <div className="flex items-center justify-between flex-wrap gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-white/50 font-semibold">
              {showSpells ? "Spells" : "Equipment"}
            </span>
            <button type="button" onClick={() => setShowSpells(v => !v)}
              className="text-[9px] px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors uppercase tracking-wide">
              ⇄ {showSpells ? "Equipment" : "Spells"}
            </button>
          </div>

          {/* Spell stats bar */}
          {showSpells && (
            <div className="flex items-center gap-2 text-[10px] text-white/50 flex-wrap">
              <span>DC</span>
              <input type="number" value={data.spellSaveDC ?? ""} onChange={e => update({ spellSaveDC: parseInt(e.target.value) || 0 })} placeholder="0"
                className="w-7 text-center bg-white/10 rounded px-1 py-0.5 text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
              <span>Atk</span>
              <input type="number" value={data.spellAttackBonus ?? ""} onChange={e => update({ spellAttackBonus: parseInt(e.target.value) || 0 })} placeholder="0"
                className="w-7 text-center bg-white/10 rounded px-1 py-0.5 text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
              <select value={data.spellcastingAbility ?? ""} onChange={e => update({ spellcastingAbility: e.target.value })}
                className="bg-white/10 rounded px-1 py-0.5 text-white outline-none text-[10px]">
                <option value="">Ability</option>
                {["STR","DEX","CON","INT","WIS","CHA"].map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Spell slots */}
        {showSpells && (
          <div className="shrink-0 border-b border-white/10 pb-2 mb-0.5">
            {renderSpellSlots()}
          </div>
        )}

        {/* List */}
        <div className="flex flex-col gap-1.5 overflow-auto flex-1">
          {showSpells ? (
            <>
              {spellItems.map(spell => (
                <SpellEntry key={spell.id} spell={spell} theme={theme} readOnly={readOnly}
                  onChange={p => changeSpell(spell.id, p)} onRemove={() => removeSpell(spell.id)} />
              ))}
              {!readOnly && (
                <button type="button" onClick={addSpell}
                  className="text-[10px] text-white/40 hover:text-white border border-dashed border-white/15 hover:border-white/30 rounded-lg py-1.5 transition-colors shrink-0">
                  + Add Spell
                </button>
              )}
            </>
          ) : (
            <>
              {equipItems.map(item => (
                <EquipmentEntry key={item.id} item={item} theme={theme} readOnly={readOnly}
                  onChange={p => changeEquip(item.id, p)} onRemove={() => removeEquip(item.id)} />
              ))}
              {!readOnly && (
                <button type="button" onClick={addEquip}
                  className="text-[10px] text-white/40 hover:text-white border border-dashed border-white/15 hover:border-white/30 rounded-lg py-1.5 transition-colors shrink-0">
                  + Add Item
                </button>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: FAVORITES PANEL
  // ══════════════════════════════════════════════════════════════════════════

  function renderFavorites() {
    const TYPE_ICON: Record<string, string> = { spell: "✦", equipment: "⚔", feature: "◈" }

    function resolveLabel(fav: FavoriteRef): string {
      if (fav.refType === "spell")     return spellItems.find(s => s.id === fav.refId)?.name || fav.label
      if (fav.refType === "equipment") return equipItems.find(i => i.id === fav.refId)?.name || fav.label
      const all = [...(data.racialTraits ?? []), ...(data.feats ?? []), ...(data.classFeatures ?? [])]
      return all.find(f => f.id === fav.refId)?.name || fav.label
    }

    return (
      <div
        className={`${card} p-3 flex flex-col gap-2 flex-1 min-h-0 min-w-0`}
        onDragOver={e => { e.preventDefault(); setFavDragOver(true) }}
        onDragLeave={() => setFavDragOver(false)}
        onDrop={e => {
          e.preventDefault()
          setFavDragOver(false)
          try {
            const ref = JSON.parse(e.dataTransfer.getData("x-fable-ref")) as FavoriteRef
            addFavorite(ref)
          } catch {}
        }}
      >
        <span className="text-[10px] uppercase tracking-widest text-white/50 font-semibold shrink-0">Favorites</span>

        <div className={`flex flex-col gap-1.5 overflow-auto flex-1 min-h-0 rounded-lg transition-colors ${favDragOver ? "ring-1 ring-primary/40 bg-primary/5" : ""}`}>
          {favorites.length === 0 && (
            <div className={`flex-1 flex flex-col items-center justify-center text-center py-4 rounded-lg border-2 border-dashed transition-colors ${favDragOver ? "border-primary/50" : "border-white/10"}`}>
              <p className="text-[9px] text-white/25">Drag spells, items or features</p>
              <p className="text-[9px] text-white/25">here, or click ★ in search</p>
            </div>
          )}
          {favorites.map(fav => (
            <div key={fav.refId} className={`${theme.box} border border-white/10 rounded-lg px-2.5 py-1.5 flex items-center gap-2`}>
              <span className="text-[9px] text-white/40 shrink-0">{TYPE_ICON[fav.refType] ?? "·"}</span>
              <span className="text-[10px] text-white flex-1 truncate">{resolveLabel(fav)}</span>
              {!readOnly && (
                <button type="button" onClick={() => removeFavorite(fav.refId)}
                  className="text-white/20 hover:text-red-400 text-[9px] transition-colors shrink-0">✕</button>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: COMBAT TAB
  // ══════════════════════════════════════════════════════════════════════════

  function renderCombatTab() {
    return (
      <div className="flex flex-col md:flex-row gap-3 flex-1 min-h-0">

        {/* Left column */}
        <div className="md:w-44 shrink-0 flex flex-col gap-3">
          {renderHpPanel()}
        </div>

        {/* Right area */}
        <div className="flex flex-col gap-3 flex-1 min-w-0">
          {renderSavesAbilitiesConditions()}

          {/* Spells/Equipment + Favorites side by side */}
          <div className="flex flex-col sm:flex-row gap-3 flex-1 min-h-0">
            {renderSpellsEquipPanel()}
            <div className="sm:w-44 shrink-0 flex flex-col gap-3 min-h-0">
              {renderFavorites()}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: PORTRAIT PICKER MODAL
  // ══════════════════════════════════════════════════════════════════════════

  function renderPortraitPicker() {
    if (!showPortraitPicker) return null
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowPortraitPicker(false)}>
        <div className={`rounded-xl border border-white/10 ${theme.box} p-4 shadow-xl w-72 max-h-[70vh] flex flex-col gap-3`} onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between shrink-0">
            <span className="text-sm font-semibold text-white">Choose Portrait</span>
            <button type="button" onClick={() => setShowPortraitPicker(false)} className="size-6 flex items-center justify-center rounded-md hover:bg-white/10 text-white/50 hover:text-white text-xs">✕</button>
          </div>
          <button type="button" onClick={() => portraitRef.current?.click()}
            className="text-[11px] border border-dashed border-white/20 hover:border-white/40 rounded-lg py-2 text-white/50 hover:text-white transition-colors shrink-0">
            + Upload new image
          </button>
          <div className="overflow-y-auto flex-1 min-h-0">
            {galleryLoading
              ? <p className="text-xs text-white/40 text-center py-4">Loading…</p>
              : galleryImages.length === 0
              ? <p className="text-xs text-white/40 italic text-center py-4">No images yet — upload in Profile Settings.</p>
              : (
                <div className="grid grid-cols-3 gap-2">
                  {galleryImages.map(img => (
                    <button key={img.name} type="button"
                      onClick={() => { update({ portrait: img.publicUrl }); setShowPortraitPicker(false) }}
                      className={`aspect-square rounded-lg overflow-hidden border-2 transition-colors ${data.portrait === img.publicUrl ? "border-primary" : "border-transparent hover:border-white/40"}`}>
                      <img src={img.publicUrl} alt={img.name} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div
      className="flex flex-col h-full min-h-0 text-white rounded-xl overflow-hidden"
      onClick={() => { setShowMaxMenu(false); setShowThemePicker(false); setShowConditionPicker(false) }}
    >

      {/* Portrait picker modal */}
      {renderPortraitPicker()}
      <input ref={portraitRef} type="file" accept="image/*" className="hidden" onChange={uploadPortrait} />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className={`flex items-center gap-3 px-4 py-3 border-b border-white/10 shrink-0 ${theme.header}`}>

        {/* Portrait button */}
        <button
          type="button"
          onClick={readOnly ? undefined : openPortraitPicker}
          className={`relative size-10 rounded-full overflow-hidden ring-2 ${theme.ring} ${readOnly ? "" : "hover:ring-primary cursor-pointer"} shrink-0 ${theme.box} flex items-center justify-center transition-all`}
          title={readOnly ? undefined : "Choose portrait"}
        >
          {uploading
            ? <span className="text-[9px] text-white/70">…</span>
            : data.portrait
            ? <img src={data.portrait} alt="portrait" className="w-full h-full object-cover" />
            : <span className="text-xl leading-none select-none">🧙</span>
          }
        </button>

        {/* Name / race / class / level */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-bold tracking-wide truncate">{character.name}</p>
            {readOnly && (
              <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/40 uppercase tracking-widest shrink-0">
                View Only
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-[10px] text-white/50 uppercase tracking-widest">
            <input value={data.race ?? ""} onChange={e => update({ race: e.target.value })} placeholder="Race"
              className="bg-transparent outline-none w-14 placeholder:text-white/20" disabled={readOnly} />
            <span className="text-white/20">/</span>
            <input value={data.class ?? ""} onChange={e => update({ class: e.target.value })} placeholder="Class"
              className="bg-transparent outline-none w-20 placeholder:text-white/20" disabled={readOnly} />
            <span className="text-white/20">·</span>
            <span>Lv</span>
            <input type="number" value={data.level ?? ""} min={1} max={20}
              onChange={e => update({ level: Math.min(20, Math.max(1, parseInt(e.target.value) || 1)) })}
              placeholder="1" disabled={readOnly}
              className="bg-transparent outline-none w-5 placeholder:text-white/20 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
          </div>
        </div>

        {saving && <span className="text-[10px] text-white/40 shrink-0">saving…</span>}

        {/* Theme picker */}
        {!readOnly && (
          <div className="relative">
            <button type="button"
              onClick={e => { e.stopPropagation(); setShowThemePicker(v => !v); setShowMaxMenu(false) }}
              className="text-[9px] px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-white/50 hover:text-white shrink-0 transition-colors"
              title="Change theme">
              Theme
            </button>
            {showThemePicker && (
              <div className={`absolute right-0 top-9 z-50 ${theme.box} border border-white/10 rounded-xl p-2 flex flex-col gap-1 min-w-27.5 shadow-xl`}>
                {Object.entries(THEMES).map(([key, t]) => (
                  <button key={key} type="button"
                    onClick={() => { update({ theme: key }); setShowThemePicker(false) }}
                    className={`text-xs px-3 py-1.5 rounded-lg text-left transition-colors ${(data.theme === key || (!data.theme && key === DEFAULT_THEME)) ? "bg-white/20 text-white" : "text-white hover:bg-white/10"}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Close */}
        <button type="button" onClick={onClose}
          className="size-7 flex items-center justify-center rounded-md hover:bg-white/10 text-white/50 hover:text-white shrink-0 transition-colors">
          ✕
        </button>
      </div>

      {/* ── Tab bar ────────────────────────────────────────────────────────── */}
      <div className={`flex items-center gap-1 px-4 py-2 border-b border-white/10 shrink-0 ${theme.header}`}>
        {(["combat", "info"] as Tab[]).map(tab => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)}
            className={`px-3 py-1 text-[10px] uppercase tracking-widest rounded-full font-semibold transition-colors ${activeTab === tab ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70 hover:bg-white/5"}`}>
            {tab === "combat" ? "Combat" : "Info"}
          </button>
        ))}
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className={`flex flex-col flex-1 min-h-0 overflow-auto p-4 ${theme.body}`}>
        {activeTab === "combat" && renderCombatTab()}
        {activeTab === "info" && (
          <InfoTab data={data} update={update} theme={theme} card={card} readOnly={readOnly} />
        )}
      </div>
    </div>
  )
}
