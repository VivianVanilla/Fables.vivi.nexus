// ════════════════════════════════════════════════════════════════════════════
// FeatureEntry.tsx — collapsible feature card
//
// Untracked: ▶ Feature Name  [Source]                    [✎]
// Trackable: ▶ Feature Name  [──────slider──────] 2/3 LR  [✎]
// Expanded adds description text below the header row.
// Edit mode: name, source, description, track uses, max (or = PB), resets, links
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState, type CSSProperties } from "react"
import type { Feature, UseTracker } from "../../character-types"
import type { Theme } from "../../character-themes"
import { nanoid } from "../../character-utils"
import { TracingSlider } from "../../ui/tracing-slider"
import { MarkdownTextarea } from "../../ui/MarkdownTextarea"
import { Markdown } from "../../ui/Markdown"
import { PopTransition } from "../ui/PopTransition"
import { FavoriteStar } from "../ui/FavoriteStar"
import { NumInput } from "../ui/NumInput"
import { DamageEditor, DamagePills } from "../ui/DamageFields"
import { computeDamageSegments } from "../../character-damage-types"
import { ITEM_RARITIES, RARITY_COLORS } from "../../character-constants"
import { classColorClasses } from "../../character-class-colors"
import { supabase } from "../../../../src/supabase"

// ── Feature suggestion cache — per doc type, per homebrew scope ───────────────

export type SuggestionSource = "race" | "class" | "feat" | "item" | "invocation"

export interface Suggestion {
  name: string
  description: string
  meta?: { item_type?: string; damage?: string; damage_type?: string; properties?: string; prerequisite?: string }
}

// Shared with EquipmentEntry.tsx (the Martial tab) so a weapon's Attack Stat
// options are identical whichever side it's edited from.
export const STAT_OPTIONS = [
  { value: "",    label: "None" },
  { value: "str", label: "STR" },
  { value: "dex", label: "DEX" },
  { value: "con", label: "CON" },
  { value: "int", label: "INT" },
  { value: "wis", label: "WIS" },
  { value: "cha", label: "CHA" },
] as const

const cacheMap   = new Map<string, Suggestion[]>()
const promiseMap = new Map<string, Promise<Suggestion[]>>()

// Called whenever the user's homebrew library changes (add/remove) so stale
// suggestions don't linger for the rest of the session.
export function invalidateSuggestionCache() {
  cacheMap.clear()
  promiseMap.clear()
}

export async function getSuggestions(docType: SuggestionSource, userId?: string | null): Promise<Suggestion[]> {
  const key = `${docType}:${userId ?? "anon"}`
  if (cacheMap.has(key)) return cacheMap.get(key)!
  if (promiseMap.has(key)) return promiseMap.get(key)!

  const p = (async () => {
    // Core (non-homebrew)
    const { data: coreRows } = await supabase
      .from("documentation").select("name, description, data")
      .eq("type", docType).eq("is_homebrew", false)

    let homebrew: any[] = []
    if (userId) {
      // Personal homebrew
      const { data: ownRows } = await supabase
        .from("documentation").select("name, description, data")
        .eq("type", docType).eq("is_homebrew", true).eq("owner_id", userId)

      homebrew = [...(ownRows ?? [])]

      // Library homebrew — invocations have no "add to library" flow (they're
      // browsed/created directly under Feats in Documentation), so skip this lookup.
      if (docType !== "invocation") {
        const objType = docType === "race" ? "doc_race" : docType === "class" ? "doc_class" : docType === "item" ? "doc_item" : "doc_feat"
        const { data: libObjs } = await supabase
          .from("objects").select("data").eq("type", objType).eq("owner_id", userId)
        const libIds = (libObjs ?? []).map((o: any) => o.data?.doc_id).filter(Boolean)

        let libRows: any[] = []
        if (libIds.length) {
          const { data: lr } = await supabase.from("documentation").select("name, description, data").in("id", libIds)
          libRows = lr ?? []
        }

        homebrew = [...homebrew, ...libRows]
      }
    }

    const all = [...(coreRows ?? []), ...homebrew]
    const results: Suggestion[] = []

    for (const row of all) {
      // Feats and items are stored as one document per entry, unlike races/classes
      // which nest traits/features arrays. The real text lives in data.description —
      // the top-level `description` column is actually the "Source" field (e.g. "PHB p.51").
      if (docType === "feat") {
        if (row.name) results.push({ name: row.name, description: row.data?.description ?? "" })
        continue
      }
      if (docType === "invocation") {
        if (row.name) results.push({
          name: row.name,
          description: row.data?.description ?? "",
          meta: { prerequisite: row.data?.prerequisite },
        })
        continue
      }
      if (docType === "item") {
        if (row.name) results.push({
          name: row.name,
          description: row.data?.description ?? "",
          meta: {
            item_type:    row.data?.item_type,
            damage:       row.data?.damage,
            damage_type:  row.data?.damage_type,
            properties:   row.data?.properties,
          },
        })
        continue
      }

      const features: any[] = row.data?.features ?? []
      const traits:   any[] = row.data?.traits   ?? []

      features.forEach(f => {
        if (f?.name) results.push({ name: f.name, description: f.description ?? "" })
      })
      traits.forEach(t => {
        if (typeof t === "string") results.push({ name: t, description: "" })
        else if (t?.name) results.push({ name: t.name, description: t.description ?? "" })
      })
    }

    // Deduplicate by name
    const seen = new Set<string>()
    const deduped = results.filter(s => {
      const k = s.name.toLowerCase()
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })

    cacheMap.set(key, deduped)
    return deduped
  })()

  promiseMap.set(key, p)
  return p
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface FeatureEntryProps {
  feature:          Feature
  allFeatures:      Feature[]         // other trackable features available to link
  onChange:         (patch: Partial<Feature>) => void
  onRemove:         () => void
  onLinkToggle:     (otherId: string) => void
  theme:            Theme
  readOnly?:        boolean
  pb:               number            // current proficiency bonus
  suggestionSource?: SuggestionSource  // which doc type to autocomplete from
  userId?:          string | null
  isFavorite?:       boolean
  onToggleFavorite?: () => void        // omit to hide the star
  onAddToEquipment?: (feature: Feature) => void  // only wired for the Items tab — toggles into/out of Martial
  inEquipment?:      boolean            // whether this feature already has a linked copy in the Martial list
  showAttunement?:   boolean            // only true for the Items tab — shows the "Requires Attunement" toggle, and the "Attuned" checkbox once that's on
  showItemExtras?:   boolean            // only true for the Items tab — shows Equipped / AC Bonus / Weight
  showWeightColumn?: boolean            // only true for the Carried Items list — shows the item's own weight right in the collapsed header, not just when expanded
  showMagicStar?:    boolean            // Settings toggle (default true) — the "✨" badge on items flagged Magic Item
  magicItemStyle?:   "none" | "outline" | "galaxy"  // Settings choice (default "galaxy") — sheet-wide card treatment for items flagged Magic Item
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Purely cosmetic — a slow-drifting starfield/nebula card background for
// items flagged "Magic Item" (see index.css for the @keyframes). Plain
// inline style rather than a Tailwind class since it's a multi-layer
// gradient, not a single utility value.
//
// Three stacked layers (first = frontmost):
//  1. A flat translucent wash — heavier than it looks, so the pattern reads
//     as a faint backdrop behind the name/badges instead of competing with them.
//  2. A small repeating star tile, dim, animated by exactly its own tile size
//     (see @keyframes fables-item-cosmos) — repeating tiles always wrap
//     seamlessly at a multiple of their own size, same trick the "gold"
//     theme's coin rain uses (index.css), unlike a one-shot 200%-canvas
//     scroll which visibly seams once discrete dots (not a continuous
//     gradient) reach the edge.
//  3. A static, muted nebula gradient base — no animation, so nothing about it can seam.
const STAR_TILE = [
  "radial-gradient(circle 1px at 15% 20%, #fff 35%, transparent 45%)",
  "radial-gradient(circle 1px at 55% 65%, #fff 35%, transparent 45%)",
  "radial-gradient(circle 1.5px at 80% 30%, #fff 35%, transparent 45%)",
  "radial-gradient(circle 1px at 30% 85%, #fff 35%, transparent 45%)",
  "radial-gradient(circle 1px at 90% 90%, #fff 35%, transparent 45%)",
].join(", ")

// Shared with EquipmentEntry.tsx (the Martial tab) so an item flagged Magic
// Item gets the exact same "galaxy" card treatment whichever side it's viewed from.
export const MAGIC_ITEM_BG: CSSProperties = {
  backgroundImage: `linear-gradient(rgba(10,6,22,0.7), rgba(10,6,22,0.7)), ${STAR_TILE}, linear-gradient(135deg, #140a2c, #241250 45%, #3b1f6b 75%, #140a2c)`,
  backgroundRepeat: "no-repeat, repeat, no-repeat",
  backgroundSize: "100% 100%, 90px 90px, 100% 100%",
  backgroundPosition: "0 0, 0 0, 0 0",
  animation: "fables-item-cosmos 20s linear infinite",
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FeatureEntry({
  feature, allFeatures, onChange, onRemove, onLinkToggle, theme, readOnly = false, pb, suggestionSource, userId,
  isFavorite, onToggleFavorite, onAddToEquipment, inEquipment, showAttunement, showItemExtras, showWeightColumn,
  showMagicStar = true, magicItemStyle = "galaxy",
}: FeatureEntryProps) {
  const [expanded,    setExpanded]    = useState(false)
  const [editing,     setEditing]     = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showSuggest, setShowSuggest] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const namePlaceholder = showItemExtras ? "Item name" : "Feature name"
  const unnamedLabel    = showItemExtras ? "Unnamed Item" : "Unnamed"

  // Preload cache when entering edit mode
  useEffect(() => {
    if (editing && suggestionSource) getSuggestions(suggestionSource, userId)
  }, [editing, suggestionSource, userId])

  // Compute effective max uses: PB formula overrides manual value
  const effectiveMax  = feature.maxUsesFormula === "pb" ? pb : (feature.maxUses ?? 0)
  const usesUsed      = feature.usesUsed ?? 0
  const usesRemaining = Math.max(0, effectiveMax - usesUsed)
  const hasUses       = !!(feature.trackable && effectiveMax > 0)

  // ── Drag source ──────────────────────────────────────────────────────────

  const dragAttrs = readOnly ? {} : {
    draggable: true as const,
    onDragStart(e: React.DragEvent) {
      e.dataTransfer.setData("x-fable-ref", JSON.stringify({
        refId:   feature.id,
        refType: "feature",
        label:   feature.name || "Feature",
      }))
      e.dataTransfer.effectAllowed = "copy"
    },
  }

  // ── Edit mode ────────────────────────────────────────────────────────────

  if (editing) {
    const usesPB = feature.maxUsesFormula === "pb"

    function addTracker() {
      onChange({ trackers: [...(feature.trackers ?? []), { id: nanoid(), label: "", maxUses: 1, usesUsed: 0, resetsOn: "long" }] })
    }
    function changeTracker(id: string, patch: Partial<UseTracker>) {
      onChange({ trackers: (feature.trackers ?? []).map(t => t.id === id ? { ...t, ...patch } : t) })
    }
    function removeTracker(id: string) {
      onChange({ trackers: (feature.trackers ?? []).filter(t => t.id !== id) })
    }

    return (
      <div className={`rounded-xl ${theme.box} border border-white/20 p-3 flex flex-col gap-2`}>

        {/* Name with autocomplete */}
        <div className="relative">
          <input
            ref={nameInputRef}
            value={feature.name}
            autoFocus
            placeholder={namePlaceholder}
            onChange={async e => {
              const q = e.target.value
              onChange({ name: q })
              if (q.length >= 2 && suggestionSource) {
                const all = await getSuggestions(suggestionSource, userId)
                const ql = q.toLowerCase()
                const matches = all.filter(s => s.name.toLowerCase().includes(ql)).slice(0, 8)
                setSuggestions(matches)
                setShowSuggest(matches.length > 0)
              } else {
                setShowSuggest(false)
              }
            }}
            onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
            className={`w-full bg-transparent outline-none text-sm font-semibold ${theme.color} placeholder:text-white/30 border-b border-white/10 pb-1.5`}
          />
          {showSuggest && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-zinc-900 border border-white/15 rounded-lg shadow-xl overflow-hidden">
              {suggestions.map(s => (
                <button
                  key={s.name}
                  type="button"
                  onMouseDown={e => {
                    e.preventDefault()
                    const desc = s.meta?.prerequisite
                      ? `*Prerequisite: ${s.meta.prerequisite}*\n\n${s.description}`
                      : (s.description || feature.description)
                    onChange({
                      name: s.name,
                      description: desc,
                      ...(s.meta && !s.meta.prerequisite ? { itemMeta: { itemType: s.meta.item_type, damage: s.meta.damage, damageType: s.meta.damage_type, properties: s.meta.properties } } : {}),
                    })
                    setShowSuggest(false)
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-white/10 transition-colors border-b border-white/5 last:border-0"
                >
                  <span className="text-white font-medium">{s.name}</span>
                  {s.description && (
                    <span className="text-white/35 ml-2 truncate block">{s.description.slice(0, 60)}{s.description.length > 60 ? "…" : ""}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <PopTransition show={!showItemExtras}>
          <div className="flex items-center gap-2">
            <input value={feature.source ?? ""} placeholder="Source (e.g. Fighter, Variant Human…)"
              onChange={e => onChange({ source: e.target.value })}
              className="flex-1 min-w-0 bg-transparent outline-none text-xs text-white/60 placeholder:text-white/20"
            />
            <label className="flex items-center gap-1.5 text-[10px] text-white/40 shrink-0">
              Level
              <input type="number" min={1} max={20} value={feature.level ?? ""} placeholder="—"
                onChange={e => onChange({ level: e.target.value ? Math.min(20, Math.max(1, parseInt(e.target.value) || 1)) : undefined })}
                className="w-11 bg-white/10 rounded px-1.5 py-1 text-center text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </label>
          </div>
        </PopTransition>
        <MarkdownTextarea
          value={feature.description ?? ""}
          onChange={v => onChange({ description: v })}
          placeholder="Description…"
          rows={5}
          className="bg-transparent outline-none text-xs text-white/70 placeholder:text-white/20 resize-none leading-relaxed border-t border-white/10 pt-2 w-full"
          variant="light"
        />

        {showAttunement && (
          <div className="flex flex-col gap-2 text-xs border-t border-white/10 pt-2">
            <label className="flex items-center gap-2 text-white/60 cursor-pointer select-none">
              <input type="checkbox" checked={feature.requiresAttunement ?? false}
                onChange={e => onChange({
                  requiresAttunement: e.target.checked,
                  ...(!e.target.checked ? { attuned: false } : {}),
                })}
              />
              Requires Attunement
            </label>
            <PopTransition show={!!feature.requiresAttunement}>
              <label className={`flex items-center gap-2 font-bold cursor-pointer select-none ${theme.color}`}>
                <input type="checkbox" checked={feature.attuned ?? false}
                  onChange={e => onChange({ attuned: e.target.checked })}
                  className="accent-white"
                />
                Attuned
              </label>
            </PopTransition>
          </div>
        )}

        {showItemExtras && (
          <div className="flex flex-col gap-2 text-xs border-t border-white/10 pt-2">
            <div className="flex items-center gap-1 rounded-full bg-white/10 p-0.5 w-fit">
              <button type="button" onClick={() => onChange({ category: "armor" })}
                className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${feature.category === "armor" ? "bg-sky-500/30 text-sky-200" : "text-white/40 hover:text-white/70"}`}>
                Armor & Equipment
              </button>
              <button type="button" onClick={() => onChange({ category: "item" })}
                className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${feature.category !== "armor" ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70"}`}>
                Generic Item
              </button>
            </div>

            {/* Equipped/Magic Item apply to any item, armor or not — switching the
                category above only changes which stat fields show below, it no
                longer moves the item between the Equipped and Carried Items lists. */}
            <div className="flex flex-wrap items-center gap-3">
              {feature.category === "armor" && (
                <label className={`flex items-center gap-2 font-bold cursor-pointer select-none whitespace-nowrap ${theme.color}`}>
                  <input type="checkbox" checked={feature.equipped ?? false}
                    onChange={e => onChange({ equipped: e.target.checked })}
                    className="accent-white"
                  />
                  Equipped
                </label>
              )}
              <label className="flex items-center gap-2 text-purple-300 cursor-pointer select-none whitespace-nowrap">
                <input type="checkbox" checked={feature.isMagicItem ?? false}
                  onChange={e => onChange({ isMagicItem: e.target.checked })}
                  className="accent-purple-500"
                />
                Magic Item
              </label>
              <span className="text-white/25 italic">(style is set sheet-wide in Settings)</span>
            </div>

            <PopTransition show={feature.category === "armor"}>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1 rounded-full bg-white/10 p-0.5 w-fit">
                  <button type="button" onClick={() => onChange({ equipKind: "armor" })}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${(feature.equipKind ?? "armor") === "armor" ? "bg-sky-500/30 text-sky-200" : "text-white/40 hover:text-white/70"}`}>
                    Armor
                  </button>
                  <button type="button" onClick={() => onChange({ equipKind: "weapon" })}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${feature.equipKind === "weapon" ? "bg-red-500/30 text-red-200" : "text-white/40 hover:text-white/70"}`}>
                    Weapon
                  </button>
                  <button type="button" onClick={() => onChange({ equipKind: "misc" })}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${feature.equipKind === "misc" ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70"}`}>
                    Misc
                  </button>
                </div>

                <PopTransition show={(feature.equipKind ?? "armor") === "armor"}>
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1 rounded-full bg-white/10 p-0.5 w-fit">
                        <button type="button" onClick={() => onChange({ itemMeta: { ...feature.itemMeta, armorMode: "bonus" } })}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${(feature.itemMeta?.armorMode ?? "bonus") === "bonus" ? "bg-sky-500/30 text-sky-200" : "text-white/40 hover:text-white/70"}`}>
                          Flat Bonus
                        </button>
                        <button type="button" onClick={() => onChange({ itemMeta: { ...feature.itemMeta, armorMode: "base" } })}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${feature.itemMeta?.armorMode === "base" ? "bg-sky-500/30 text-sky-200" : "text-white/40 hover:text-white/70"}`}>
                          Base Armor
                        </button>
                      </div>
                    </div>

                    <PopTransition show={(feature.itemMeta?.armorMode ?? "bonus") === "bonus"}>
                      <label className="flex items-center gap-1.5 text-white/50 whitespace-nowrap">
                        AC Bonus
                        <NumInput value={feature.itemMeta?.acBonus ?? ""}
                          onChange={e => onChange({ itemMeta: { ...feature.itemMeta, acBonus: e.target.value ? parseInt(e.target.value) || 0 : undefined } })}
                          placeholder="0"
                          className="w-14 bg-white/10 rounded px-2 py-1 text-center text-white outline-none" />
                      </label>
                    </PopTransition>

                    <PopTransition show={feature.itemMeta?.armorMode === "base"}>
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-1.5 text-white/50 whitespace-nowrap">
                          Base AC
                          <NumInput value={feature.itemMeta?.armorBaseAc ?? ""}
                            onChange={e => onChange({ itemMeta: { ...feature.itemMeta, armorBaseAc: e.target.value ? parseInt(e.target.value) || 0 : undefined } })}
                            placeholder="10"
                            className="w-14 bg-white/10 rounded px-2 py-1 text-center text-white outline-none" />
                        </label>
                        <div className="flex items-center gap-1 rounded-full bg-white/10 p-0.5 w-fit">
                          <button type="button" onClick={() => onChange({ itemMeta: { ...feature.itemMeta, armorDexMode: "full" } })}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${(feature.itemMeta?.armorDexMode ?? "full") === "full" ? "bg-emerald-500/30 text-emerald-200" : "text-white/40 hover:text-white/70"}`}>
                            Full Dex
                          </button>
                          <button type="button" onClick={() => onChange({ itemMeta: { ...feature.itemMeta, armorDexMode: "half" } })}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${feature.itemMeta?.armorDexMode === "half" ? "bg-amber-500/30 text-amber-200" : "text-white/40 hover:text-white/70"}`}>
                            Half Dex (max +2)
                          </button>
                          <button type="button" onClick={() => onChange({ itemMeta: { ...feature.itemMeta, armorDexMode: "none" } })}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${feature.itemMeta?.armorDexMode === "none" ? "bg-red-500/30 text-red-200" : "text-white/40 hover:text-white/70"}`}>
                            No Dex
                          </button>
                        </div>
                      </div>
                    </PopTransition>

                    <label className="flex items-center gap-2 text-white/50 cursor-pointer select-none whitespace-nowrap">
                      <input type="checkbox" checked={feature.itemMeta?.stealthDisadvantage ?? false}
                        onChange={e => onChange({ itemMeta: { ...feature.itemMeta, stealthDisadvantage: e.target.checked } })}
                        className="accent-white"
                      />
                      Disadvantage on Stealth
                    </label>
                  </div>
                </PopTransition>

                <PopTransition show={feature.equipKind === "weapon"}>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1 rounded-full bg-white/10 p-0.5 w-fit">
                      <button type="button" onClick={() => onChange({ itemMeta: { ...feature.itemMeta, weaponKind: "melee" } })}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${(feature.itemMeta?.weaponKind ?? "melee") === "melee" ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70"}`}>
                        Melee
                      </button>
                      <button type="button" onClick={() => onChange({ itemMeta: { ...feature.itemMeta, weaponKind: "ranged" } })}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${feature.itemMeta?.weaponKind === "ranged" ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70"}`}>
                        Ranged
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-1.5 text-white/50 whitespace-nowrap">
                        Attack Stat
                        <select value={feature.itemMeta?.attackStat ?? ""}
                          onChange={e => onChange({ itemMeta: { ...feature.itemMeta, attackStat: (e.target.value || undefined) as NonNullable<Feature["itemMeta"]>["attackStat"] } })}
                          className="bg-zinc-800 rounded px-2 py-1 text-white text-xs outline-none">
                          {STAT_OPTIONS.map(o => (
                            <option key={o.value} value={o.value} className="bg-zinc-800 text-white">{o.label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="flex items-center gap-2 text-white/50 cursor-pointer select-none whitespace-nowrap">
                        <input type="checkbox" checked={feature.itemMeta?.proficient ?? false}
                          onChange={e => onChange({ itemMeta: { ...feature.itemMeta, proficient: e.target.checked } })}
                          className="accent-white"
                        />
                        Proficient
                      </label>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-1.5 text-white/50 whitespace-nowrap">
                        Magic Bonus
                        <input value={feature.itemMeta?.magicBonus ?? ""} placeholder="+1"
                          onChange={e => onChange({ itemMeta: { ...feature.itemMeta, magicBonus: e.target.value } })}
                          className="w-14 bg-white/10 rounded px-2 py-1 text-center text-white outline-none placeholder:text-white/20" />
                      </label>
                      {!feature.itemMeta?.attackStat && (
                        <label className="flex items-center gap-1.5 text-white/50 whitespace-nowrap">
                          To Hit
                          <input value={feature.itemMeta?.toHit ?? ""} placeholder="+5"
                            onChange={e => onChange({ itemMeta: { ...feature.itemMeta, toHit: e.target.value } })}
                            className="w-14 bg-white/10 rounded px-2 py-1 text-center text-white outline-none placeholder:text-white/20" />
                        </label>
                      )}
                      {feature.itemMeta?.attackStat && (
                        <>
                          <label className="flex items-center gap-1.5 text-white/50 whitespace-nowrap">
                            Extra To Hit
                            <NumInput value={feature.itemMeta?.extraToHit ?? ""} placeholder="0"
                              onChange={e => onChange({ itemMeta: { ...feature.itemMeta, extraToHit: parseInt(e.target.value) || 0 } })}
                              className="w-14 bg-white/10 rounded px-2 py-1 text-center text-white outline-none" />
                          </label>
                          <label className="flex items-center gap-1.5 text-white/50 whitespace-nowrap">
                            Extra Damage
                            <NumInput value={feature.itemMeta?.extraDamage ?? ""} placeholder="0"
                              onChange={e => onChange({ itemMeta: { ...feature.itemMeta, extraDamage: parseInt(e.target.value) || 0 } })}
                              className="w-14 bg-white/10 rounded px-2 py-1 text-center text-white outline-none" />
                          </label>
                        </>
                      )}
                    </div>
                    <DamageEditor
                      value={feature.itemMeta ?? {}}
                      onChange={patch => onChange({ itemMeta: { ...feature.itemMeta, ...patch } })}
                      damagePlaceholder="1d8"
                    />
                    <label className="flex items-center gap-1.5 text-white/50 whitespace-nowrap">
                      Properties
                      <input value={feature.itemMeta?.properties ?? ""} placeholder="Versatile, Finesse…"
                        onChange={e => onChange({ itemMeta: { ...feature.itemMeta, properties: e.target.value } })}
                        className="flex-1 min-w-32 bg-white/10 rounded px-2 py-1 text-white outline-none placeholder:text-white/20" />
                    </label>
                    <div className="flex flex-wrap items-center gap-3">
                      <PopTransition show={(feature.itemMeta?.weaponKind ?? "melee") === "melee"}>
                        <div className="flex flex-wrap items-center gap-3">
                          <label className="flex items-center gap-1.5 text-white/50 whitespace-nowrap">
                            Melee Range
                            <input value={feature.itemMeta?.meleeRange ?? ""} placeholder="5 ft."
                              onChange={e => onChange({ itemMeta: { ...feature.itemMeta, meleeRange: e.target.value } })}
                              className="w-20 bg-white/10 rounded px-2 py-1 text-center text-white outline-none placeholder:text-white/20" />
                          </label>
                          <label className="flex items-center gap-1.5 text-white/50 whitespace-nowrap">
                            Throw Range
                            <input value={feature.itemMeta?.throwRange ?? ""} placeholder="20/60 ft."
                              onChange={e => onChange({ itemMeta: { ...feature.itemMeta, throwRange: e.target.value } })}
                              className="w-24 bg-white/10 rounded px-2 py-1 text-center text-white outline-none placeholder:text-white/20" />
                          </label>
                        </div>
                      </PopTransition>
                      <PopTransition show={feature.itemMeta?.weaponKind === "ranged"}>
                        <label className="flex items-center gap-1.5 text-white/50 whitespace-nowrap">
                          Range
                          <input value={feature.itemMeta?.range ?? ""} placeholder="80/320 ft."
                            onChange={e => onChange({ itemMeta: { ...feature.itemMeta, range: e.target.value } })}
                            className="w-24 bg-white/10 rounded px-2 py-1 text-center text-white outline-none placeholder:text-white/20" />
                        </label>
                      </PopTransition>
                    </div>
                  </div>
                </PopTransition>
              </div>
            </PopTransition>

            <div className="flex flex-wrap items-center gap-3">
              <PopTransition show={feature.category !== "armor"}>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1.5 text-white/50 whitespace-nowrap">
                    Amount
                    <NumInput min={1} value={feature.amount ?? 1}
                      onChange={e => onChange({ amount: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="w-14 bg-white/10 rounded px-2 py-1 text-center text-white outline-none" />
                  </label>
                  <label className="flex items-center gap-2 text-amber-300 cursor-pointer select-none whitespace-nowrap">
                    <input type="checkbox" checked={feature.isContainer ?? false}
                      onChange={e => onChange({ isContainer: e.target.checked })}
                      className="accent-amber-500"
                    />
                    Is a Container (drag items onto it to store them)
                  </label>
                  <PopTransition show={!!feature.isContainer}>
                    <label className="flex items-center gap-1.5 text-white/50 whitespace-nowrap">
                      Max Weight (lb)
                      <NumInput min={0} step="0.1" value={feature.maxWeight ?? ""}
                        onChange={e => onChange({ maxWeight: e.target.value ? parseFloat(e.target.value) || 0 : undefined })}
                        placeholder="—"
                        className="w-16 bg-white/10 rounded px-2 py-1 text-center text-white outline-none" />
                    </label>
                  </PopTransition>
                </div>
              </PopTransition>

              <label className="flex items-center gap-1.5 text-white/50 whitespace-nowrap">
                Weight (lb)
                <NumInput min={0} step="0.1" value={feature.weight ?? ""}
                  onChange={e => onChange({ weight: e.target.value ? parseFloat(e.target.value) || 0 : undefined })}
                  placeholder="0"
                  className="w-16 bg-white/10 rounded px-2 py-1 text-center text-white outline-none" />
              </label>
              <label className="flex items-center gap-1.5 text-white/50 whitespace-nowrap">
                Value (gp)
                <NumInput min={0} step="0.01" value={feature.value ?? ""}
                  onChange={e => onChange({ value: e.target.value ? parseFloat(e.target.value) || 0 : undefined })}
                  placeholder="0"
                  className="w-16 bg-white/10 rounded px-2 py-1 text-center text-white outline-none" />
              </label>
              <label className="flex items-center gap-1.5 text-white/50 whitespace-nowrap">
                Rarity
                <select value={feature.rarity ?? ""}
                  onChange={e => onChange({ rarity: (e.target.value || undefined) as Feature["rarity"] })}
                  className="bg-zinc-800 rounded px-2 py-1 text-white text-xs outline-none">
                  <option value="" className="bg-zinc-800 text-white">—</option>
                  {ITEM_RARITIES.map(r => <option key={r} value={r} className="bg-zinc-800 text-white">{r}</option>)}
                </select>
              </label>
            </div>
          </div>
        )}

        {/* Use tracking */}
        <div className="border-t border-white/10 pt-2 flex flex-col gap-2">
          <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer select-none">
            <input type="checkbox" checked={feature.trackable ?? false}
              onChange={e => onChange({ trackable: e.target.checked })}
            />
            Track uses
          </label>

          {feature.trackable && (
            <>
              <div className="flex items-center gap-3 text-xs flex-wrap">
                {/* Max uses — either PB or manual */}
                <label className="flex items-center gap-1.5 text-white/50">
                  Max
                  {usesPB ? (
                    <span className="px-2 py-1 rounded bg-primary/20 text-primary text-xs font-semibold">PB ({pb})</span>
                  ) : (
                    <NumInput value={feature.maxUses ?? ""} min={1}
                      onChange={e => onChange({ maxUses: parseInt(e.target.value) || 0 })}
                      className="w-12 bg-white/10 rounded px-2 py-1 text-center text-white outline-none"
                    />
                  )}
                </label>
                <label className="flex items-center gap-1.5 text-white/50 cursor-pointer select-none">
                  <input type="checkbox" checked={usesPB}
                    onChange={e => onChange({ maxUsesFormula: e.target.checked ? "pb" : undefined, maxUses: e.target.checked ? undefined : (feature.maxUses ?? 1) })}
                  />
                  = Prof. Bonus
                </label>
                <label className="flex items-center gap-1.5 text-white/50">
                  Resets on
                  <select value={feature.resetsOn ?? "long"}
                    onChange={e => onChange({ resetsOn: e.target.value as Feature["resetsOn"] })}
                    className="bg-zinc-800 rounded px-2 py-1 text-white outline-none text-xs">
                    <option value="short" className="bg-zinc-800 text-white">Short Rest</option>
                    <option value="long" className="bg-zinc-800 text-white">Long Rest</option>
                    <option value="dawn" className="bg-zinc-800 text-white">Dawn</option>
                    <option value="manual" className="bg-zinc-800 text-white">Manual</option>
                  </select>
                </label>
                <label className="flex items-center gap-1.5 text-white/50 cursor-pointer">
                  Bar color
                  <input type="color" value={feature.sliderColor ?? "#6366f1"}
                    onChange={e => onChange({ sliderColor: e.target.value })}
                    className="size-4 cursor-pointer rounded border-0 bg-transparent p-0"
                  />
                </label>
              </div>

              {/* Linked features — only features with matching max uses are eligible to sync,
                  except already-linked ones (kept visible so a stale link can be undone). */}
              {effectiveMax > 0 && (() => {
                const linkCandidates = allFeatures.filter(other => {
                  const linked   = feature.linkedTo?.includes(other.id) ?? false
                  const otherMax = other.maxUsesFormula === "pb" ? pb : (other.maxUses ?? 0)
                  return linked || otherMax === effectiveMax
                })
                if (linkCandidates.length === 0) return null
                return (
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-white/40 uppercase tracking-widest">Sync uses with</span>
                    <div className="flex flex-wrap gap-1">
                      {linkCandidates.map(other => {
                        const linked   = feature.linkedTo?.includes(other.id) ?? false
                        const otherMax = other.maxUsesFormula === "pb" ? pb : (other.maxUses ?? 0)
                        const stale    = linked && otherMax !== effectiveMax
                        return (
                          <button key={other.id} type="button" onClick={() => onLinkToggle(other.id)}
                            title={stale ? `Max uses no longer match (${otherMax} vs ${effectiveMax}) — click to unlink` : undefined}
                            className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                              stale
                                ? "bg-red-500/10 border-red-400/40 text-red-300"
                                : linked
                                ? "bg-primary/20 border-primary/50 text-white"
                                : "border-white/15 text-white/40 hover:border-white/30 hover:text-white/70"
                            }`}>
                            {linked ? "✓ " : ""}{other.name || "Unnamed"}
                          </button>
                        )
                      })}
                    </div>
                    {(feature.linkedTo?.length ?? 0) > 0 && (
                      <p className="text-[9px] text-white/30 italic">Use changes on this feature will mirror to linked features.</p>
                    )}
                  </div>
                )
              })()}

              {/* Multiple bars on one item — e.g. a staff with both "Charges"
                  (the primary tracker above) and a separate "1/Day Recall". */}
              <label className="flex items-center gap-2 text-white/60 cursor-pointer select-none">
                <input type="checkbox" checked={feature.multiTracking ?? false}
                  onChange={e => onChange({ multiTracking: e.target.checked })}
                />
                Track multiple things on this item
              </label>

              {feature.multiTracking && (
                <div className="flex flex-col gap-2">
                  {(feature.trackers ?? []).map(t => (
                    <div key={t.id} className="flex flex-col gap-1.5 bg-white/5 rounded-lg p-2">
                      <div className="flex items-center gap-2">
                        <input value={t.label ?? ""} placeholder="Label (e.g. 1/Day Recall)"
                          onChange={e => changeTracker(t.id, { label: e.target.value })}
                          className="flex-1 min-w-0 bg-transparent outline-none text-xs text-white/80 placeholder:text-white/20 border-b border-white/10 pb-1" />
                        <button type="button" onClick={() => removeTracker(t.id)}
                          className="text-white/20 hover:text-red-400 text-xs shrink-0 transition-colors">✕</button>
                      </div>
                      <div className="flex items-center gap-3 text-xs flex-wrap">
                        <label className="flex items-center gap-1.5 text-white/50">
                          Max
                          {t.maxUsesFormula === "pb" ? (
                            <span className="px-2 py-1 rounded bg-primary/20 text-primary text-xs font-semibold">PB ({pb})</span>
                          ) : (
                            <NumInput value={t.maxUses ?? ""} min={1}
                              onChange={e => changeTracker(t.id, { maxUses: parseInt(e.target.value) || 0 })}
                              className="w-12 bg-white/10 rounded px-2 py-1 text-center text-white outline-none"
                            />
                          )}
                        </label>
                        <label className="flex items-center gap-1.5 text-white/50 cursor-pointer select-none">
                          <input type="checkbox" checked={t.maxUsesFormula === "pb"}
                            onChange={e => changeTracker(t.id, { maxUsesFormula: e.target.checked ? "pb" : undefined, maxUses: e.target.checked ? undefined : (t.maxUses ?? 1) })}
                          />
                          = Prof. Bonus
                        </label>
                        <label className="flex items-center gap-1.5 text-white/50">
                          Resets on
                          <select value={t.resetsOn ?? "long"}
                            onChange={e => changeTracker(t.id, { resetsOn: e.target.value as UseTracker["resetsOn"] })}
                            className="bg-zinc-800 rounded px-2 py-1 text-white outline-none text-xs">
                            <option value="short" className="bg-zinc-800 text-white">Short Rest</option>
                            <option value="long" className="bg-zinc-800 text-white">Long Rest</option>
                            <option value="dawn" className="bg-zinc-800 text-white">Dawn</option>
                            <option value="manual" className="bg-zinc-800 text-white">Manual</option>
                          </select>
                        </label>
                        <label className="flex items-center gap-1.5 text-white/50 cursor-pointer">
                          Bar color
                          <input type="color" value={t.sliderColor ?? "#6366f1"}
                            onChange={e => changeTracker(t.id, { sliderColor: e.target.value })}
                            className="size-4 cursor-pointer rounded border-0 bg-transparent p-0"
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={addTracker}
                    className="text-xs px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors self-start">
                    + Add Tracker
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-white/10 pt-2">
          <button type="button" onClick={onRemove} className="text-xs text-red-400/60 hover:text-red-400 px-1 py-1 transition-colors">Delete</button>
          <button type="button" onClick={() => setEditing(false)} className="text-xs px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors">Done</button>
        </div>
      </div>
    )
  }

  // ── View mode ────────────────────────────────────────────────────────────

  // The style itself (None/Outline/Galaxy) is a sheet-wide Settings choice,
  // not per item — an item only decides whether it's magic at all.
  const magicStar  = feature.isMagicItem && showMagicStar
  const magicStyle = feature.isMagicItem && magicItemStyle !== "none" ? magicItemStyle : null
  const cardStyle  = magicStyle === "galaxy" ? MAGIC_ITEM_BG : undefined

  return (
    <div className={`rounded-xl border overflow-hidden shrink-0 ${magicStyle ? "border-purple-400/50" : "border-white/10"} ${magicStyle === "galaxy" ? "" : theme.box}`}
      style={cardStyle}>

      {/* Header row */}
      <div {...dragAttrs}
        className="flex flex-col px-2.5 py-1.5 cursor-pointer hover:bg-white/5 transition-colors select-none"
        onClick={() => setExpanded(v => !v)}>

        {/* Top row: expand chevron + name + badges (wraps rather than squishing) */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-white/30 shrink-0 w-3">{expanded ? "▼" : "▶"}</span>

          <span className="min-w-24 flex-1 text-sm font-semibold text-white truncate">
            {feature.isContainer && "🎒 "}
            {magicStar && "✨ "}
            {feature.name || <span className="text-white/30 italic">{unnamedLabel}</span>}
          </span>

          {!showItemExtras && feature.source && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full truncate max-w-24 shrink-0 ${classColorClasses(feature.source)}`} title={feature.source}>
              {feature.source}
            </span>
          )}

          {!showItemExtras && feature.level != null && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/50 shrink-0">Lv {feature.level}</span>
          )}

          {showAttunement && feature.requiresAttunement && (
            <label className={`flex items-center gap-1 shrink-0 text-[10px] font-bold cursor-pointer ${theme.color}`} onClick={e => e.stopPropagation()} title="Attuned">
              <input type="checkbox" checked={feature.attuned ?? false} disabled={readOnly}
                onChange={e => onChange({ attuned: e.target.checked })}
                className="size-3.5 accent-white cursor-pointer" />
              Attuned
            </label>
          )}

          {showItemExtras && feature.category !== "armor" && (feature.amount ?? 1) > 1 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/50 shrink-0">×{feature.amount}</span>
          )}

          {/* At the trailing edge, alongside Weight, rather than crowding the
              name — this is the one toggle that also determines Equipped vs
              Carried Items, so it reads better as its own aside than buried mid-row. */}
          {showItemExtras && feature.category === "armor" && (
            <label className={`flex items-center gap-1 shrink-0 text-[10px] font-bold cursor-pointer ${theme.color}`} onClick={e => e.stopPropagation()} title="Equipped">
              <input type="checkbox" checked={feature.equipped ?? false} disabled={readOnly}
                onChange={e => onChange({ equipped: e.target.checked })}
                className="size-3.5 accent-white cursor-pointer" />
              Equip
            </label>
          )}

          {showWeightColumn && (
            <span className="text-[10px] text-white/40 shrink-0 w-14 text-right tabular-nums">
              {feature.weight ? `${feature.weight * (feature.amount ?? 1)} lb` : ""}
            </span>
          )}

          {(feature.linkedTo?.length ?? 0) > 0 && (
            <span className="text-[9px] text-primary/60 shrink-0" title="Synced with other feature(s)">⟳</span>
          )}
        </div>

        {/* Uses-tracking bar — always its own full-width row below the name,
            so it never has to fight the name/badges for space (these cards
            often sit in narrow grid columns, where a viewport-based sm:
            breakpoint would still apply the wide desktop layout). */}
        {hasUses && (
          <div className="flex items-center gap-2 mt-1.5 pl-5" onClick={e => e.stopPropagation()}>
            <TracingSlider
              value={usesRemaining} max={effectiveMax}
              disabled={readOnly} color={feature.sliderColor}
              showButtons buttonSize="sm" className="flex-1 min-w-0"
              onChange={val => onChange({ usesUsed: effectiveMax - val })}
            />
            <span className="text-xs text-white/50 shrink-0 tabular-nums w-8 text-right">
              {usesRemaining}/{effectiveMax}
            </span>
          </div>
        )}
      </div>

      {/* Expanded content */}
      <PopTransition show={expanded}>
        <div className="px-3 pb-2 border-t border-white/5 flex flex-col gap-2">
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {showItemExtras && (feature.equipKind ?? "armor") === "armor" && feature.itemMeta?.armorMode === "base" && feature.itemMeta?.armorBaseAc != null && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/15 text-sky-300">
                AC {feature.itemMeta.armorBaseAc} ({feature.itemMeta.armorDexMode === "none" ? "no dex" : feature.itemMeta.armorDexMode === "half" ? "½ dex" : "full dex"})
              </span>
            )}
            {showItemExtras && (feature.equipKind ?? "armor") === "armor" && (feature.itemMeta?.armorMode ?? "bonus") === "bonus" && !!feature.itemMeta?.acBonus && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/15 text-sky-300">+{feature.itemMeta.acBonus} AC</span>
            )}
            {showItemExtras && feature.equipKind === "weapon" && (
              <DamagePills segments={computeDamageSegments(feature.itemMeta ?? {})} size="xs" />
            )}
            {showItemExtras && feature.equipKind === "weapon" && (
              feature.itemMeta?.weaponKind === "ranged"
                ? feature.itemMeta?.range && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/40">⇒ {feature.itemMeta.range}</span>
                : (feature.itemMeta?.meleeRange || feature.itemMeta?.throwRange) && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/40">
                    {feature.itemMeta?.meleeRange && `↔ ${feature.itemMeta.meleeRange}`}
                    {feature.itemMeta?.meleeRange && feature.itemMeta?.throwRange && " / "}
                    {feature.itemMeta?.throwRange && `⇒ ${feature.itemMeta.throwRange}`}
                  </span>
                )
            )}
            {showItemExtras && !!feature.weight && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/40">{feature.weight} lb</span>
            )}
            {showItemExtras && !!feature.value && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300">{feature.value} gp</span>
            )}
            {showItemExtras && feature.rarity && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${RARITY_COLORS[feature.rarity] ?? "bg-white/10 text-white/40"}`}>{feature.rarity}</span>
            )}
            <div className="flex items-center gap-1 ml-auto">
              {onAddToEquipment && !readOnly && (
                <button type="button" onClick={e => { e.stopPropagation(); onAddToEquipment(feature) }}
                  title={inEquipment ? "Remove from the Martial list" : "Send to the Martial list"}
                  className={`text-[10px] px-2 py-1 rounded-full transition-colors shrink-0 ${
                    inEquipment ? "bg-primary/30 text-primary hover:bg-primary/20" : "bg-white/10 hover:bg-white/20 text-white/60 hover:text-white"
                  }`}>
                  {inEquipment ? "◯ In Martial" : "+ Martial Tab"}
                </button>
              )}
              {onToggleFavorite && (
                <FavoriteStar isFavorite={!!isFavorite} onToggle={onToggleFavorite} label="Favorite" />
              )}
              {!readOnly && (
                <button type="button" onClick={() => setEditing(true)}
                  className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/70 hover:text-white text-sm shrink-0 transition-colors">
                  ✎
                </button>
              )}
            </div>
          </div>
          {feature.description ? (
            <Markdown text={feature.description} tone="dark" />
          ) : !readOnly ? (
            <p className="text-xs text-white/20 italic">No description — click ✎ to add one.</p>
          ) : null}
        </div>
      </PopTransition>
    </div>
  )
}
