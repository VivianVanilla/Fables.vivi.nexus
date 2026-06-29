// ════════════════════════════════════════════════════════════════════════════
// character.tsx — CharacterSheet root component
//
// All menus are modal overlays (fixes "menu closes immediately" bug).
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
  SpellSlot, FavoriteRef, ActiveCondition, Feature,
} from "./character-types"
import { ABILITY_KEYS, ABILITY_ABBR, SAVE_KEYS, SAVE_TO_ABILITY, SUPABASE_BUCKET, SKILLS } from "./character-constants"
import { abilityMod, profBonus, nanoid, safeParseJson } from "./character-utils"
import { THEMES, DEFAULT_THEME } from "./character-themes"

import { Modal }            from "./character/ui/Modal"
import { SpellEntry }       from "./character/entries/SpellEntry"
import { EquipmentEntry }   from "./character/entries/EquipmentEntry"
import { FavoritesPanel }   from "./character/panels/FavoritesPanel"
import { InfoTab }          from "./character/tabs/InfoTab"
import { TracingSlider }    from "./ui/tracing-slider"

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

const SAVE_FULL: Record<string, string> = {
  str: "Strength", dex: "Dexterity", con: "Constitution",
  int: "Intelligence", wis: "Wisdom", cha: "Charisma",
}

// ── TYPES ─────────────────────────────────────────────────────────────────────

interface Props {
  character: SidebarObject
  onClose: () => void
  readOnly?: boolean
}

type Tab = "main" | "details"

// ════════════════════════════════════════════════════════════════════════════
// CharacterSheet
// ════════════════════════════════════════════════════════════════════════════

export function CharacterSheet({ character, readOnly = false }: Props) {
  const { user, updateObject } = useUserContext()

  // ── STATE ─────────────────────────────────────────────────────────────────

  const [saving,             setSaving]             = useState(false)
  const [uploading,          setUploading]           = useState(false)
  const [activeTab,          setActiveTab]           = useState<Tab>("main")
  const [showSpells,         setShowSpells]          = useState(true)

  // Modal states — all menus are modal overlays
  const [showMaxMenu,         setShowMaxMenu]         = useState(false)
  const [showThemePicker,     setShowThemePicker]     = useState(false)
  const [showConditionPicker, setShowConditionPicker] = useState(false)
  const [showPortraitPicker,  setShowPortraitPicker]  = useState(false)
  const [showSavesModal,        setShowSavesModal]        = useState(false)
  const [showAbilityModal,      setShowAbilityModal]      = useState(false)
  const [showSpellcastingModal, setShowSpellcastingModal] = useState(false)
  const [showSkillModal,        setShowSkillModal]        = useState<string | null>(null)

  const [galleryImages,  setGalleryImages]  = useState<{ name: string; publicUrl: string }[]>([])
  const [galleryLoading, setGalleryLoading] = useState(false)

  // HP controls
  const [hpStep,   setHpStep]   = useState(1)
  const [hpTarget, setHpTarget] = useState<"hp" | "temp">("hp")

  // Hit dice edit state
  const [editingPools, setEditingPools] = useState(false)
  const [showAddPool,  setShowAddPool]  = useState(false)
  const [newPoolDie,   setNewPoolDie]   = useState("d8")
  const [newPoolCount, setNewPoolCount] = useState(1)

  // Spell slot add form (values used in spellcasting modal)
  const [newSlotLevel, setNewSlotLevel] = useState(1)
  const [newSlotTotal, setNewSlotTotal] = useState(2)
  const [newSlotRests, setNewSlotRests] = useState<"short" | "long">("long")

  // Favorites
  const [favDragOver, setFavDragOver] = useState(false)
  const [favFloat,    setFavFloat]    = useState(false)
  const [favPos,      setFavPos]      = useState({ x: 32, y: 120 })

  // Quick search
  const [quickSearch, setQuickSearch] = useState("")

  // Ability score local buffer (allows clearing "0")
  const [abilityInputs, setAbilityInputs] = useState<Record<string, string>>({})

  const portraitRef = useRef<HTMLInputElement>(null)
  const saveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const hp        = data.hp    ?? 0
  const maxHp     = data.maxHp ?? 0
  const tempHp    = data.tempHp ?? 0
  const hpPercent = maxHp > 0 ? Math.min(100, (hp / maxHp) * 100) : 0
  const tempHpPct = maxHp > 0 ? Math.min(100, (tempHp / maxHp) * 100) : 0
  const hpColor   = hpPercent > 50 ? "#22c55e" : hpPercent > 25 ? "#eab308" : "#ef4444"
  const RING_R    = 32
  const TEMP_R    = 43
  const ringC     = 2 * Math.PI * RING_R
  const tempC     = 2 * Math.PI * TEMP_R

  // ── SPELL / EQUIPMENT HELPERS ─────────────────────────────────────────────

  const spellItems = data.spellItems     ?? []
  const equipItems = data.equipmentItems ?? []
  const spellSlots = data.spellSlots     ?? []
  const favorites  = data.favorites      ?? []
  const conditions = data.conditions     ?? []

  const allFeatures: Feature[] = [
    ...(data.racialTraits  ?? []),
    ...(data.feats         ?? []),
    ...(data.classFeatures ?? []),
  ]

  function addSpell()                                            { update({ spellItems: [...spellItems, { id: nanoid(), name: "", level: 0 }] }) }
  function changeSpell(id: string, p: Partial<SpellItem>)       { update({ spellItems: spellItems.map(s => s.id === id ? { ...s, ...p } : s) }) }
  function removeSpell(id: string)                              { update({ spellItems: spellItems.filter(s => s.id !== id) }) }

  function addEquip()                                            { update({ equipmentItems: [...equipItems, { id: nanoid(), name: "", type: "melee" }] }) }
  function changeEquip(id: string, p: Partial<EquipmentItem>)   { update({ equipmentItems: equipItems.map(i => i.id === id ? { ...i, ...p } : i) }) }
  function removeEquip(id: string)                              { update({ equipmentItems: equipItems.filter(i => i.id !== id) }) }

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
    setNewSlotLevel(1); setNewSlotTotal(2)
  }
  function removeSlot(level: number) { update({ spellSlots: spellSlots.filter(s => s.level !== level) }) }

  // ── FAVORITES HELPERS ─────────────────────────────────────────────────────

  function addFavorite(ref: FavoriteRef) {
    if (favorites.find(f => f.refId === ref.refId)) return
    update({ favorites: [...favorites, ref] })
  }
  function removeFavorite(refId: string) { update({ favorites: favorites.filter(f => f.refId !== refId) }) }

  // Update a feature's usesUsed regardless of which list it belongs to
  function updateFeatureUses(id: string, usesUsed: number) {
    patchFeature(id, { usesUsed })
  }

  function patchFeature(id: string, patch: Partial<Feature>) {
    for (const key of ["racialTraits", "feats", "classFeatures"] as const) {
      if (data[key]?.find(f => f.id === id)) {
        update({ [key]: data[key]!.map(f => f.id === id ? { ...f, ...patch } : f) })
        return
      }
    }
  }

  // ── CONDITION HELPERS ─────────────────────────────────────────────────────

  function addCondition(name: string) {
    if (conditions.find(c => c.name === name)) return
    update({ conditions: [...conditions, { id: nanoid(), name }] })
    setShowConditionPicker(false)
  }
  function removeCondition(id: string)                          { update({ conditions: conditions.filter(c => c.id !== id) }) }
  function updateCondition(id: string, p: Partial<ActiveCondition>) {
    update({ conditions: conditions.map(c => c.id === id ? { ...c, ...p } : c) })
  }

  // ── QUICK SEARCH ──────────────────────────────────────────────────────────

  const q = quickSearch.toLowerCase().trim()
  const searchResults: { id: string; label: string; category: string; refType: FavoriteRef["refType"] }[] = q ? [
    ...spellItems.filter(s => s.name.toLowerCase().includes(q)).map(s => ({ id: s.id, label: s.name, category: "Spell",   refType: "spell"     as const })),
    ...equipItems.filter(i => i.name.toLowerCase().includes(q)).map(i => ({ id: i.id, label: i.name, category: "Item",    refType: "equipment" as const })),
    ...(data.racialTraits   ?? []).filter(f => f.name.toLowerCase().includes(q)).map(f => ({ id: f.id, label: f.name, category: "Trait",   refType: "feature" as const })),
    ...(data.feats          ?? []).filter(f => f.name.toLowerCase().includes(q)).map(f => ({ id: f.id, label: f.name, category: "Feat",    refType: "feature" as const })),
    ...(data.classFeatures  ?? []).filter(f => f.name.toLowerCase().includes(q)).map(f => ({ id: f.id, label: f.name, category: "Feature", refType: "feature" as const })),
  ] : []

  // ── COMPUTED THEME / CARD ─────────────────────────────────────────────────

  const theme = THEMES[data.theme ?? DEFAULT_THEME] ?? THEMES[DEFAULT_THEME]
  const card  = `rounded-xl ${theme.box} ring-1 ${theme.ring}`

  // ── SAVING THROW MODIFIER ─────────────────────────────────────────────────

  function getSaveMod(save: typeof SAVE_KEYS[number]): number {
    const score      = (data[SAVE_TO_ABILITY[save] as keyof CharacterData] as number | undefined) ?? 10
    const base       = Math.floor((score - 10) / 2)
    const proficient = data.savingThrowProfs?.[save] ?? false
    const bonus      = data.saveBonuses?.[save] ?? 0
    return base + (proficient ? profBonus(data.level ?? 1) : 0) + bonus
  }

  function getSkillMod(skillName: string, abilityKey: string): number {
    const score = (data[SAVE_TO_ABILITY[abilityKey] as keyof CharacterData] as number | undefined) ?? 10
    const base  = Math.floor((score - 10) / 2)
    const prof  = data.skillProfs?.[skillName]
    const pb    = profBonus(data.level ?? 1)
    const bonus = data.skillBonuses?.[skillName] ?? 0
    const profMod = prof === "exp" ? pb * 2 : prof === "prof" ? pb : prof === "half" ? Math.floor(pb / 2) : 0
    return base + profMod + bonus
  }

  // ── FAVORITES PROPS ───────────────────────────────────────────────────────

  const favPanelProps = {
    favorites, spellItems, equipItems, features: allFeatures,
    onRemove: removeFavorite, onUpdateUses: updateFeatureUses,
    theme, card, readOnly,
    dragOver: favDragOver,
    onDragOver:  (e: React.DragEvent) => { e.preventDefault(); setFavDragOver(true) },
    onDragLeave: () => setFavDragOver(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault(); setFavDragOver(false)
      try { addFavorite(JSON.parse(e.dataTransfer.getData("x-fable-ref")) as FavoriteRef) } catch {}
    },
    isFloat: favFloat, floatPos: favPos,
    onFloatToggle: () => setFavFloat(v => !v),
    onFloatPosChange: setFavPos,
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MODAL: Edit Max Stats (HP / AC / Temp HP)
  // ══════════════════════════════════════════════════════════════════════════

  function renderMaxStatsModal() {
    if (!showMaxMenu) return null
    return (
      <Modal onClose={() => setShowMaxMenu(false)}>
        <div className="bg-zinc-900 border border-white/20 rounded-2xl shadow-2xl w-64 flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10">
            <p className="text-base font-bold text-white">Edit Stats</p>
          </div>
          <div className="px-5 py-4 flex flex-col gap-4">
            {(["maxHp", "ac", "tempHp"] as const).map(k => (
              <label key={k} className="flex flex-col gap-1.5">
                <span className="text-xs text-white/40 uppercase tracking-wider">
                  {k === "maxHp" ? "Max HP" : k === "ac" ? "Armour Class" : "Temp HP"}
                </span>
                <input type="number"
                  value={(data[k] as number | undefined) ?? ""}
                  onFocus={e => e.target.select()}
                  onChange={e => update({ [k]: parseInt(e.target.value) || 0 })}
                  className="text-center bg-white/10 rounded-xl px-3 py-3 text-xl font-bold text-white outline-none focus:ring-2 focus:ring-white/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </label>
            ))}
          </div>
          <div className="px-5 pb-5">
            <button type="button" onClick={() => setShowMaxMenu(false)}
              className="w-full py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-sm text-white font-semibold transition-colors">
              Done
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MODAL: Saving Throws
  // ══════════════════════════════════════════════════════════════════════════

  function renderSavesModal() {
    if (!showSavesModal) return null
    return (
      <Modal onClose={() => setShowSavesModal(false)}>
        <div className="bg-zinc-900 border border-white/20 rounded-2xl shadow-2xl w-72 flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
            <p className="text-base font-bold text-white">Saving Throws</p>
            <span className="text-sm text-white/40">Prof +{profBonus(data.level ?? 1)}</span>
          </div>
          <div className="px-2 py-3 flex flex-col gap-0.5">
            {SAVE_KEYS.map(save => {
              const prof  = data.savingThrowProfs?.[save] ?? false
              const bonus = data.saveBonuses?.[save] ?? 0
              const mod   = getSaveMod(save)
              return (
                <div key={save} className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors">
                  <button type="button" disabled={readOnly}
                    onClick={() => update({ savingThrowProfs: { ...data.savingThrowProfs, [save]: !prof } })}
                    className={`size-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors disabled:cursor-default ${prof ? "bg-primary border-primary" : "border-white/30"}`}>
                    {prof && <span className="text-white text-[10px] font-bold">✓</span>}
                  </button>
                  <span className="text-sm text-white/70 flex-1">{SAVE_FULL[save]}</span>
                  {!readOnly && (
                    <input type="number" value={bonus || ""} placeholder="+0"
                      onFocus={e => e.target.select()}
                      onChange={e => update({ saveBonuses: { ...data.saveBonuses, [save]: parseInt(e.target.value) || 0 } })}
                      className="w-12 text-center bg-white/10 rounded-lg px-1 py-1 text-xs text-white/60 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      title="Additional flat bonus" />
                  )}
                  <span className={`text-base font-mono font-bold w-8 text-right ${mod >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {mod >= 0 ? `+${mod}` : mod}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="px-5 pb-5">
            <button type="button" onClick={() => setShowSavesModal(false)}
              className="w-full py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-sm text-white font-semibold transition-colors">
              Done
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MODAL: Spellcasting Config (DC / Atk / Ability / Known / Prepared / Slots)
  // ══════════════════════════════════════════════════════════════════════════

  function renderSpellcastingModal() {
    if (!showSpellcastingModal) return null
    const availLevels = [1,2,3,4,5,6,7,8,9].filter(l => !spellSlots.find(s => s.level === l))
    return (
      <Modal onClose={() => setShowSpellcastingModal(false)}>
        <div className="bg-zinc-900 border border-white/20 rounded-2xl shadow-2xl w-80 max-h-[85vh] flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
            <p className="text-base font-bold text-white">Spellcasting</p>
            <button type="button" onClick={() => setShowSpellcastingModal(false)}
              className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white">✕</button>
          </div>
          <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-5">

            {/* Spell stats */}
            <div className="flex flex-col gap-2">
              <p className="text-xs uppercase tracking-widest text-white/40 font-semibold">Spell Stats</p>
              <div className="grid grid-cols-3 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-white/40">Ability</span>
                  <select value={data.spellcastingAbility ?? ""} disabled={readOnly}
                    onChange={e => update({ spellcastingAbility: e.target.value })}
                    className="bg-white/10 rounded-lg px-2 py-2 text-white outline-none text-sm disabled:opacity-50">
                    <option value="">—</option>
                    {["STR","DEX","CON","INT","WIS","CHA"].map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-white/40">Save DC</span>
                  <input type="number" value={data.spellSaveDC ?? ""} disabled={readOnly}
                    onFocus={e => e.target.select()} placeholder="0"
                    onChange={e => update({ spellSaveDC: parseInt(e.target.value) || 0 })}
                    className="bg-white/10 rounded-lg px-2 py-2 text-center text-white outline-none text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none disabled:opacity-50" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-white/40">Atk Bonus</span>
                  <input type="number" value={data.spellAttackBonus ?? ""} disabled={readOnly}
                    onFocus={e => e.target.select()} placeholder="0"
                    onChange={e => update({ spellAttackBonus: parseInt(e.target.value) || 0 })}
                    className="bg-white/10 rounded-lg px-2 py-2 text-center text-white outline-none text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none disabled:opacity-50" />
                </label>
              </div>
            </div>

            {/* Counts */}
            <div className="flex flex-col gap-2">
              <p className="text-xs uppercase tracking-widest text-white/40 font-semibold">Known / Prepared</p>
              <div className="grid grid-cols-3 gap-3">
                {([["Cantrips", "cantripsKnown"], ["Known", "spellsKnown"], ["Prepared", "spellsPrepared"]] as const).map(([label, key]) => (
                  <label key={key} className="flex flex-col gap-1">
                    <span className="text-xs text-white/40">{label}</span>
                    <input type="number" value={(data[key] as number | undefined) ?? ""} disabled={readOnly}
                      onFocus={e => e.target.select()} placeholder="0" min={0}
                      onChange={e => update({ [key]: parseInt(e.target.value) || 0 })}
                      className="bg-white/10 rounded-lg px-2 py-2 text-center text-white outline-none text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none disabled:opacity-50" />
                  </label>
                ))}
              </div>
            </div>

            {/* Spell slots */}
            <div className="flex flex-col gap-2">
              <p className="text-xs uppercase tracking-widest text-white/40 font-semibold">Spell Slots</p>
              <div className="flex flex-col gap-2">
                {spellSlots.map(slot => {
                  const rem = slot.total - slot.used
                  return (
                    <div key={slot.level} className="flex items-center gap-2">
                      <span className="text-xs text-white/50 w-8 shrink-0">Lv {slot.level}</span>
                      <TracingSlider
                        value={rem}
                        max={slot.total}
                        disabled={readOnly}
                        showButtons
                        buttonSize="sm"
                        onChange={val => changeSlot(slot.level, { used: slot.total - val })}
                      />
                      <span className="text-xs text-white/30 w-8 text-right tabular-nums shrink-0">{rem}/{slot.total}</span>
                      {!readOnly && (
                        <button type="button" onClick={() => removeSlot(slot.level)}
                          className="text-white/20 hover:text-red-400 text-xs transition-colors shrink-0">✕</button>
                      )}
                    </div>
                  )
                })}
                {!readOnly && availLevels.length > 0 && (
                  <div className="border-t border-white/10 pt-3 mt-1 flex flex-col gap-2">
                    <p className="text-xs text-white/40">Add slot level</p>
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <label className="flex items-center gap-1.5 text-white/50">Level
                        <select value={newSlotLevel} onChange={e => setNewSlotLevel(parseInt(e.target.value))}
                          className="bg-white/10 rounded-lg px-2 py-1 text-white outline-none">
                          {availLevels.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </label>
                      <label className="flex items-center gap-1.5 text-white/50">Slots
                        <input type="number" value={newSlotTotal} min={1}
                          onChange={e => setNewSlotTotal(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-12 bg-white/10 rounded-lg px-2 py-1 text-center text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                      </label>
                      <label className="flex items-center gap-1.5 text-white/50">Resets
                        <select value={newSlotRests} onChange={e => setNewSlotRests(e.target.value as "short" | "long")}
                          className="bg-white/10 rounded-lg px-2 py-1 text-white outline-none">
                          <option value="long">Long</option>
                          <option value="short">Short</option>
                        </select>
                      </label>
                      <button type="button" onClick={addSlot}
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

  // ══════════════════════════════════════════════════════════════════════════
  // MODAL: Skill Proficiency
  // ══════════════════════════════════════════════════════════════════════════

  function renderSkillModal() {
    const skillName = showSkillModal
    if (!skillName) return null
    const skill     = SKILLS.find(s => s.name === skillName)
    if (!skill) return null
    const profLevel = data.skillProfs?.[skillName] ?? "none"
    const bonus     = data.skillBonuses?.[skillName] ?? 0
    const mod       = getSkillMod(skillName, skill.ability)
    const pb        = profBonus(data.level ?? 1)
    return (
      <Modal onClose={() => setShowSkillModal(null)}>
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
                  const active = profLevel === level || (level === "none" && profLevel === "none")
                  return (
                    <button key={level} type="button" disabled={readOnly}
                      onClick={() => {
                        const next = level === "none" ? undefined : level
                        const updated = { ...data.skillProfs }
                        if (next) updated[skillName] = next
                        else delete updated[skillName]
                        update({ skillProfs: updated as CharacterData["skillProfs"] })
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
                <input type="number" value={bonus || ""} placeholder="0"
                  onFocus={e => e.target.select()}
                  onChange={e => update({ skillBonuses: { ...data.skillBonuses, [skillName]: parseInt(e.target.value) || 0 } })}
                  className="w-full text-center bg-white/10 rounded-xl px-3 py-2 text-white outline-none text-lg font-bold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
              </div>
            )}
          </div>
          <div className="px-5 pb-5">
            <button type="button" onClick={() => setShowSkillModal(null)}
              className="w-full py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-sm text-white font-semibold transition-colors">
              Done
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MODAL: Ability Scores
  // ══════════════════════════════════════════════════════════════════════════

  function renderAbilityModal() {
    if (!showAbilityModal) return null
    return (
      <Modal onClose={() => setShowAbilityModal(false)}>
        <div className="bg-zinc-900 border border-white/20 rounded-2xl shadow-2xl  flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10">
            <p className="text-base font-bold text-white">Ability Scores</p>
          </div>
          <div className="px-5 py-4 flex flex-col gap-3">
            {ABILITY_KEYS.map(key => {
              const stored  = (data[key as keyof CharacterData] as number | undefined) ?? 10
              const display = abilityInputs[key] !== undefined ? abilityInputs[key] : String(stored)
              const mod     = abilityMod(stored)
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-sm text-white/60 uppercase tracking-wider w-10 shrink-0">{ABILITY_ABBR[key]}</span>
                  <input type="number" value={display}
                    onFocus={e => e.target.select()}
                    onChange={e => setAbilityInputs(prev => ({ ...prev, [key]: e.target.value }))}
                    onBlur={e => {
                      const v = e.target.value.trim()
                      update({ [key]: v === "" ? 0 : Math.max(1, Math.min(1000, parseInt(v) || 0)) })
                      setAbilityInputs(prev => { const n = { ...prev }; delete n[key]; return n })
                    }}
                    className="flex-1 text-center bg-white/10 rounded-xl px-3 py-2.5 text-lg font-bold text-white outline-none focus:ring-2 focus:ring-white/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <span className={`text-sm font-mono font-bold w-10 text-right ${mod.startsWith("-") ? "text-red-400" : "text-green-400"}`}>{mod}</span>
                </div>
              )
            })}
          </div>
          <div className="px-5 pb-5">
            <button type="button" onClick={() => setShowAbilityModal(false)}
              className="w-full py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-sm text-white font-semibold transition-colors">
              Done
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MODAL: Condition Picker
  // ══════════════════════════════════════════════════════════════════════════

  function renderConditionModal() {
    if (!showConditionPicker) return null
    return (
      <Modal onClose={() => setShowConditionPicker(false)}>
        <div className="bg-zinc-900 border border-white/20 rounded-2xl shadow-2xl w-64 flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10">
            <p className="text-base font-bold text-white">Add Condition</p>
          </div>
          <div className="p-3 grid grid-cols-2 gap-1">
            {ALL_CONDITIONS.map(name => (
              <button key={name} type="button" onClick={() => addCondition(name)}
                className={`text-sm px-3 py-2.5 rounded-xl text-left font-medium transition-colors ${conditions.find(c => c.name === name) ? "text-white/25 cursor-default" : "text-white/80 hover:bg-white/10 hover:text-white"}`}>
                {name}
              </button>
            ))}
          </div>
        </div>
      </Modal>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MODAL: Theme Picker
  // ══════════════════════════════════════════════════════════════════════════

  function renderThemeModal() {
    if (!showThemePicker) return null
    return (
      <Modal onClose={() => setShowThemePicker(false)}>
        <div className="bg-zinc-900 border border-white/20 rounded-2xl shadow-2xl w-52 flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10">
            <p className="text-base font-bold text-white">Choose Theme</p>
          </div>
          <div className="p-2 flex flex-col gap-0.5">
            {Object.entries(THEMES).map(([key, t]) => (
              <button key={key} type="button"
                onClick={() => { update({ theme: key }); setShowThemePicker(false) }}
                className={`text-sm px-3 py-2.5 rounded-xl text-left font-semibold transition-colors ${(data.theme === key || (!data.theme && key === DEFAULT_THEME)) ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </Modal>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MODAL: Portrait Picker
  // ══════════════════════════════════════════════════════════════════════════

  function renderPortraitModal() {
    if (!showPortraitPicker) return null
    return (
      <Modal onClose={() => setShowPortraitPicker(false)}>
        <div className="bg-zinc-900 border border-white/20 rounded-2xl shadow-2xl w-72 max-h-[80vh] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
            <span className="text-base font-bold text-white">Choose Portrait</span>
            <button type="button" onClick={() => setShowPortraitPicker(false)}
              className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/50 hover:text-white">✕</button>
          </div>
          <div className="p-4 flex flex-col gap-3 overflow-hidden flex-1 min-h-0">
            <button type="button" onClick={() => portraitRef.current?.click()}
              className="text-sm border border-dashed border-white/20 hover:border-white/40 rounded-xl py-3 text-white/50 hover:text-white transition-colors shrink-0">
              + Upload new image
            </button>
            <div className="overflow-y-auto flex-1 min-h-0">
              {galleryLoading
                ? <p className="text-sm text-white/40 text-center py-6">Loading…</p>
                : galleryImages.length === 0
                ? <p className="text-sm text-white/40 italic text-center py-6">No images yet.</p>
                : (
                  <div className="grid grid-cols-3 gap-2">
                    {galleryImages.map(img => (
                      <button key={img.name} type="button"
                        onClick={() => { update({ portrait: img.publicUrl }); setShowPortraitPicker(false) }}
                        className={`aspect-square rounded-xl overflow-hidden border-2 transition-colors ${data.portrait === img.publicUrl ? "border-primary" : "border-transparent hover:border-white/40"}`}>
                        <img src={img.publicUrl} alt={img.name} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
            </div>
          </div>
        </div>
      </Modal>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: HP PANEL
  // ══════════════════════════════════════════════════════════════════════════

  function renderHpPanel() {
    return (
      <div className="flex flex-col gap-3">

        {/* HP + AC ring card */}
        <div className={`${card} p-4 flex flex-col items-center gap-3`}>

          {!readOnly && (
            <button type="button" onClick={() => setShowMaxMenu(true)}
              className="self-end size-7 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-xs text-white transition-colors -mb-2"
              title="Edit Max HP / AC / Temp HP">✎</button>
          )}

          {/* SVG ring */}
          <div className="relative size-32">
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
            <div className="absolute inset-0 flex items-center justify-center">
              <Shield className="size-11 text-white/60" />
              <span className="absolute text-base font-bold text-white leading-none">{data.ac ?? 0}</span>
            </div>
          </div>

          {/* HP value */}
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-white leading-none">{hp}</span>
            {tempHp > 0 && <span className="text-base font-bold text-blue-400 leading-none">+{tempHp}</span>}
            <span className="text-sm text-white/40">/ {maxHp}</span>
          </div>

          {/* HP controls — hidden in readOnly */}
          {!readOnly && (
            <div className="flex flex-col items-center gap-2 w-full">
              <div className={`flex rounded-full text-xs font-semibold uppercase tracking-wide overflow-hidden ring-1 ${theme.ring}`}>
                <button type="button" onClick={() => setHpTarget("hp")}
                  className={`px-3 py-1.5 transition-colors ${hpTarget === "hp" ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70"}`}>HP</button>
                <button type="button" onClick={() => setHpTarget("temp")}
                  className={`px-3 py-1.5 transition-colors ${hpTarget === "temp" ? "bg-blue-500/40 text-blue-200" : "text-white/40 hover:text-white/70"}`}>Temp</button>
              </div>
              <div className="flex items-center gap-2">
                <button type="button"
                  onClick={() => hpTarget === "hp" ? update({ hp: Math.max(0, hp - hpStep) }) : update({ tempHp: Math.max(0, tempHp - hpStep) })}
                  className="size-9 rounded-full bg-white/10 hover:bg-red-900 text-white hover:text-red-200 flex items-center justify-center text-xl font-bold transition-colors">−</button>
                <input type="number" value={hpStep}
                  onFocus={e => e.target.select()}
                  onChange={e => setHpStep(Math.max(1, parseInt(e.target.value) || 1))} min={1}
                  className={`w-12 text-center text-sm font-bold ${theme.box} border border-white/15 rounded-lg py-1.5 text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`} />
                <button type="button"
                  onClick={() => hpTarget === "hp" ? update({ hp: maxHp > 0 ? Math.min(maxHp, hp + hpStep) : hp + hpStep }) : update({ tempHp: tempHp + hpStep })}
                  className="size-9 rounded-full bg-white/10 hover:bg-green-900 text-white hover:text-green-200 flex items-center justify-center text-xl font-bold transition-colors">+</button>
              </div>
            </div>
          )}
        </div>

        {/* Speed / Initiative */}
        <div className="grid grid-cols-2 gap-2">
          {(["speed", "initiative"] as const).map(k => (
            <div key={k} className={`${card} p-3 flex flex-col items-center gap-1`}>
              {readOnly
                ? <span className="text-xl font-bold text-white">{(data[k] as number | undefined) ?? 0}</span>
                : <input type="number" value={(data[k] as number | undefined) ?? ""}
                    onFocus={e => e.target.select()}
                    onChange={e => update({ [k]: parseInt(e.target.value) || 0 })} placeholder="0"
                    className="w-full text-center text-xl font-bold bg-transparent outline-none text-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
              }
              <span className="text-xs uppercase tracking-widest text-white/50">{k === "speed" ? "Speed" : "Initiative"}</span>
            </div>
          ))}
        </div>

        {/* Hit Dice */}
        {renderHitDice()}
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
    function removePool(id: string) { update({ hitDicePools: pools.filter(pl => pl.id !== id) }) }
    function commitAddPool() {
      update({ hitDicePools: [...pools, { id: nanoid(), dieType: newPoolDie, total: newPoolCount, used: 0 }] })
      setShowAddPool(false); setNewPoolDie("d8"); setNewPoolCount(1)
    }

    return (
      <div className={`${card} p-3 flex flex-col gap-2`}>
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-widest text-white/50 font-semibold">Hit Dice</span>
          {!readOnly && (
            <button type="button"
              onClick={() => { setEditingPools(v => !v); setShowAddPool(false); setNewPoolDie("d8"); setNewPoolCount(1) }}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors ${editingPools ? "bg-yellow-500/20 text-yellow-300" : "bg-white/10 hover:bg-white/20 text-white/50 hover:text-white"}`}>
              {editingPools ? "Done" : "✎ Edit"}
            </button>
          )}
        </div>

        {/* View mode */}
        {!editingPools && (
          <>
            {pools.length === 0 && (
              <p className="text-xs text-white/30 italic text-center py-2">
                {readOnly ? "None" : "No hit dice — click ✎ Edit to add"}
              </p>
            )}
            {pools.map(pool => {
              const rem = Math.max(0, pool.total - pool.used)
              return (
                <div key={pool.id} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white/70 w-8">{pool.dieType}</span>
                  <div className="flex flex-wrap gap-1 flex-1">
                    {Array.from({ length: pool.total }).map((_, i) => {
                      const avail = i < rem
                      return (
                        <button key={i} type="button" disabled={readOnly}
                          title={avail ? "Click to use" : "Click to recover"}
                          onClick={() => updatePool(pool.id, { used: avail ? pool.used + 1 : Math.max(0, pool.used - 1) })}
                          className={`size-5 rounded text-xs font-bold border transition-colors disabled:cursor-default disabled:hover:bg-transparent ${
                            avail ? "bg-white/15 border-white/20 text-white hover:bg-red-900/60 hover:border-red-400/40"
                                  : "bg-transparent border-white/10 text-white/20 hover:bg-green-900/40 hover:border-green-400/30"
                          }`}>◆</button>
                      )
                    })}
                  </div>
                  <span className="text-xs text-white/30">{rem}/{pool.total}</span>
                </div>
              )
            })}
          </>
        )}

        {/* Edit mode */}
        {editingPools && !readOnly && (
          <div className="flex flex-col gap-2">
            {pools.map(pool => (
              <div key={pool.id} className="flex items-center gap-2">
                <select value={pool.dieType} onChange={e => updatePool(pool.id, { dieType: e.target.value })}
                  className="bg-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-16">
                  {["d4","d6","d8","d10","d12"].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <div className="flex items-center gap-1.5 flex-1">
                  <button type="button" onClick={() => updatePool(pool.id, { total: Math.max(1, pool.total - 1), used: Math.min(pool.used, pool.total - 1) })}
                    className="size-6 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm flex items-center justify-center">−</button>
                  <span className="text-sm text-white w-6 text-center">{pool.total}</span>
                  <button type="button" onClick={() => updatePool(pool.id, { total: pool.total + 1 })}
                    className="size-6 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm flex items-center justify-center">+</button>
                </div>
                <button type="button" onClick={() => removePool(pool.id)}
                  className="size-7 flex items-center justify-center rounded-lg text-white/30 hover:text-red-400 hover:bg-red-900/30 text-sm transition-colors">✕</button>
              </div>
            ))}
            {!showAddPool ? (
              <button type="button" onClick={() => setShowAddPool(true)}
                className="text-sm border border-dashed border-white/15 hover:border-white/30 rounded-xl py-2 text-white/40 hover:text-white transition-colors">
                + Add pool
              </button>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2">
                <select value={newPoolDie} onChange={e => setNewPoolDie(e.target.value)}
                  className="bg-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-16">
                  {["d4","d6","d8","d10","d12"].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <div className="flex items-center gap-1.5 flex-1">
                  <button type="button" onClick={() => setNewPoolCount(c => Math.max(1, c - 1))}
                    className="size-6 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm flex items-center justify-center">−</button>
                  <span className="text-sm text-white w-6 text-center">{newPoolCount}</span>
                  <button type="button" onClick={() => setNewPoolCount(c => c + 1)}
                    className="size-6 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm flex items-center justify-center">+</button>
                </div>
                <button type="button" onClick={commitAddPool}
                  className="text-xs px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors">Add</button>
                <button type="button" onClick={() => setShowAddPool(false)}
                  className="size-7 flex items-center justify-center rounded-lg text-white/30 hover:text-white text-sm transition-colors">✕</button>
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
        <div className={`${card} px-3 py-2 flex items-center gap-2`}>
          <span className="text-white/40 text-sm">⌕</span>
          <input
            value={quickSearch}
            onChange={e => setQuickSearch(e.target.value)}
            placeholder="Quick search…"
            className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-white/30"
          />
          {quickSearch && (
            <button type="button" onClick={() => setQuickSearch("")} className="absolute right-3 text-white/40 hover:text-white text-sm">✕</button>
          )}
        </div>

        {searchResults.length > 0 && (
          <div className={`absolute top-full left-0 right-0 z-40 mt-1 ${theme.box} border border-white/15 rounded-xl shadow-xl overflow-hidden max-h-56 overflow-y-auto`}>
            {searchResults.map(r => (
              <div key={r.id} className="flex items-center gap-2 px-3 py-2.5 hover:bg-white/10 border-b border-white/5 last:border-0">
                <span className="text-xs text-white/40 uppercase tracking-wider w-12 shrink-0">{r.category}</span>
                <span className="text-sm text-white flex-1 truncate">{r.label}</span>
                <button type="button"
                  onClick={() => addFavorite({ refId: r.id, refType: r.refType, label: r.label })}
                  className={`text-base shrink-0 transition-colors ${favorites.find(f => f.refId === r.id) ? "text-yellow-400" : "text-white/20 hover:text-yellow-400"}`}
                  title="Add to favorites">★</button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: SAVING THROWS CARD
  // ══════════════════════════════════════════════════════════════════════════

  function renderSavesCard() {
    return (
      <div className={`${card} p-3 flex flex-col gap-2`}>
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-widest text-white/50 font-semibold">Saving Throws</span>
          {!readOnly && (
            <button type="button" onClick={() => setShowSavesModal(true)}
              className="size-6 flex items-center justify-center rounded-md hover:bg-white/10 text-white/30 hover:text-white text-xs transition-colors">✎</button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {SAVE_KEYS.map(save => {
            const mod  = getSaveMod(save)
            const prof = data.savingThrowProfs?.[save] ?? false
            return (
              <div key={save} className="flex items-center gap-2">
                <span className={`size-2 rounded-full shrink-0 ${prof ? "bg-primary" : "bg-white/15"}`} />
                <span className="text-xs text-white/50 uppercase tracking-wider w-8">{ABILITY_ABBR[SAVE_TO_ABILITY[save]]}</span>
                <span className={`text-sm font-mono font-bold ${mod >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {mod >= 0 ? `+${mod}` : `${mod}`}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: ABILITY SCORES CARD
  // ══════════════════════════════════════════════════════════════════════════

  function renderAbilitiesCard() {
    return (
      <div className={`${card} p-3 flex flex-col gap-2`}>
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-widest text-white/50 font-semibold">Abilities</span>
          {!readOnly && (
            <button type="button" onClick={() => setShowAbilityModal(true)}
              className="size-6 flex items-center justify-center rounded-md hover:bg-white/10 text-white/30 hover:text-white text-xs transition-colors">✎</button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {ABILITY_KEYS.map(key => {
            const score = (data[key as keyof CharacterData] as number | undefined) ?? 10
            const mod   = abilityMod(score)
            return (
              <div key={key} className="flex items-center gap-2">
                <span className="text-xs text-white/50 uppercase tracking-wider w-8">{ABILITY_ABBR[key]}</span>
                <span className="text-base font-bold text-white w-7 tabular-nums">{score}</span>
                <span className={`text-xs font-mono ${mod.startsWith("-") ? "text-red-400" : "text-green-400"}`}>{mod}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: CONDITIONS CARD
  // ══════════════════════════════════════════════════════════════════════════

  function renderConditionsCard() {
    return (
      <div className={`${card} p-3 flex flex-col gap-2`}>
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-widest text-white/50 font-semibold">Conditions</span>
          {!readOnly && (
            <button type="button" onClick={() => setShowConditionPicker(true)}
              className="text-xs px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white/50 hover:text-white transition-colors">+ Add</button>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {conditions.length === 0 && <span className="text-xs text-white/25 italic">None</span>}
          {conditions.map(cond => (
            <span key={cond.id}
              className={`flex items-center gap-1 text-xs border rounded-full px-2.5 py-0.5 ${CONDITION_COLOR[cond.name] ?? "bg-white/10 text-white/70 border-white/20"}`}>
              {cond.name}
              {cond.name === "Exhaustion" && (
                <span className="flex items-center gap-0.5 ml-1">
                  {!readOnly && <button type="button" onClick={() => updateCondition(cond.id, { level: Math.max(1, (cond.level ?? 1) - 1) })} className="opacity-60 hover:opacity-100">−</button>}
                  <span className="font-bold">{cond.level ?? 1}</span>
                  {!readOnly && <button type="button" onClick={() => updateCondition(cond.id, { level: Math.min(6, (cond.level ?? 1) + 1) })} className="opacity-60 hover:opacity-100">+</button>}
                </span>
              )}
              {!readOnly && (
                <button type="button" onClick={() => removeCondition(cond.id)} className="opacity-50 hover:opacity-100 ml-0.5 text-xs">✕</button>
              )}
            </span>
          ))}
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: SPELLS / EQUIPMENT PANEL (tab toggle)
  // ══════════════════════════════════════════════════════════════════════════

  function renderSpellsEquipPanel() {
    const preparedCount = spellItems.filter(s => s.prepared || s.alwaysPrepared).length
    return (
      <div className={`${card} p-4 flex flex-col gap-3`}>

        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap shrink-0">
          {/* Tab toggle */}
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

          {/* Spell stats — all four as uniform stat columns */}
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
              <button type="button" onClick={() => setShowSpellcastingModal(true)}
                className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/30 hover:text-white transition-colors ml-auto shrink-0"
                title="Configure spellcasting">⚙</button>
            </div>
          )}
        </div>

        {/* Spell slots (compact, no add form — use ⚙ modal) */}
        {showSpells && spellSlots.length > 0 && (
          <div className="flex flex-col gap-2 border-b border-white/10 pb-3 shrink-0">
            {spellSlots.map(slot => {
              const rem = slot.total - slot.used
              return (
                <div key={slot.level} className="flex items-center gap-2">
                  <span className="text-xs text-white/50 w-8 shrink-0">Lv {slot.level}</span>
                  <TracingSlider
                    value={rem}
                    max={slot.total}
                    disabled={readOnly}
                    showButtons
                    buttonSize="sm"
                    onChange={val => changeSlot(slot.level, { used: slot.total - val })}
                  />
                  <span className="text-xs text-white/30 w-8 text-right tabular-nums shrink-0">{rem}/{slot.total}</span>
                </div>
              )
            })}
            {!readOnly && (
              <button type="button" onClick={() => setShowSpellcastingModal(true)}
                className="text-xs text-white/30 hover:text-white/60 transition-colors text-left">+ Add slot</button>
            )}
          </div>
        )}
        {showSpells && spellSlots.length === 0 && !readOnly && (
          <button type="button" onClick={() => setShowSpellcastingModal(true)}
            className="text-xs text-white/30 hover:text-white/60 transition-colors text-left shrink-0">+ Add spell slots</button>
        )}

        {/* Spell / martial list */}
        <div className="flex flex-col gap-1.5">
          {showSpells ? (
            <>
              {spellItems.map(spell => (
                <SpellEntry key={spell.id} spell={spell} theme={theme} readOnly={readOnly}
                  onChange={p => changeSpell(spell.id, p)} onRemove={() => removeSpell(spell.id)} />
              ))}
              {!readOnly && (
                <button type="button" onClick={addSpell}
                  className="text-sm text-white/40 hover:text-white border border-dashed border-white/15 hover:border-white/30 rounded-xl py-2.5 transition-colors shrink-0">
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

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: SKILLS CARD
  // ══════════════════════════════════════════════════════════════════════════

  function renderSkillsCard() {
    return (
      <div className={`${card} p-3 flex flex-col gap-2`}>
        <span className="text-xs uppercase tracking-widest text-white/50 font-semibold">Skills</span>
        <div className="flex flex-col gap-0.5">
          {SKILLS.map(skill => {
            const profLevel = data.skillProfs?.[skill.name]
            const mod       = getSkillMod(skill.name, skill.ability)
            const dotClass  =
              profLevel === "exp"  ? "bg-yellow-400 border-yellow-400" :
              profLevel === "prof" ? "bg-primary border-primary" :
              profLevel === "half" ? "bg-primary/40 border-primary/60" :
                                     "border-white/25 bg-transparent"
            return (
              <button key={skill.name} type="button"
                onClick={() => setShowSkillModal(skill.name)}
                className="flex items-center gap-2 py-1 px-1 rounded-lg hover:bg-white/5 transition-colors w-full text-left">
                <span className={`size-3 rounded-full border-2 shrink-0 transition-colors ${dotClass}`} />
                <span className="text-xs text-white/60 flex-1 truncate leading-tight">{skill.name}</span>
                <span className="text-[10px] text-white/30 w-6 text-right uppercase shrink-0">{skill.ability}</span>
                <span className={`text-xs font-mono font-semibold w-7 text-right shrink-0 ${mod >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {mod >= 0 ? `+${mod}` : `${mod}`}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }


  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: COMBAT TAB
  // ══════════════════════════════════════════════════════════════════════════

  function renderCombatTab() {
    return (
      <div className="flex flex-col gap-4 flex-1 min-h-0">
        <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">

          {/* Col 1: HP / speed / hit dice / conditions */}
          <div className="lg:w-52 shrink-0 flex flex-col gap-3">
            {renderHpPanel()}
            {renderConditionsCard()}
          </div>

          {/* Col 2: Abilities → Saves → Skills */}
          <div className="lg:w-56 shrink-0 flex flex-col gap-3 overflow-y-auto">
            {renderAbilitiesCard()}
            {renderSavesCard()}
            {renderSkillsCard()}
          </div>

          {/* Col 3: Favorites */}
          <div className="flex-1 flex flex-col gap-3 min-h-0 min-w-0">
            {!favFloat && <FavoritesPanel {...favPanelProps} />}
          </div>
        </div>

        {/* Full-width spells / martial panel at the bottom */}
        {renderSpellsEquipPanel()}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="flex flex-col h-full min-h-0 text-white rounded-xl overflow-hidden">

      {/* Modals */}
      {renderMaxStatsModal()}
      {renderSavesModal()}
      {renderAbilityModal()}
      {renderSpellcastingModal()}
      {renderSkillModal()}
      {renderConditionModal()}
      {renderThemeModal()}
      {renderPortraitModal()}
      <input ref={portraitRef} type="file" accept="image/*" className="hidden" onChange={uploadPortrait} />

      {/* Floating favorites panel */}
      {favFloat && <FavoritesPanel {...{ ...favPanelProps, isFloat: true }} />}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className={`flex items-center gap-3 px-4 py-3 border-b border-white/10 shrink-0 ${theme.header}`}>

        <button type="button"
          onClick={readOnly ? undefined : openPortraitPicker}
          className={`relative size-11 rounded-full overflow-hidden ring-2 ${theme.ring} ${readOnly ? "" : "hover:ring-primary cursor-pointer"} shrink-0 ${theme.box} flex items-center justify-center transition-all`}>
          {uploading ? <span className="text-xs text-white/70">…</span>
            : data.portrait ? <img src={data.portrait} alt="portrait" className="w-full h-full object-cover" />
            : <span className="text-2xl leading-none select-none">IMAGE</span>}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-base font-bold tracking-wide truncate">{character.name}</p>
            {readOnly && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/40 uppercase tracking-widest shrink-0">
                View Only
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-white/50 uppercase tracking-wide">
            <input value={data.race ?? ""} onChange={e => update({ race: e.target.value })} placeholder="Race"
              className="bg-transparent outline-none w-16 placeholder:text-white/20 shrink-0" disabled={readOnly} />
            <span className="text-white/20 shrink-0">/</span>
            <input value={data.class ?? ""} onChange={e => update({ class: e.target.value })} placeholder="Class / Multiclass"
              className="bg-transparent outline-none min-w-0 flex-1 placeholder:text-white/20" disabled={readOnly} />
            <span className="text-white/20">·</span>
            <span>Lv</span>
            <input type="number" value={data.level ?? ""} min={1} max={20}
              onChange={e => update({ level: Math.min(20, Math.max(1, parseInt(e.target.value) || 1)) })}
              placeholder="1" disabled={readOnly}
              className="bg-transparent outline-none w-6 placeholder:text-white/20 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
          </div>
        </div>

        {saving && <span className="text-xs text-white/40 shrink-0">saving…</span>}

        {!readOnly && (
          <button type="button"
            onClick={() => setShowThemePicker(true)}
            className="text-xs px-2.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/50 hover:text-white shrink-0 transition-colors">
            Theme
          </button>
        )}

      
      </div>

      {/* ── Tab bar ────────────────────────────────────────────────────────── */}
      <div className={`flex items-center gap-1 px-4 py-2 border-b border-white/10 shrink-0 ${theme.header}`}>
        {(["main", "details"] as Tab[]).map(tab => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-xs uppercase tracking-widest rounded-full font-semibold transition-colors ${activeTab === tab ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70 hover:bg-white/5"}`}>
            {tab === "main" ? "Main" : "Details"}
          </button>
        ))}
        <div className="ml-auto">{renderQuickSearch()}</div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className={`flex flex-col flex-1 min-h-0 overflow-auto p-4 ${theme.body}`}>
        {activeTab === "main" && renderCombatTab()}
        {activeTab === "details" && (
          <InfoTab data={data} update={update} theme={theme} card={card} readOnly={readOnly} />
        )}
      </div>
    </div>
  )
}
