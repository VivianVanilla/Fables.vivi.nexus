import React, { useState, useRef } from "react"
import type { SidebarObject } from "@/components/sidebar-utils"
import { useUserContext } from "../../src/contexts/UserContext"
import { supabase } from "../../src/supabase"

import type { CharacterData, EquipmentItem, SpellItem, HitDicePool } from "./character-types"
import { ABILITY_KEYS, ABILITY_ABBR, SAVE_KEYS, SAVE_TO_ABILITY, SUPABASE_BUCKET } from "./character-constants"
import { abilityMod, profBonus, nanoid, safeParseJson } from "./character-utils"
import { THEMES, DEFAULT_THEME } from "./character-themes"
import type { Theme } from "./character-themes"
import { Shield } from "lucide-react"

// ─── Sub-components ────────────────────────────────────────────────────────────

function SpellEntry({
  spell,
  onChange,
  onRemove,
  theme,
}: {
  spell: SpellItem
  onChange: (patch: Partial<SpellItem>) => void
  onRemove: () => void
  theme: Theme
}) {
  return (
    <div className={`rounded-lg ${theme.box} border border-white/10 p-2 flex flex-col gap-1.5`}>
      {/* Name row */}
      <div className="flex items-center gap-1.5">
        <input
          value={spell.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Spell name"
          className={`flex-1 bg-transparent outline-none text-xs font-semibold ${theme.color} placeholder:text-white/40`}
        />
        <button type="button" onClick={onRemove} className="size-4 flex items-center justify-center text-white/40 hover:text-red-400 text-[10px]">
          ✕
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
        <label className="flex items-center gap-1">
          <span className="text-white/50 shrink-0">Lvl</span>
          <input
            type="number"
            value={spell.level ?? ""}
            onChange={(e) => onChange({ level: parseInt(e.target.value) || 0 })}
            placeholder="0"
            className="w-8 bg-white/10 rounded px-1 text-center text-white outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </label>
        <label className="flex items-center gap-1">
          <span className="text-white/50 shrink-0">Atk</span>
          <input value={spell.toHit ?? ""} onChange={(e) => onChange({ toHit: e.target.value })} placeholder="+5" className="w-10 bg-white/10 rounded px-1 text-center text-white outline-none" />
        </label>
        <label className="flex items-center gap-1">
          <span className="text-white/50 shrink-0">Save</span>
          <input value={spell.saveType ?? ""} onChange={(e) => onChange({ saveType: e.target.value })} placeholder="CON" className="w-10 bg-white/10 rounded px-1 text-center text-white outline-none" />
        </label>
        <label className="flex items-center gap-1">
          <span className="text-white/50 shrink-0">Rng</span>
          <input value={spell.range ?? ""} onChange={(e) => onChange({ range: e.target.value })} placeholder="60ft" className="w-12 bg-white/10 rounded px-1 text-white outline-none" />
        </label>
      </div>

      {/* Description */}
      <input
        value={spell.notes ?? ""}
        onChange={(e) => onChange({ notes: e.target.value })}
        placeholder="Description"
        className="bg-transparent outline-none text-[10px] text-white/50 placeholder:text-white/20 border-t border-white/10 pt-1"
      />
    </div>
  )
}

function EquipmentEntry({
  item,
  onChange,
  onRemove,
  theme,
}: {
  item: EquipmentItem
  onChange: (patch: Partial<EquipmentItem>) => void
  onRemove: () => void
  theme: Theme
}) {
  return (
    <div className={`rounded-lg ${theme.box} border border-white/10 p-2 flex flex-col gap-1.5`}>
      {/* Name row */}
      <div className="flex items-center gap-1.5">
        <input
          value={item.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Item name"
          className={`flex-1 bg-transparent outline-none text-xs font-semibold ${theme.color} placeholder:text-white/40`}
        />
        <button type="button" onClick={onRemove} className="size-4 flex items-center justify-center text-white/40 hover:text-red-400 text-[10px]">
          ✕
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
        <label className="flex items-center gap-1">
          <span className="text-white/50 shrink-0">Type</span>
          <select
            value={item.type ?? "melee"}
            onChange={(e) => onChange({ type: e.target.value })}
            className="flex-1 bg-white/10 rounded px-1 py-0.5 text-white outline-none text-[10px]"
          >
            <option value="melee">Melee</option>
            <option value="ranged">Ranged</option>
            <option value="armor">Armor</option>
            <option value="misc">Misc</option>
          </select>
        </label>
        <label className="flex items-center gap-1">
          <span className="text-white/50 shrink-0">+Hit</span>
          <input value={item.toHit ?? ""} onChange={(e) => onChange({ toHit: e.target.value })} placeholder="+5" className="w-10 bg-white/10 rounded px-1 text-center text-white outline-none" />
        </label>
        <label className="flex items-center gap-1">
          <span className="text-white/50 shrink-0">Dmg</span>
          <input value={item.damage ?? ""} onChange={(e) => onChange({ damage: e.target.value })} placeholder="1d8" className="w-12 bg-white/10 rounded px-1 text-center text-white outline-none" />
        </label>
        <label className="flex items-center gap-1">
          <span className="text-white/50 shrink-0">Dmg Type</span>
          <input value={item.damageType ?? ""} onChange={(e) => onChange({ damageType: e.target.value })} placeholder="slsh" className="w-10 bg-white/10 rounded px-1 text-center text-white outline-none" />
        </label>
      </div>

      {/* Notes */}
      <input
        value={item.notes ?? ""}
        onChange={(e) => onChange({ notes: e.target.value })}
        placeholder="Notes…"
        className="bg-transparent outline-none text-[10px] text-white/50 placeholder:text-white/20 border-t border-white/10 pt-1"
      />
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────────

interface Props {
  character: SidebarObject
  onClose: () => void
}

export function CharacterSheet({ character, onClose }: Props) {
  const { user, updateObject } = useUserContext()

  // UI-only state (not saved)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showMaxMenu, setShowMaxMenu] = useState(false)
  const [showThemePicker, setShowThemePicker] = useState(false)
  const [showSpells, setShowSpells] = useState(true)
  const [hpStep, setHpStep] = useState(1)
  const [hpTarget, setHpTarget] = useState<"hp" | "temp">("hp")
  const [showPortraitPicker, setShowPortraitPicker] = useState(false)
  const [galleryImages, setGalleryImages] = useState<{ name: string; publicUrl: string }[]>([])
  const [galleryLoading, setGalleryLoading] = useState(false)
  const [showAddPool, setShowAddPool] = useState(false)
  const [newPoolDie, setNewPoolDie] = useState("d8")
  const [newPoolCount, setNewPoolCount] = useState(1)

  const portraitRef = useRef<HTMLInputElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Character data (saved to DB)
  const [data, setData] = useState<CharacterData>(() => safeParseJson(character.data) as CharacterData)

  // ── Save logic ──────────────────────────────────────────────────────────────

  function scheduleSave(next: CharacterData) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      try {
        await updateObject(character.id, { data: next as unknown as JSON })
      } catch (e) {
        console.error(e)
      }
      setSaving(false)
    }, 700)
  }

  function update(patch: Partial<CharacterData>) {
    const next = { ...data, ...patch }
    setData(next)
    scheduleSave(next)
  }

  // ── Portrait upload & gallery ───────────────────────────────────────────────

  async function openPortraitPicker() {
    setShowPortraitPicker(true)
    if (!user?.id) return
    setGalleryLoading(true)
    const { data: files } = await supabase.storage.from(SUPABASE_BUCKET).list(`${user.id}`, { limit: 100 })
    if (files) {
      setGalleryImages(
        files
          .filter((f) => f.name !== ".emptyFolderPlaceholder")
          .map((f) => ({
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
    const ext = file.name.split(".").pop() ?? "png"
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

  // ── HP ring calculation ─────────────────────────────────────────────────────

  const hp = data.hp ?? 0
  const maxHp = data.maxHp ?? 0
  const tempHp = data.tempHp ?? 0
  const hpPercent = maxHp > 0 ? Math.min(100, (hp / maxHp) * 100) : 0
  const tempHpPercent = maxHp > 0 ? Math.min(100, (tempHp / maxHp) * 100) : 0
  const hpColor = hpPercent > 50 ? "#22c55e" : hpPercent > 25 ? "#eab308" : "#ef4444"

  // Main ring (inner)
  const RING_RADIUS = 32
  const ringCircumference = 2 * Math.PI * RING_RADIUS

  // Temp HP ring (outer, blue)
  const TEMP_RING_RADIUS = 43
  const tempRingCircumference = 2 * Math.PI * TEMP_RING_RADIUS

  // ── Equipment and spell list helpers ───────────────────────────────────────

  const equipItems = data.equipmentItems ?? []
  const spellItems = data.spellItems ?? []

  function addEquipItem() {
    update({ equipmentItems: [...equipItems, { id: nanoid(), name: "", toHit: "", damage: "", damageType: "", type: "melee", notes: "" }] })
  }
  function changeEquipItem(id: string, patch: Partial<EquipmentItem>) {
    update({ equipmentItems: equipItems.map(i => i.id === id ? { ...i, ...patch } : i) })
  }
  function removeEquipItem(id: string) {
    update({ equipmentItems: equipItems.filter(i => i.id !== id) })
  }

  function addSpellItem() {
    update({ spellItems: [...spellItems, { id: nanoid(), name: "", level: 0, toHit: "", saveType: "", range: "", notes: "" }] })
  }
  function changeSpellItem(id: string, patch: Partial<SpellItem>) {
    update({ spellItems: spellItems.map(i => i.id === id ? { ...i, ...patch } : i) })
  }
  function removeSpellItem(id: string) {
    update({ spellItems: spellItems.filter(i => i.id !== id) })
  }

  // ── Theme ──────────────────────────────────────────────────────────────────

  const theme = THEMES[data.theme ?? DEFAULT_THEME] ?? THEMES[DEFAULT_THEME]
  const card = `rounded-xl ${theme.box} ring-1 ${theme.ring}`

  // ── Saving throw row ───────────────────────────────────────────────────────

  function getSaveMod(save: typeof SAVE_KEYS[number]): number {
    const abilityScore = (data[SAVE_TO_ABILITY[save] as keyof CharacterData] as number | undefined) ?? 10
    const isProficient = data.savingThrowProfs?.[save] ?? false
    const baseMod = Math.floor((abilityScore - 10) / 2)
    return baseMod + (isProficient ? profBonus(data.level ?? 1) : 0)
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-0 text-white rounded-xl overflow-hidden">

      {/* ── Header bar ── */}
      <div className={`flex items-center gap-3 px-4 py-3 border-b border-white/10 shrink-0 ${theme.header}`}>

        {/* Portrait button */}
        <button
          type="button"
          onClick={openPortraitPicker}
          className={`relative size-10 rounded-full overflow-hidden ring-2 ${theme.ring} hover:ring-primary shrink-0 ${theme.box} flex items-center justify-center transition-all`}
          title="Choose portrait"
        >
          {uploading ? (
            <span className="text-[9px] text-white/70">…</span>
          ) : data.portrait ? (
            <img src={data.portrait} alt="portrait" className="w-full h-full object-cover" />
          ) : (
            <span className="text-xl leading-none select-none">🧙</span>
          )}
        </button>
        <input ref={portraitRef} type="file" accept="image/*" className="hidden" onChange={uploadPortrait} />

        {/* Portrait picker modal */}
        {showPortraitPicker && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setShowPortraitPicker(false)}
          >
            <div
              className={`rounded-xl border border-white/10 ${theme.box} p-4 shadow-xl w-72 max-h-[70vh] flex flex-col gap-3`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between shrink-0">
                <span className="text-sm font-semibold text-white">Choose Portrait</span>
                <button type="button" onClick={() => setShowPortraitPicker(false)} className="size-6 flex items-center justify-center rounded-md hover:bg-white/10 text-white/50 hover:text-white text-xs">
                  ✕
                </button>
              </div>

              {/* Upload new */}
              <button
                type="button"
                onClick={() => portraitRef.current?.click()}
                className="text-[11px] border border-dashed border-white/20 hover:border-white/40 rounded-lg py-2 text-white/50 hover:text-white transition-colors shrink-0"
              >
                + Upload new image
              </button>

              {/* Gallery grid */}
              <div className="overflow-y-auto flex-1 min-h-0">
                {galleryLoading ? (
                  <p className="text-xs text-white/40 text-center py-4">Loading…</p>
                ) : galleryImages.length === 0 ? (
                  <p className="text-xs text-white/40 italic text-center py-4">No images yet — upload some in Profile Settings.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {galleryImages.map((img) => (
                      <button
                        key={img.name}
                        type="button"
                        onClick={() => { update({ portrait: img.publicUrl }); setShowPortraitPicker(false) }}
                        className={`aspect-square rounded-lg overflow-hidden border-2 transition-colors ${data.portrait === img.publicUrl ? "border-primary" : "border-transparent hover:border-white/40"}`}
                      >
                        <img src={img.publicUrl} alt={img.name} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Name, race, class, level */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold tracking-wide truncate">{character.name}</p>
          <div className="flex items-center gap-1 text-[10px] text-white/50 uppercase tracking-widest">
            <input value={data.race ?? ""} onChange={(e) => update({ race: e.target.value })} placeholder="Race" className="bg-transparent outline-none w-14 placeholder:text-white/20" />
            <span className="text-white/20">/</span>
            <input value={data.class ?? ""} onChange={(e) => update({ class: e.target.value })} placeholder="Class" className="bg-transparent outline-none w-14 placeholder:text-white/20" />
            <span className="text-white/20">·</span>
            <span>Lv</span>
            <input
              type="number"
              value={data.level ?? ""}
              onChange={(e) => update({ level: parseInt(e.target.value) || 0 })}
              placeholder="1"
              className="bg-transparent outline-none w-5 placeholder:text-white/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        </div>

        {saving && <span className="text-[10px] text-white/40 shrink-0">saving…</span>}

        {/* Theme picker button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { setShowThemePicker(v => !v); setShowMaxMenu(false) }}
            className={`size-7 flex items-center justify-center rounded-md hover:bg-white/10 text-white/50 hover:text-white shrink-0 transition-colors text-sm`}
            title="Change theme"
          >
             Theme
          </button>
          {showThemePicker && (
            <div className={`absolute right-0 top-9 z-50 ${theme.box} border border-white/10 rounded-xl p-2 flex flex-col gap-1 min-w-[110px] shadow-xl`}>
              {Object.entries(THEMES).map(([key, t]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { update({ theme: key }); setShowThemePicker(false) }}
                  className={`text-xs px-3 py-1.5 rounded-lg text-left transition-colors ${
                    (data.theme === key || (!data.theme && key === DEFAULT_THEME))
                      ? "bg-white/20 text-white"
                      : "text-white hover:bg-white/10"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button type="button" onClick={onClose} className="size-7 flex items-center justify-center rounded-md hover:bg-white/10 text-white/50 hover:text-white shrink-0 transition-colors">
          ✕
        </button>
      </div>

      {/* ── Body (three columns) ── */}
      <div className={`flex flex-col md:flex-row gap-3 p-4 flex-1 min-h-0 overflow-auto ${theme.body}`}>

        {/* ─── Left column: HP ring + Speed / Initiative ─── */}
        <div className="flex flex-col gap-3 md:w-48 shrink-0">

          {/* HP ring card */}
          <div className={`${card} p-3 flex flex-col items-center gap-2`}>
            <div className="relative">

              {/* Pencil icon opens the Max HP / AC / Temp HP edit menu */}
              <button
                type="button"
                onClick={() => { setShowMaxMenu(v => !v); setShowThemePicker(false) }}
                className="absolute -top-1 -right-1 z-10 size-5 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-[9px] text-white transition-colors"
                title="Edit Max HP & AC"
              >
                ✎
              </button>

              {/* Floating edit menu for max stats */}
              {showMaxMenu && (
                <div className={`absolute top-7 z-50 ${theme.box} border border-white/10 rounded-xl p-3 flex flex-col gap-2.5 min-w-[150px] shadow-xl`}>
                  <label className="flex items-center gap-2">
                    <span className="text-[10px] text-white/70 w-14 shrink-0">Max HP</span>
                    <input
                      type="number"
                      value={data.maxHp ?? ""}
                      onChange={(e) => update({ maxHp: parseInt(e.target.value) || 0 })}
                      placeholder="0"
                      className="flex-1 text-center bg-white/10 rounded px-1 py-0.5 text-xs text-white outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="text-[10px] text-white/70 w-14 shrink-0">AC</span>
                    <input type="number" value={data.ac ?? ""} onChange={(e) => update({ ac: parseInt(e.target.value) || 0 })} placeholder="0" className="flex-1 text-center bg-white/10 rounded px-1 py-0.5 text-xs text-white outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="text-[10px] text-white/70 w-14 shrink-0">Temp HP</span>
                    <input type="number" value={data.tempHp ?? ""} onChange={(e) => update({ tempHp: parseInt(e.target.value) || 0 })} placeholder="0" className="flex-1 text-center bg-white/10 rounded px-1 py-0.5 text-xs text-white outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  </label>
                </div>
              )}

              {/* HP number display (read-only — use +/− to change) */}
              <div className="flex flex-col items-center pb-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold text-white leading-none select-none">{hp}</span>
                  {tempHp > 0 && (
                    <span className="text-xs font-bold text-blue-400 leading-none select-none">+{tempHp}</span>
                  )}
                </div>
                <span className="text-[8px] uppercase tracking-widest text-white/50 leading-none mt-0.5">HP</span>
              </div>

              {/* Circular HP progress ring + optional outer temp HP ring */}
              <div className="relative size-28">
                <svg viewBox="0 0 96 96" className="absolute inset-0 w-full h-full -rotate-90">
                  {/* Temp HP outer ring track */}
                  <circle cx="48" cy="48" r={TEMP_RING_RADIUS} fill="none" stroke="rgba(59,130,246,0.12)" strokeWidth="4" />
                  {/* Temp HP outer ring fill (blue) */}
                  {tempHp > 0 && (
                    <circle
                      cx="48" cy="48" r={TEMP_RING_RADIUS}
                      fill="none"
                      stroke="#60a5fa"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={tempRingCircumference}
                      strokeDashoffset={tempRingCircumference * (1 - tempHpPercent / 100)}
                      style={{ transition: "stroke-dashoffset 0.4s ease" }}
                    />
                  )}

                  {/* HP main ring track */}
                  <circle cx="48" cy="48" r={RING_RADIUS} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                  {/* HP main ring fill */}
                  <circle
                    cx="48" cy="48" r={RING_RADIUS}
                    fill="none"
                    stroke={hpColor}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringCircumference * (1 - hpPercent / 100)}
                    style={{ transition: "stroke-dashoffset 0.4s ease, stroke 0.4s ease" }}
                  />
                </svg>

                {/* AC shield centered inside the ring */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <Shield className="size-10 text-white/60" />
                  <span className="absolute text-sm font-bold text-white leading-none">{data.ac ?? 0}</span>
                </div>
              </div>
            </div>

            {/* HP target toggle + step input + minus/plus */}
            <div className="flex flex-col items-center gap-1.5">
              {/* Toggle: HP vs Temp HP */}
              <div className={`flex rounded-full text-[9px] font-semibold uppercase tracking-wide overflow-hidden ring-1 ${theme.ring}`}>
                <button
                  type="button"
                  onClick={() => setHpTarget("hp")}
                  className={`px-2.5 py-1 transition-colors ${hpTarget === "hp" ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70"}`}
                >
                  HP
                </button>
                <button
                  type="button"
                  onClick={() => setHpTarget("temp")}
                  className={`px-2.5 py-1 transition-colors ${hpTarget === "temp" ? "bg-blue-500/40 text-blue-200" : "text-white/40 hover:text-white/70"}`}
                >
                  Temp
                </button>
              </div>

              {/* Minus / step / Plus */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (hpTarget === "hp") update({ hp: Math.max(0, hp - hpStep) })
                    else update({ tempHp: Math.max(0, tempHp - hpStep) })
                  }}
                  className="size-7 rounded-full bg-white/10 hover:bg-red-900 text-white hover:text-red-200 flex items-center justify-center text-base font-bold transition-colors"
                >
                  −
                </button>
                <input
                  type="number"
                  value={hpStep}
                  onChange={(e) => setHpStep(Math.max(1, parseInt(e.target.value) || 1))}
                  min={1}
                  className={`w-10 text-center text-xs font-bold ${theme.box} border border-white/15 rounded-md py-1 text-white outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (hpTarget === "hp") update({ hp: maxHp > 0 ? Math.min(maxHp, hp + hpStep) : hp + hpStep })
                    else update({ tempHp: tempHp + hpStep })
                  }}
                  className="size-7 rounded-full bg-white/10 hover:bg-green-900 text-white hover:text-green-200 flex items-center justify-center text-base font-bold transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Speed and Initiative */}
          <div className="grid grid-cols-2 gap-1.5">
            {(["speed", "initiative"] as const).map((key) => (
              <div key={key} className={`${card} p-2 flex flex-col items-center gap-0.5`}>
                <input
                  type="number"
                  value={(data[key] as number | undefined) ?? ""}
                  onChange={(e) => update({ [key]: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                  className="w-full text-center text-base font-bold bg-transparent outline-none text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-[8px] uppercase tracking-widest text-white/50">
                  {key === "speed" ? "Spd" : "Init"}
                </span>
              </div>
            ))}
          </div>

          {/* Hit Dice */}
          {(() => {
            const pools: HitDicePool[] = data.hitDicePools ?? []

            function updatePool(id: string, patch: Partial<HitDicePool>) {
              update({ hitDicePools: pools.map(p => p.id === id ? { ...p, ...patch } : p) })
            }
            function removePool(id: string) {
              update({ hitDicePools: pools.filter(p => p.id !== id) })
            }
            function commitAddPool() {
              update({ hitDicePools: [...pools, { id: nanoid(), dieType: newPoolDie, total: newPoolCount, used: 0 }] })
              setShowAddPool(false)
              setNewPoolDie("d8")
              setNewPoolCount(1)
            }

            return (
              <div className={`${card} p-3 flex flex-col gap-2.5`}>
                {/* Header */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-widest text-white/50 font-semibold">Hit Dice</span>
                  <button
                    type="button"
                    onClick={() => setShowAddPool(v => !v)}
                    className="text-[9px] px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors"
                  >
                    + Add
                  </button>
                </div>

                {/* Add pool popup */}
                {showAddPool && (
                  <div className={`rounded-lg border border-white/10 bg-white/5 p-2.5 flex flex-col gap-2`}>
                    <span className="text-[10px] text-white/50 uppercase tracking-wider">New pool</span>
                    <div className="flex items-center gap-2">
                      <select
                        value={newPoolDie}
                        onChange={(e) => setNewPoolDie(e.target.value)}
                        className="bg-white/10 rounded px-1.5 py-1 text-xs text-white outline-none flex-1"
                      >
                        {["d4","d6","d8","d10","d12"].map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => setNewPoolCount(c => Math.max(1, c - 1))} className="size-5 rounded bg-white/10 hover:bg-white/20 text-white text-xs flex items-center justify-center">−</button>
                        <span className="text-xs text-white w-5 text-center">{newPoolCount}</span>
                        <button type="button" onClick={() => setNewPoolCount(c => c + 1)} className="size-5 rounded bg-white/10 hover:bg-white/20 text-white text-xs flex items-center justify-center">+</button>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button type="button" onClick={commitAddPool} className="flex-1 text-[10px] rounded-md bg-white/15 hover:bg-white/25 text-white py-1 transition-colors">Add</button>
                      <button type="button" onClick={() => setShowAddPool(false)} className="text-[10px] rounded-md bg-transparent hover:bg-white/10 text-white/40 hover:text-white px-2 py-1 transition-colors">Cancel</button>
                    </div>
                  </div>
                )}

                {pools.length === 0 && !showAddPool && (
                  <p className="text-[10px] text-white/30 italic text-center py-1">No hit dice — click Add</p>
                )}

                {/* Pool rows */}
                {pools.map((pool) => {
                  const remaining = Math.max(0, pool.total - pool.used)
                  return (
                    <div key={pool.id} className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-white/70 w-7">{pool.dieType}</span>
                        <div className="flex flex-wrap gap-1 flex-1">
                          {Array.from({ length: pool.total }).map((_, i) => {
                            const isAvailable = i < remaining
                            return (
                              <button
                                key={i}
                                type="button"
                                title={isAvailable ? "Click to use" : "Click to recover"}
                                onClick={() => updatePool(pool.id, { used: isAvailable ? pool.used + 1 : Math.max(0, pool.used - 1) })}
                                className={`size-5 rounded text-[8px] font-bold border transition-colors ${
                                  isAvailable
                                    ? "bg-white/15 border-white/20 text-white hover:bg-red-900/60 hover:border-red-400/40"
                                    : "bg-transparent border-white/10 text-white/20 hover:bg-green-900/40 hover:border-green-400/30"
                                }`}
                              >
                                ◆
                              </button>
                            )
                          })}
                        </div>
                        <span className="text-[9px] text-white/30 shrink-0">{remaining}/{pool.total}</span>
                        <button
                          type="button"
                          onClick={() => removePool(pool.id)}
                          className="size-4 flex items-center justify-center text-white/20 hover:text-red-400 text-[9px] transition-colors shrink-0"
                        >✕</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>

        {/* ─── Middle column: Saving throws + Spells/Equipment panel ─── */}
        <div className="flex flex-col gap-3 flex-1 min-w-0">

          {/* Saving Throws */}
          <div className={`${card} p-3`}>
            <span className="text-[10px] uppercase tracking-widest text-white/50 font-semibold block mb-2">Saving Throws</span>
            <div className="flex flex-col gap-1.5">
              {SAVE_KEYS.map((save) => {
                const mod = getSaveMod(save)
                const isProficient = data.savingThrowProfs?.[save] ?? false
                const modStr = mod >= 0 ? `+${mod}` : `${mod}`
                return (
                  <div key={save} className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => update({ savingThrowProfs: { ...data.savingThrowProfs, [save]: !isProficient } })}
                      className={`size-3.5 rounded-full border-2 shrink-0 transition-colors ${isProficient ? "bg-primary border-primary" : "border-white/30 bg-transparent hover:border-white/60"}`}
                    />
                    <span className="text-xs text-white/70 w-8 uppercase tracking-wider">{ABILITY_ABBR[SAVE_TO_ABILITY[save]]}</span>
                    <span className={`text-xs font-mono font-bold w-7 ${mod >= 0 ? "text-green-400" : "text-red-400"}`}>{modStr}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Spells / Equipment flip panel */}
          <div className={`${card} p-3 flex flex-col gap-2 flex-1 min-h-0`}>

            {/* Panel header with flip button */}
            <div className="flex items-center justify-between flex-wrap gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest text-white/50 font-semibold">
                  {showSpells ? "Spells" : "Equipment"}
                </span>
                <button
                  type="button"
                  onClick={() => setShowSpells(v => !v)}
                  className="text-[9px] px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors uppercase tracking-wide"
                >
                  ⇄ {showSpells ? "Equipment" : "Spells"}
                </button>
              </div>

              {/* Spell-only global stats */}
              {showSpells && (
                <div className="flex items-center gap-2 text-[10px] text-white/50">
                  <span>Save DC</span>
                  <input type="number" value={data.spellSaveDC ?? ""} onChange={(e) => update({ spellSaveDC: parseInt(e.target.value) || 0 })} placeholder="0" className="w-8 text-center bg-white/10 rounded px-1 py-0.5 text-white outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  <span>Atk</span>
                  <input type="number" value={data.spellAttackBonus ?? ""} onChange={(e) => update({ spellAttackBonus: parseInt(e.target.value) || 0 })} placeholder="0" className="w-8 text-center bg-white/10 rounded px-1 py-0.5 text-white outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                </div>
              )}
            </div>

            {/* Spell entries */}
            {showSpells && (
              <div className="flex flex-col gap-2 overflow-auto flex-1">
                {spellItems.map((spell) => (
                  <SpellEntry key={spell.id} spell={spell} onChange={(p) => changeSpellItem(spell.id, p)} onRemove={() => removeSpellItem(spell.id)} theme={theme} />
                ))}
                <button type="button" onClick={addSpellItem} className="text-[10px] text-white/50 hover:text-white border border-dashed border-white/20 hover:border-white/40 rounded-lg py-1.5 transition-colors shrink-0">
                  + Add Spell
                </button>
              </div>
            )}

            {/* Equipment entries */}
            {!showSpells && (
              <div className="flex flex-col gap-2 overflow-auto flex-1">
                {equipItems.map((item) => (
                  <EquipmentEntry key={item.id} item={item} onChange={(p) => changeEquipItem(item.id, p)} onRemove={() => removeEquipItem(item.id)} theme={theme} />
                ))}
                <button type="button" onClick={addEquipItem} className="text-[10px] text-white/50 hover:text-white border border-dashed border-white/20 hover:border-white/40 rounded-lg py-1.5 transition-colors shrink-0">
                  + Add Item
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ─── Right column: Ability scores + Background ─── */}
        <div className="flex flex-col gap-3 md:w-44 shrink-0">

          {/* Ability Scores */}
          <div className={`${card} p-3`}>
            <span className="text-[10px] uppercase tracking-widest text-white/50 font-semibold block mb-2">Abilities</span>
            <div className="flex flex-col gap-2">
              {ABILITY_KEYS.map((key) => {
                const abilityScore = (data[key as keyof CharacterData] as number | undefined) ?? 10
                const mod = abilityMod(abilityScore)
                const isPositive = !mod.startsWith("-")
                return (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-widest text-white/50 w-8">{ABILITY_ABBR[key]}</span>
                    <input
                      type="number"
                      value={(data[key as keyof CharacterData] as number | undefined) ?? ""}
                      onChange={(e) => update({ [key]: parseInt(e.target.value) || 0 })}
                      placeholder="10"
                      className={`w-10 text-center bg-white/10 rounded px-1 py-0.5 text-sm font-bold text-white outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                    />
                    <span className={`text-xs font-mono w-6 ${isPositive ? "text-green-400" : "text-red-400"}`}>{mod}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Background & Alignment */}
          <div className={`${card} p-3 flex flex-col gap-2`}>
            <span className="text-[10px] uppercase tracking-widest text-white/50 font-semibold">Background</span>
            <input value={data.background ?? ""} onChange={(e) => update({ background: e.target.value })} placeholder="Acolyte, Sage…" className="bg-transparent outline-none text-xs text-white placeholder:text-white/20 border-b border-white/10 pb-1" />
            <input value={data.alignment ?? ""} onChange={(e) => update({ alignment: e.target.value })} placeholder="Alignment…" className="bg-transparent outline-none text-xs text-white placeholder:text-white/20" />
          </div>
        </div>
      </div>
    </div>
  )
}
