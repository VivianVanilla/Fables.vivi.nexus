// ════════════════════════════════════════════════════════════════════════════
// FeatureEntry.tsx — collapsible feature card
//
// Untracked: ▶ Feature Name  [Source]                    [✎]
// Trackable: ▶ Feature Name  [──────slider──────] 2/3 LR  [✎]
// Expanded adds description text below the header row.
// Edit mode: name, source, description, track uses, max (or = PB), resets, links
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState, type CSSProperties } from "react"
import type { Feature, UseTracker } from "@/components/shared/types"
import type { PackItem } from "@/components/documentation/doc-types"
import type { Theme } from "@/components/shared/themes"
import { accentShimmerGradient, darkenHex, hexToRgb } from "@/components/shared/themes"
import { nanoid } from "@/components/shared/utils"
import { TracingSlider } from "../../ui/tracing-slider"
import { MarkdownTextarea } from "../../ui/MarkdownTextarea"
import { Markdown } from "../../ui/Markdown"
import { PopTransition } from "@/components/shared/ui/PopTransition"
import { ScrollHint, useScrollHint } from "@/components/shared/ui/ScrollHint"
import { Modal } from "@/components/shared/ui/Modal"
import { FavoriteStar } from "../ui/FavoriteStar"
import { NumInput } from "@/components/shared/ui/NumInput"
import { DamageEditor, DamagePills } from "../ui/DamageFields"
import { computeToHit, computeWeaponDamageSegments } from "@/components/shared/damageTypes"
import { ITEM_RARITIES, RARITY_COLORS, DEFAULT_ACCENT_COLOR, DEFAULT_RARITY_HEX, type CardStyle } from "@/components/shared/constants"
import { supabase } from "../../../../src/supabase"

// ── Feature suggestion cache — per doc type, per homebrew scope ───────────────

export type SuggestionSource = "race" | "class" | "feat" | "item" | "invocation" | "infusion"

export interface Suggestion {
  name: string
  description: string
  meta?: {
    item_type?: string; damage?: string; damage_type?: string; properties?: string; weight?: number; cost?: string
    prerequisite?: string; class?: string
    rarity?: string; requires_attunement?: boolean
    // Weapon/armor mechanical stats — set on a Documentation "item" entry (see
    // DocEntryForm.tsx's ItemFields) so a magic weapon/armor picked from the
    // suggestion grid autofills fully instead of just name/description/damage.
    weapon_kind?: "melee" | "ranged"; attack_stat?: "str" | "dex" | "con" | "int" | "wis" | "cha"; magic_bonus?: string
    melee_range?: string; throw_range?: string; range?: string
    armor_mode?: "base" | "bonus"; ac_bonus?: number; armor_base_ac?: number; armor_dex_mode?: "full" | "half" | "none"
    stealth_disadvantage?: boolean
    // Set only when item_type is "pack" (e.g. "Explorer's Pack") — see
    // DocEntryForm.tsx's PackItemsField. Picking one of these in the item-
    // suggestion dropdown expands into every item it contains instead of
    // patching the feature currently being edited — see FeatureEntry's
    // suggestion onMouseDown handler and its onAddPack prop.
    pack_items?: PackItem[]
  }
}

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

      // Library homebrew — invocations/infusions have no "add to library" flow
      // (they'd be browsed/created directly in Documentation), so skip this lookup.
      if (docType !== "invocation" && docType !== "infusion") {
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
      if (docType === "invocation" || docType === "infusion") {
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
            weight:       row.data?.weight,
            cost:         row.data?.cost,
            rarity:       row.data?.rarity,
            requires_attunement: row.data?.requires_attunement,
            weapon_kind:  row.data?.weapon_kind,
            attack_stat:  row.data?.attack_stat,
            magic_bonus:  row.data?.magic_bonus,
            melee_range:  row.data?.melee_range,
            throw_range:  row.data?.throw_range,
            range:        row.data?.range,
            armor_mode:   row.data?.armor_mode,
            ac_bonus:     row.data?.ac_bonus,
            armor_base_ac: row.data?.armor_base_ac,
            armor_dex_mode: row.data?.armor_dex_mode,
            stealth_disadvantage: row.data?.stealth_disadvantage,
            pack_items: row.data?.pack_items,
          },
        })
        continue
      }

      const features: any[] = row.data?.features ?? []
      const traits:   any[] = row.data?.traits   ?? []

      features.forEach(f => {
        if (f?.name) results.push({ name: f.name, description: f.description ?? "", meta: { class: row.name } })
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

// Parses a freeform doc "Cost" string ("15 gp", "1,500 gp", "5 sp", "8 cp")
// into a plain gp number for Feature.value — best-effort, undefined if
// nothing parses. Converts sp/cp/pp to their gp equivalent (1 gp = 10 sp =
// 100 cp = 1/10 pp) rather than just stripping the unit, since a lot of
// mundane adventuring gear (candles, rations, tinderboxes…) is priced in sp
// or cp on the source tables — treating "5 sp" as 5 gp would inflate a
// character's carried value 10-100x for exactly the items sold that cheaply.
// Exported for DocEntryForm.tsx's PackItemsField, which autofills a pack
// item's value the same way picking a suggestion does anywhere else.
export function parseGpFromCost(cost?: string): number | undefined {
  if (!cost) return undefined
  const m = cost.replace(/,/g, "").match(/([\d.]+)\s*(pp|gp|sp|cp)?/i)
  if (!m) return undefined
  const n = parseFloat(m[1])
  if (!Number.isFinite(n)) return undefined
  const rate: Record<string, number> = { pp: 10, gp: 1, sp: 0.1, cp: 0.01 }
  return n * (rate[(m[2] ?? "gp").toLowerCase()] ?? 1)
}

function capitalizeRarity(raw?: string): Feature["rarity"] {
  if (!raw) return undefined
  const cap = raw.replace(/\b\w/g, c => c.toUpperCase())
  return (ITEM_RARITIES as readonly string[]).includes(cap) ? (cap as Feature["rarity"]) : undefined
}

// Item suggestions (docType "item") carry full weapon/armor mechanical stats
// (see DocEntryForm.tsx's ItemFields) — picking one should autofill this
// item all the way to "ready to use" instead of just name/description/damage,
// including flipping it from a bare "Generic Item" into a properly-typed
// weapon/armor entry (category/equipKind) the way picking a real weapon off
// a shelf would. Only fires for suggestionSource "item" — other sources
// (race/class/feat/invocation/infusion) never carry this shape of meta.
export function itemPatchFromSuggestion(suggestionSource: SuggestionSource | undefined, s: Suggestion, feature: Feature): Partial<Feature> {
  if (suggestionSource !== "item" || !s.meta) return {}
  const m = s.meta
  const isWeapon = m.item_type === "weapon"
  const isArmor  = m.item_type === "armor"
  const patch: Partial<Feature> = {}
  if (isWeapon || isArmor) {
    patch.category  = "armor" // "Armor & Equipment" section — covers weapons too, via equipKind below
    patch.equipKind = isWeapon ? "weapon" : "armor"
  }
  const rarity = capitalizeRarity(m.rarity)
  if (rarity) patch.rarity = rarity
  if (m.requires_attunement != null) patch.requiresAttunement = m.requires_attunement
  if (m.rarity && m.rarity !== "common") patch.isMagicItem = true
  if (m.weight != null) patch.weight = m.weight
  const value = parseGpFromCost(m.cost)
  if (value != null) patch.value = value
  patch.itemMeta = {
    ...feature.itemMeta,
    itemType: m.item_type, damage: m.damage, damageType: m.damage_type, properties: m.properties,
    ...(isWeapon ? {
      weaponKind: m.weapon_kind, attackStat: m.attack_stat, magicBonus: m.magic_bonus,
      meleeRange: m.melee_range, throwRange: m.throw_range, range: m.range,
    } : {}),
    ...(isArmor ? {
      armorMode: m.armor_mode, acBonus: m.ac_bonus, armorBaseAc: m.armor_base_ac,
      armorDexMode: m.armor_dex_mode, stealthDisadvantage: m.stealth_disadvantage,
    } : {}),
  }
  return patch
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
  statMods?:        Record<string, number>  // ability modifiers by short key ("str","dex",...) — weapon to-hit/damage math, only meaningful when showItemExtras && equipKind === "weapon"
  suggestionSource?: SuggestionSource  // which doc type to autocomplete from
  userId?:          string | null
  isFavorite?:       boolean
  onToggleFavorite?: () => void        // omit to hide the star
  onAddPack?:        (packItems: PackItem[]) => void  // only wired for the Items tab — replaces this (in-progress) feature with every item a picked pack suggestion contains
  showAttunement?:   boolean            // only true for the Items tab — shows the "Requires Attunement" toggle, and the "Attuned" checkbox once that's on
  showInfusedToggle?: boolean           // only true for the Infusions list — shows an "Infused" checkbox, no gating field needed (every infusion is eligible, unlike Attuned which needs requiresAttunement first). Also unlocks the infusion config block in edit mode (standalone / on-me / Form + Conditional links).
  infusionInventoryEnabled?: boolean    // Settings → "Infusions in inventory" — only then does an infused infusion get an "Equip" toggle (Equipped vs Carried); off = infusions never enter Gear so the toggle would be meaningless
  formOptions?:      { id: string; name: string }[]  // Infusions list only — Forms an infusion can activate while active-on-self (feature.triggerFormId)
  conditionalOptions?: { id: string; name: string }[]  // Infusions list only — Conditionals an infusion can trigger when it becomes active (feature.triggerConditionalId)
  weaponFormBonus?: { toHit: number; damage: number }  // weapon rows only — flat to-hit/damage from any active Form (FormStatOverrides.weaponToHitBonus/weaponDamageBonus); folded into the displayed/computed to-hit & damage, not persisted
  showItemExtras?:   boolean            // only true for the Items tab — shows Equipped / AC Bonus / Weight
  showWeightColumn?: boolean            // only true for the Carried Items list — shows the item's own weight right in the collapsed header, not just when expanded
  containerOptions?: { id: string; name: string }[]  // Carried Items only — other containers this item could be moved into; omit/empty hides the control
  onMoveToContainer?: (containerId: string | undefined) => void  // Carried Items only — button-based fallback for the drag-and-drop reparenting ContainerItemsList's handleDrop does, since touch drag can be unreliable on mobile
  containerContentsOpen?: boolean       // Carried Items only, containers only — whether this container's held items are currently shown below it; omit to hide the toggle button entirely
  onToggleContainerContents?: () => void // Carried Items only, containers only — flips containerContentsOpen
  showMagicStar?:    boolean            // Settings toggle (default true) — the "✨" badge on items flagged Magic Item
  magicItemStyle?:   CardStyle          // Settings choice (default "galaxy") — sheet-wide card background for items flagged Magic Item; "galaxy" is labeled "Background" in Settings — the item's own raw color, animated
  magicItemColor?:   string             // Settings — accent color for magicItemStyle/magicItemSliderStyle, default DEFAULT_ACCENT_COLOR — also the fallback whenever magicItemColorsByRarity is on but this item's own rarity has no color set
  magicItemSliderStyle?: CardStyle      // Settings choice (default "none") — separate look for magic items' own "Track uses" bars, independent of the card background above
  magicItemColorsByRarity?: boolean  // Settings — when true, a magic item's card/border color comes from its own `rarity` (magicItemRarityColors) instead of the one flat magicItemColor
  magicItemRarityColors?: Partial<Record<NonNullable<Feature["rarity"]>, string>>  // Settings — card/border color per rarity tier, only used when magicItemColorsByRarity is on
  magicItemRaritySliderColors?: Partial<Record<NonNullable<Feature["rarity"]>, string>>  // Settings — this rarity tier's own "Track uses" bar color — falls back to magicItemRarityColors when unset, same fallback pattern as favoriteCategorySliderColors
  accentColor?:      string             // Settings — this feature's category color (Feature Stylings); resolved by the caller from its category (race/class/feat/invocation), applies everywhere it's rendered, not just Favorites
  accentStyle?:      CardStyle          // Settings — "none" (default), "outline", or "galaxy" ("Background" — the category's own raw color, animated) for the category card background above
  sliderStyle?:      CardStyle          // Settings — separate look for this category's own "Track uses" bars, independent of accentStyle (the card background)
  tagTextColor?:     "black" | "white"   // Settings — global (not per-category) override for the small source tag (class/race name) AND "Lv N" badge text color — omit/undefined keeps each badge's own existing background+text color as-is
  bodyTextColor?:    "black" | "white"   // Settings — global override for this card's own description text color — omit/undefined keeps the default
  sliderColor?:      string             // Settings — color of this category's own "Track uses" bars, independent of accentColor above — falls back to accentColor when unset
  autoEdit?:         boolean            // open the edit form immediately (newly-added feature/item) — same pattern as SpellEntry.tsx
  onAutoEditConsumed?: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Renders a card's chosen accent color as its own solid background fill —
// the raw picked color, exactly as picked. Tried an animated shine sweep,
// then a static diagonal sheen; both got cut.
//
// When Settings' Background Image is active, this also shows through —
// tinted with THIS card's own color (not the sheet theme's), so a red magic
// item stays visibly red instead of picking up whatever the plain-themed
// cards are tinted. --fables-shared-bg-image/-size/-repeat are set once on
// CharacterSheet.tsx's root and inherit down to every descendant via plain
// CSS custom-property inheritance — no prop needs threading through every
// list component between there and here to reach this. When no image is
// active those variables are simply unset, var()'s fallback resolves to
// "none" for the image layer, and the result is pixel-identical to the
// plain flat color this always used to be.
export function coloredNebulaBg(color: string): CSSProperties {
  const [r, g, b] = hexToRgb(color)
  const tint = `rgba(${r}, ${g}, ${b}, 0.75)`
  return {
    backgroundColor: color,
    backgroundImage: `linear-gradient(${tint}, ${tint}), var(--fables-shared-bg-image, none)`,
    backgroundSize: `100% 100%, var(--fables-shared-bg-size, cover)`,
    backgroundRepeat: `no-repeat, var(--fables-shared-bg-repeat, no-repeat)`,
    backgroundAttachment: `scroll, var(--fables-shared-bg-attachment, scroll)`,
    backgroundPosition: `center, var(--fables-shared-bg-position, center)`,
  }
}

function isAnimatedStyle(style?: CardStyle | null): boolean {
  return style === "galaxy"
}

// Shared with SpellEntry.tsx and FamiliarsTab.tsx's inline card — one
// formula for the category accent so it renders identically everywhere a
// category color/style is applied, not just Favorites.
//
// Sets both a plain `borderColor` (cards styled with a `border` class, e.g.
// FeatureEntry/SpellEntry) and Tailwind's `--tw-ring-color`
// custom property (cards styled with a `ring` class instead, e.g. the shared
// `card` className used by FamiliarsTab) — whichever one the target actually
// has a utility class for is the one that visibly picks it up, the other is
// inert. Deliberately no blur/glow: in a dense list where cards sit only a
// few px apart, a blurred box-shadow bleeds into the gap and makes
// neighboring cards' edges melt into each other, whereas a solid border/ring
// color never blurs, so the seam between cards stays visible no matter how
// tightly packed the list is.
export function categoryAccentStyle(color?: string, style?: CardStyle): CSSProperties | undefined {
  if (!color || !style || style === "none") return undefined
  // "Background" fills the whole card in the raw color — a border in that
  // SAME color would sit right on top of its own fill with no edge at all,
  // so it's darkened 20% instead, for an actual outline. "Outline" has no
  // fill to blend into, so it keeps the exact picked color.
  const borderColor = isAnimatedStyle(style) ? darkenHex(color, 0.2) : color
  const base = { borderColor, "--tw-ring-color": borderColor } as CSSProperties
  return isAnimatedStyle(style) ? { ...base, ...coloredNebulaBg(color) } : base
}

// A "manual" tracker has no periodic Rest to regain it, so recovering more
// than one at a time otherwise means clicking the slider bar by bar — this
// is the same step-then-apply shape the HP +/- stepper uses (CharacterSheet
// .tsx), just a single "Regain" direction instead of separate damage/heal,
// since spending is already what the slider itself does.
function BulkRegainRow({ label, onRegain }: { label?: string; onRegain: (amount: number) => void }) {
  const [step, setStep] = useState(1)
  return (
    <div className="flex items-center gap-2 pl-5" onClick={e => e.stopPropagation()}>
      {label && <span className="text-[10px] text-white/40 shrink-0 w-20 truncate">{label}</span>}
      <NumInput value={step} onFocus={e => e.target.select()}
        onChange={e => setStep(Math.max(1, parseInt(e.target.value) || 1))} min={1}
        className="w-12 text-center text-xs bg-white/10 rounded px-2 py-1 text-white outline-none" />
      <button type="button" onClick={() => { onRegain(step); setStep(1) }}
        className="text-[10px] px-2.5 py-1 rounded-full bg-white/10 hover:bg-green-900 text-white/70 hover:text-green-200 font-semibold transition-colors">
        + Regain
      </button>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FeatureEntry({
  feature, allFeatures, onChange, onRemove, onLinkToggle, theme, readOnly = false, pb, statMods = {}, suggestionSource, userId,
  isFavorite, onToggleFavorite, onAddPack, showAttunement, showInfusedToggle, infusionInventoryEnabled, showItemExtras, showWeightColumn,
  formOptions, conditionalOptions, weaponFormBonus,
  containerOptions, onMoveToContainer, containerContentsOpen, onToggleContainerContents,
  showMagicStar = true, magicItemStyle = "galaxy", magicItemColor, magicItemSliderStyle,
  magicItemColorsByRarity, magicItemRarityColors, magicItemRaritySliderColors,
  accentColor, accentStyle, sliderStyle, tagTextColor, bodyTextColor, sliderColor, autoEdit = false, onAutoEditConsumed,
}: FeatureEntryProps) {
  const [expanded,    setExpanded]    = useState(false)
  const [editing,     setEditing]     = useState(autoEdit)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showSuggest, setShowSuggest] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)
  // A very long description scrolls inside a height cap instead of ballooning
  // the card off-screen; the cue shows when there's more below the fold.
  const { ref: descRef, hasMore: descHasMore } = useScrollHint<HTMLDivElement>()
  // Set while a use is being spent on a feature with triggerVariants (see
  // Automation's "multiple possible effects" — Enhance Ability, etc.) —
  // holds the usesUsed value the slider was about to commit, until a
  // variant is actually chosen below.
  const [pendingVariantUses, setPendingVariantUses] = useState<number | null>(null)

  const namePlaceholder = showItemExtras ? "Item name" : "Feature name"
  const unnamedLabel    = showItemExtras ? "Unnamed Item" : "Unnamed"

  useEffect(() => {
    if (autoEdit) onAutoEditConsumed?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
                    // A pack suggestion ("Explorer's Pack") doesn't fill in this
                    // feature's own fields — it replaces it with every item the
                    // pack contains, each its own singular-named Feature.
                    if (s.meta?.item_type === "pack" && s.meta.pack_items && onAddPack) {
                      onAddPack(s.meta.pack_items)
                      setShowSuggest(false)
                      return
                    }
                    const desc = s.meta?.prerequisite
                      ? `*Prerequisite: ${s.meta.prerequisite}*\n\n${s.description}`
                      : (s.description || feature.description)
                    onChange({ name: s.name, description: desc, ...itemPatchFromSuggestion(suggestionSource, s, feature) })
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

        {suggestionSource === "invocation" && (
          <label className="flex items-center gap-2 text-xs text-emerald-300/90 cursor-pointer select-none border-t border-white/10 pt-2" title="Doesn't count toward Invocations Known">
            <input type="checkbox" checked={feature.freeInvocation ?? false}
              onChange={e => onChange({ freeInvocation: e.target.checked })}
              className="accent-emerald-500" />
            Not counted toward Invocations Known
          </label>
        )}

        {/* Infusion config (Artificer's Infusions list) — what kind of thing
            this infusion is, and what it does for the character while it's
            infused + on them. */}
        {showInfusedToggle && (
          <div className="flex flex-col gap-2.5 text-xs border-t border-white/10 pt-2">
            <div className="flex flex-col gap-2">
              <label className="flex items-start gap-2 text-white/60 cursor-pointer select-none">
                <input type="checkbox" className="mt-0.5" checked={feature.infusionTrackLocation ?? false}
                  onChange={e => onChange({ infusionTrackLocation: e.target.checked })} />
                <span>
                  Track where this is
                  <span className="block text-[10px] text-white/30">Turn on if the infused item might not be on you. Off = assumed to be on you.</span>
                </span>
              </label>
              {feature.infusionTrackLocation && (
                <div className="pl-6 flex flex-col gap-1.5">
                  <div className="flex items-center gap-1 rounded-full bg-white/10 p-0.5 w-fit text-[11px]">
                    <button type="button" onClick={() => onChange({ infusionOnSelf: true, infusionHeldBy: undefined })}
                      className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${(feature.infusionOnSelf ?? true) ? "bg-sky-500/30 text-sky-200" : "text-white/40 hover:text-white/70"}`}>
                      On me
                    </button>
                    <button type="button" onClick={() => onChange({ infusionOnSelf: false })}
                      className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${!(feature.infusionOnSelf ?? true) ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70"}`}>
                      Given away
                    </button>
                  </div>
                  {!(feature.infusionOnSelf ?? true) && (
                    <label className="flex items-center gap-1.5 text-white/50">
                      Held by
                      <input value={feature.infusionHeldBy ?? ""} placeholder="e.g. Liam"
                        onChange={e => onChange({ infusionHeldBy: e.target.value || undefined })}
                        className="flex-1 min-w-0 bg-white/10 rounded px-2 py-1 text-white outline-none placeholder:text-white/20" />
                    </label>
                  )}
                  <span className="text-[10px] text-white/30">The weapon bonus and Form/Conditional below only apply while it's on you.</span>
                </div>
              )}
            </div>

            {/* ── What this infusion does while it's active ────────────────
                "Active" = Infused, and (if location tracking is on) on you.
                Point it at a Form (or Conditional) built in Automation — that's
                where the actual bonuses live: +to-hit / +damage for your
                weapons, AC, resistances, ability scores, skill bonuses,
                granted conditions. It activates and reverts with the infusion. */}
            {((formOptions?.length ?? 0) > 0 || (conditionalOptions?.length ?? 0) > 0) && (
              <div className="flex flex-col gap-1.5 border-t border-white/10 pt-2">
                <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">While active</span>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  {(formOptions?.length ?? 0) > 0 && (
                    <label className="flex items-center gap-1.5 text-white/50 whitespace-nowrap">
                      Activate Form
                      <select value={feature.triggerFormId ?? ""}
                        onChange={e => onChange({ triggerFormId: e.target.value || undefined })}
                        className="bg-zinc-800 rounded px-2 py-1 text-white outline-none text-xs max-w-40">
                        <option value="" className="bg-zinc-800 text-white">— None —</option>
                        {(formOptions ?? []).map(f => (
                          <option key={f.id} value={f.id} className="bg-zinc-800 text-white">{f.name}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  {(conditionalOptions?.length ?? 0) > 0 && (
                    <label className="flex items-center gap-1.5 text-white/50 whitespace-nowrap">
                      Trigger Conditional
                      <select value={feature.triggerConditionalId ?? ""}
                        onChange={e => onChange({ triggerConditionalId: e.target.value || undefined })}
                        className="bg-zinc-800 rounded px-2 py-1 text-white outline-none text-xs max-w-40">
                        <option value="" className="bg-zinc-800 text-white">— None —</option>
                        {(conditionalOptions ?? []).map(c => (
                          <option key={c.id} value={c.id} className="bg-zinc-800 text-white">{c.name}</option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
                <p className="text-[10px] text-white/30">
                  The Form carries the numbers — +to-hit / +damage for your weapons, AC, resistances, skills — and turns on and off with the infusion. Build it in Automation → Forms first.
                </p>
              </div>
            )}
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
              {feature.category === "armor" && !showInfusedToggle && (
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
                  <label className="flex items-center gap-2 text-white/50 cursor-pointer select-none whitespace-nowrap">
                    <input type="checkbox" checked={feature.trackAmount ?? false}
                      onChange={e => onChange({ trackAmount: e.target.checked })}
                      className="accent-white"
                    />
                    Track Multiple (adds a −/+ counter)
                  </label>
                  <PopTransition show={!!feature.trackAmount}>
                    <label className="flex items-center gap-1.5 text-white/50 whitespace-nowrap">
                      Amount
                      <NumInput min={1} value={feature.amount ?? 1}
                        onChange={e => onChange({ amount: Math.max(1, parseInt(e.target.value) || 1) })}
                        className="w-14 bg-white/10 rounded px-2 py-1 text-center text-white outline-none" />
                    </label>
                  </PopTransition>
                  <label className="flex items-center gap-2 text-amber-300 cursor-pointer select-none whitespace-nowrap">
                    <input type="checkbox" checked={feature.isContainer ?? false}
                      onChange={e => onChange({ isContainer: e.target.checked })}
                      className="accent-amber-500"
                    />
                    Is a Container (drag items onto it to store them)
                  </label>
                  <PopTransition show={!!feature.isContainer} className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-1.5 text-white/50 whitespace-nowrap">
                      Max Weight (lb)
                      <NumInput min={0} step="0.1" value={feature.maxWeight ?? ""}
                        onChange={e => onChange({ maxWeight: e.target.value ? parseFloat(e.target.value) || 0 : undefined })}
                        placeholder="—"
                        className="w-16 bg-white/10 rounded px-2 py-1 text-center text-white outline-none" />
                    </label>
                    <label className="flex items-center gap-2 text-emerald-300 cursor-pointer select-none whitespace-nowrap">
                      <input type="checkbox" checked={feature.containerIgnoresWeight ?? false}
                        onChange={e => onChange({ containerIgnoresWeight: e.target.checked })}
                        className="accent-emerald-500"
                      />
                      Don't count contained items' weight (Bag of Holding)
                    </label>
                  </PopTransition>
                </div>
              </PopTransition>

              {/* Fallback for dragging this item into/out of a container —
                  touch drag-and-drop is unreliable on some mobile browsers,
                  so this button-based move is always available too. */}
              {containerOptions && containerOptions.length > 0 && (
                <label className="flex items-center gap-1.5 text-white/50 whitespace-nowrap">
                  Store in
                  <select value={feature.parentId ?? ""}
                    onChange={e => onMoveToContainer?.(e.target.value || undefined)}
                    className="bg-zinc-800 rounded px-2 py-1 text-white outline-none">
                    <option value="" className="bg-zinc-800 text-white">— Top Level —</option>
                    {containerOptions.map(c => (
                      <option key={c.id} value={c.id} className="bg-zinc-800 text-white">{c.name || "Unnamed"}</option>
                    ))}
                  </select>
                </label>
              )}

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
              <label className="flex items-center gap-1.5 text-xs text-white/50">
                Bar label
                <input value={feature.trackerLabel ?? ""} placeholder={feature.multiTracking ? "e.g. Charges" : "optional"}
                  onChange={e => onChange({ trackerLabel: e.target.value })}
                  className="flex-1 min-w-0 bg-white/10 rounded px-2 py-1 text-white outline-none placeholder:text-white/20" />
              </label>
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
                {/* Only "manual" trackers get a bulk-regain stepper — short/
                    long/dawn already regain fully via Rest; "manual" is the
                    one case with no automatic recovery at all, so a wand
                    that comes back "1d6 charges, whenever" needs its own way
                    to apply more than one at a time instead of clicking the
                    slider bar by bar. */}
                {feature.resetsOn === "manual" && (
                  <label className="flex items-center gap-1.5 text-white/50 cursor-pointer select-none">
                    <input type="checkbox" checked={feature.manualBulkRegain ?? false}
                      onChange={e => onChange({ manualBulkRegain: e.target.checked })}
                    />
                    Bulk regain
                  </label>
                )}
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
                        {t.resetsOn === "manual" && (
                          <label className="flex items-center gap-1.5 text-white/50 cursor-pointer select-none">
                            <input type="checkbox" checked={t.manualBulkRegain ?? false}
                              onChange={e => changeTracker(t.id, { manualBulkRegain: e.target.checked })}
                            />
                            Bulk regain
                          </label>
                        )}
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
  // Source tag + "Lv N" badge — a plain monochrome pill driven entirely by
  // the sheet-wide Text Color switch (Settings' Modules and Font Size),
  // same as the rest of the sheet's text. No more per-class palette here —
  // that's the one piece of "customization" for tags this switch replaced.
  const tagBadgeClass = tagTextColor === "black" ? "bg-black/10 text-black" : "bg-white/10 text-white"

  const magicStar  = feature.isMagicItem && showMagicStar
  const magicStyle = feature.isMagicItem && magicItemStyle !== "none" ? magicItemStyle : null
  // "Separate color per rarity" (Settings' Magical Items row) — this item's
  // own rarity picks its color instead of the one flat magicItemColor, when
  // it's on and this item actually has a rarity set. Falls back to
  // DEFAULT_RARITY_HEX (the SAME preset Settings' swatch grid shows for that
  // tier) before ever falling back to the flat color — otherwise a tier
  // nobody has explicitly repicked yet would silently keep showing the old
  // flat accent instead of the preset its own swatch displays.
  const resolvedMagicCardColor = magicItemColorsByRarity && feature.rarity
    ? (magicItemRarityColors?.[feature.rarity] ?? DEFAULT_RARITY_HEX[feature.rarity])
    : magicItemColor
  const resolvedMagicSliderColor = magicItemColorsByRarity && feature.rarity
    ? (magicItemRaritySliderColors?.[feature.rarity] ?? magicItemRarityColors?.[feature.rarity] ?? DEFAULT_RARITY_HEX[feature.rarity])
    : magicItemColor
  const cardStyle  = isAnimatedStyle(magicStyle) ? coloredNebulaBg(resolvedMagicCardColor ?? DEFAULT_ACCENT_COLOR) : undefined
  // Same reasoning as categoryAccentStyle below: "Background" fills the card
  // in the raw color, so its border needs to be darker than that fill to
  // read as an edge at all — "Outline" has no fill to blend into, so it
  // keeps the exact picked color.
  const resolvedMagicBorderColor = isAnimatedStyle(magicStyle)
    ? darkenHex(resolvedMagicCardColor ?? DEFAULT_ACCENT_COLOR, 0.2)
    : (resolvedMagicCardColor ?? DEFAULT_ACCENT_COLOR)

  // Uses-tracking bar look is its own Settings choice per category (Feature
  // Stylings — "Tracking Slider" row), so it CAN be set independently of the
  // card background above — but until someone actually opens that control
  // and picks something, it mirrors the Background choice (falls back to
  // accentStyle/magicItemStyle) rather than silently defaulting to "off".
  // That way turning on a category's Background + color colors everything
  // (border, card, bar) immediately, the way picking one color for a row is
  // expected to; Tracking Slider only needs touching to diverge from that.
  // feature.isMagicItem is the same direct switch the card background/border
  // above uses to pick magicItem* vs accent*/category props — deliberately
  // NOT inferred from whether accentColor/accentStyle happen to be defined,
  // since a feature can be both magic-flagged AND category-styled at once.
  const sliderSource = feature.isMagicItem
    ? { style: magicItemSliderStyle ?? magicItemStyle, color: resolvedMagicSliderColor ?? DEFAULT_ACCENT_COLOR }
    : { style: sliderStyle ?? accentStyle, color: sliderColor ?? accentColor }
  // "Hue Shift" (the animated Tracking Slider style) — an iridescent hue cycle
  // on the bar, distinct from spell slots' brightness sweep.
  const barHueShift = isAnimatedStyle(sliderSource.style) && !!sliderSource.color
  // A picked Slider/Card color always colors the tracking bar — for magic
  // items AND category-styled ones alike. Setting the "Tracking Slider"
  // module to None turns off the fancy border/background treatment; it was
  // ALSO throwing away the chosen color and snapping the bar back to generic
  // indigo, so a category where you'd picked a red slider swatch but left
  // the module style None just showed indigo bars with no hint why. Both
  // `sliderColor` and `accentColor` are undefined until a swatch is actually
  // touched in Settings, so an un-customized category still falls through to
  // the indigo default exactly as before.
  const barColor = sliderSource.color ?? "#6366f1"

  // Live to-hit/damage — same math as the old Martial-only EquipmentEntry,
  // now computed here too since a weapon is one record shown in both places.
  const isWeapon    = showItemExtras && feature.equipKind === "weapon"
  const weaponMeta  = feature.itemMeta ?? {}
  // A flat to-hit/damage buff from any active Form (Enhanced Weapon infusion
  // links to one; also Rage/Bless-style buffs). Applied to every weapon on the
  // sheet while the form is up — display/calc only, never persisted.
  const formToHit   = weaponFormBonus?.toHit ?? 0
  const formDamage  = weaponFormBonus?.damage ?? 0
  const toHit       = isWeapon ? computeToHit(weaponMeta, statMods, pb, formToHit) : null
  const dmgSegments = isWeapon ? computeWeaponDamageSegments(weaponMeta, statMods, formDamage) : []

  function toHitBreakdown(): string {
    if (!weaponMeta.attackStat) return toHit ?? ""
    const parts: string[] = []
    const mod = statMods[weaponMeta.attackStat] ?? 0
    parts.push(`(${weaponMeta.attackStat.toUpperCase()}) ${mod}`)
    if (weaponMeta.proficient) parts.push(`(Proficiency) ${pb} `)
    const magic = weaponMeta.magicBonus ? parseInt(weaponMeta.magicBonus.replace(/\+/, ""), 10) || 0 : 0
    if (magic) parts.push(`Magic +${magic}`)
    if (weaponMeta.extraToHit) parts.push(`(Extra) ${weaponMeta.extraToHit}`)
    if (formToHit) parts.push(`(Form) ${formToHit}`)
    return parts.join(" + ").replace(/\+ -/g, "− ")
  }

  return (
    <div className={`rounded-xl border-2 overflow-hidden shrink-0 ${magicStyle ? "" : "border-white/10"} ${isAnimatedStyle(magicStyle) ? "" : theme.box}`}
      style={{
        ...cardStyle,
        ...(magicStyle ? { borderColor: resolvedMagicBorderColor } : {}),
        ...categoryAccentStyle(accentColor, accentStyle),
      }}>

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

          {showItemExtras && feature.isContainer && feature.containerIgnoresWeight && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 shrink-0" title="Items placed inside don't count toward carried weight">
              ♾ Weightless
            </span>
          )}

          {/* Quick confirm the infusion's linked automation is live. Dimmed
              when it's infused but off-you. */}
          {showInfusedToggle && feature.infused && (feature.triggerFormId || feature.triggerConditionalId) && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${feature.infusionTrackLocation && !(feature.infusionOnSelf ?? true) ? "bg-white/5 text-white/30" : "bg-violet-500/20 text-violet-200"}`}
              title="This infusion's linked Form/Conditional is active">
              ⚙ auto
            </span>
          )}

          {!showItemExtras && feature.source && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full truncate max-w-24 shrink-0 ${tagBadgeClass}`}
              title={feature.source}
            >
              {feature.source}
            </span>
          )}

          {!showItemExtras && feature.level != null && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${tagBadgeClass}`}>
              Lv {feature.level}
            </span>
          )}

          {suggestionSource === "invocation" && feature.freeInvocation && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0 bg-emerald-500/15 text-emerald-300" title="Granted for free — not counted toward Invocations Known">
              Free
            </span>
          )}

          {showAttunement && feature.requiresAttunement && (
            <label className={`flex items-center gap-1 shrink-0 text-[10px] font-bold cursor-pointer ${theme.color}`} onClick={e => e.stopPropagation()} title="Attuned">
              <input type="checkbox" checked={feature.attuned ?? false} disabled={readOnly}
                onChange={e => onChange({ attuned: e.target.checked })}
                className="size-3.5 accent-white cursor-pointer" />
              Attuned
            </label>
          )}

          {showInfusedToggle && (
            <label className="flex items-center gap-1 shrink-0 text-[10px] font-bold cursor-pointer text-amber-300" onClick={e => e.stopPropagation()} title="Infused — currently imbued into an item">
              <input type="checkbox" checked={feature.infused ?? false} disabled={readOnly}
                onChange={e => onChange({ infused: e.target.checked })}
                className="size-3.5 accent-amber-500 cursor-pointer" />
              Infused
            </label>
          )}

          {/* Only when you've opted into location tracking AND handed it off —
              an at-a-glance "who has this", click to take it back. An infusion
              that's on you (the normal case) shows nothing extra here. */}
          {showInfusedToggle && feature.infused && feature.infusionTrackLocation && !(feature.infusionOnSelf ?? true) && (
            <button type="button" disabled={readOnly}
              onClick={e => { e.stopPropagation(); onChange({ infusionOnSelf: true }) }}
              title="Given to someone else — its bonus/automation are off. Click to take it back."
              className="flex items-center gap-1 shrink-0 text-[10px] font-bold rounded-full px-1.5 py-0.5 bg-white/10 text-white/50 hover:text-white/80 transition-colors">
              → {feature.infusionHeldBy?.trim() || "given away"}
            </button>
          )}

          {showItemExtras && (feature.equipKind ?? "armor") === "armor" && feature.itemMeta?.armorMode === "base" && feature.itemMeta?.armorBaseAc != null && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${tagBadgeClass}`}>
              AC {feature.itemMeta.armorBaseAc} ({feature.itemMeta.armorDexMode === "none" ? "no dex" : feature.itemMeta.armorDexMode === "half" ? "½ dex" : "full dex"})
            </span>
          )}
          {showItemExtras && (feature.equipKind ?? "armor") === "armor" && (feature.itemMeta?.armorMode ?? "bonus") === "bonus" && !!feature.itemMeta?.acBonus && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${tagBadgeClass}`}>+{feature.itemMeta.acBonus} AC</span>
          )}

          {/* Passive readout only — expand the card to actually change it
              (see the −/+ stepper in the expanded view below). */}
          {showItemExtras && feature.category !== "armor" && feature.trackAmount && (feature.amount ?? 1) > 1 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/50 shrink-0">×{feature.amount}</span>
          )}

          {/* At the trailing edge, alongside Weight, rather than crowding the
              name — this toggle also determines which list the item sits in
              (Equipped vs Carried), so it reads better as its own aside. For
              an armour item it defaults off; for an infused infusion shown in
              the inventory (Settings → "Infusions in inventory") it defaults ON
              — you infuse something to wear it — and moves it between the two
              lists. */}
          {showItemExtras && ((showInfusedToggle && feature.infused && infusionInventoryEnabled) || (!showInfusedToggle && feature.category === "armor")) && (
            <label className={`flex items-center gap-1 shrink-0 text-[10px] font-bold cursor-pointer ${theme.color}`} onClick={e => e.stopPropagation()} title={showInfusedToggle ? "Equipped — uncheck to move it to Carried Items" : "Equipped"}>
              <input type="checkbox" checked={feature.equipped ?? !!showInfusedToggle} disabled={readOnly}
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

          {onToggleContainerContents && (
            <button type="button" onClick={e => { e.stopPropagation(); onToggleContainerContents() }}
              title={containerContentsOpen ? "Hide items in this container" : "Show items in this container"}
              className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-white/50 hover:text-white transition-colors shrink-0">
              {containerContentsOpen ? "Hide Items" : "Show Items"}
            </button>
          )}

          {(feature.linkedTo?.length ?? 0) > 0 && (
            <span className="text-[9px] text-primary/60 shrink-0" title="Synced with other feature(s)">⟳</span>
          )}
        </div>

        {/* Weapon quick facts — own full-width row below the name, same
            two-tier layout the old Martial-only card used (name on top,
            facts below) instead of crowding into the top row with the
            chevron/attunement/etc. Reads exactly the same whether it's
            showing in Gear or Martial — same record, same badges, same
            order (see damageTypes.ts's shared computeToHit/computeWeaponDamageSegments). */}
        {isWeapon && (
          <div className="flex items-center gap-1.5 mt-1 pl-5 flex-wrap">
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 text-white/60 capitalize shrink-0">{feature.itemMeta?.weaponKind ?? "melee"}</span>
            {weaponMeta.magicBonus && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold shrink-0">{weaponMeta.magicBonus}</span>
            )}
            {toHit && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 shrink-0" title={(formToHit || formDamage) ? "Includes an active Form's weapon bonus" : undefined}>{toHit} to hit</span>
            )}
            <DamagePills segments={dmgSegments} size="sm" />
            {feature.itemMeta?.weaponKind === "ranged"
              ? feature.itemMeta?.range && <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 text-white/60 shrink-0">⇒ {feature.itemMeta.range}</span>
              : (feature.itemMeta?.meleeRange || feature.itemMeta?.throwRange) && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 text-white/60 shrink-0">
                  {feature.itemMeta?.meleeRange && `↔ ${feature.itemMeta.meleeRange}`}
                  {feature.itemMeta?.meleeRange && feature.itemMeta?.throwRange && " / "}
                  {feature.itemMeta?.throwRange && `⇒ ${feature.itemMeta.throwRange}`}
                </span>
              )}
            {feature.itemMeta?.properties && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 text-white/45 italic shrink-0">{feature.itemMeta.properties}</span>
            )}
            {!showWeightColumn && !!feature.weight && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 text-white/40 shrink-0">{feature.weight} lb</span>
            )}
          </div>
        )}

        {/* Uses-tracking bar — always its own full-width row below the name,
            so it never has to fight the name/badges for space (these cards
            often sit in narrow grid columns, where a viewport-based sm:
            breakpoint would still apply the wide desktop layout). */}
        {hasUses && (
          <div className="flex items-center gap-2 mt-1.5 pl-5" onClick={e => e.stopPropagation()}>
            {feature.trackerLabel && <span className="text-[10px] text-white/40 shrink-0 w-20 truncate">{feature.trackerLabel}</span>}
            <TracingSlider
              value={usesRemaining} max={effectiveMax}
              disabled={readOnly}
              color={barHueShift ? accentShimmerGradient(barColor) : barColor}
              animated={barHueShift} shimmer="hue"
              showButtons buttonSize="sm" className="flex-1 min-w-0"
              onChange={val => {
                const nextUsed = effectiveMax - val
                // Only pause for a picker when a use is actually being
                // spent (usesUsed going up) — dragging back up to refund a
                // use shouldn't re-ask which effect to apply.
                if ((feature.triggerVariants?.length ?? 0) > 0 && nextUsed > usesUsed) setPendingVariantUses(nextUsed)
                else onChange({ usesUsed: nextUsed })
              }}
            />
            <span className="text-xs text-white/50 shrink-0 tabular-nums w-8 text-right">
              {usesRemaining}/{effectiveMax}
            </span>
          </div>
        )}

        {/* Extra tracker bars — e.g. a staff with both "Charges" (the primary
            bar above) and a separate "1/Day Recall". Each gets its own row
            so a multi-tracking item shows every bar it's configured with,
            not just the primary one. */}
        {feature.multiTracking && (feature.trackers ?? []).map(t => {
          const trMax = t.maxUsesFormula === "pb" ? pb : (t.maxUses ?? 0)
          if (trMax <= 0) return null
          const trRemaining = Math.max(0, trMax - (t.usesUsed ?? 0))
          return (
            <div key={t.id} className="flex items-center gap-2 mt-1.5 pl-5" onClick={e => e.stopPropagation()}>
              {t.label && <span className="text-[10px] text-white/40 shrink-0 w-20 truncate">{t.label}</span>}
              <TracingSlider
                value={trRemaining} max={trMax}
                disabled={readOnly}
                color={barHueShift ? accentShimmerGradient(barColor) : barColor}
                animated={barHueShift} shimmer="hue"
                showButtons buttonSize="sm" className="flex-1 min-w-0"
                onChange={val => onChange({ trackers: (feature.trackers ?? []).map(x => x.id === t.id ? { ...x, usesUsed: trMax - val } : x) })}
              />
              <span className="text-xs text-white/50 shrink-0 tabular-nums w-8 text-right">
                {trRemaining}/{trMax}
              </span>
            </div>
          )
        })}
      </div>

      {/* Expanded content */}
      <PopTransition show={expanded}>
        <div className="px-3 pb-2 border-t border-white/5 flex flex-col gap-2">
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {/* Opt-in (see the "Track Multiple" checkbox in edit mode) — only
                lives here in the expanded view, not the collapsed header, so
                one-off items don't carry a counter nobody uses. */}
            {showItemExtras && feature.category !== "armor" && feature.trackAmount && (
              <span className="flex items-center gap-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/60" onClick={e => e.stopPropagation()}>
                {!readOnly && (
                  <button type="button" onClick={() => onChange({ amount: Math.max(1, (feature.amount ?? 1) - 1) })}
                    className="text-white/60 hover:text-white leading-none px-0.5">−</button>
                )}
                <span className="font-semibold tabular-nums">×{feature.amount ?? 1}</span>
                {!readOnly && (
                  <button type="button" onClick={() => onChange({ amount: (feature.amount ?? 1) + 1 })}
                    className="text-white/60 hover:text-white leading-none px-0.5">+</button>
                )}
              </span>
            )}
            {showItemExtras && !isWeapon && !!feature.weight && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/40">{feature.weight} lb</span>
            )}
            {showItemExtras && !!feature.value && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300">{feature.value} gp</span>
            )}
            {showItemExtras && feature.rarity && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${RARITY_COLORS[feature.rarity] ?? "bg-white/10 text-white/40"}`}>{feature.rarity}</span>
            )}
            <div className="flex items-center gap-1 ml-auto">
              {showItemExtras && !showInfusedToggle && !readOnly && feature.equipKind === "weapon" && !feature.martialOnly && (
                <button type="button" onClick={e => { e.stopPropagation(); onChange({ inMartial: !feature.inMartial }) }}
                  title={feature.inMartial ? "Remove from the Martial tab" : "Show in the Martial tab"}
                  className={`text-[10px] px-2 py-1 rounded-full transition-colors shrink-0 ${
                    feature.inMartial ? "bg-primary/30 text-primary hover:bg-primary/20" : "bg-white/10 hover:bg-white/20 text-white/60 hover:text-white"
                  }`}>
                  {feature.inMartial ? "◯ In Martial" : "+ Martial Tab"}
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
          {hasUses && feature.resetsOn === "manual" && feature.manualBulkRegain && (
            <BulkRegainRow label={feature.trackerLabel}
              onRegain={amount => onChange({ usesUsed: Math.max(0, usesUsed - amount) })} />
          )}
          {feature.multiTracking && (feature.trackers ?? []).map(t => {
            const trMax = t.maxUsesFormula === "pb" ? pb : (t.maxUses ?? 0)
            if (trMax <= 0 || t.resetsOn !== "manual" || !t.manualBulkRegain) return null
            return (
              <BulkRegainRow key={t.id} label={t.label}
                onRegain={amount => onChange({
                  trackers: (feature.trackers ?? []).map(x => x.id === t.id ? { ...x, usesUsed: Math.max(0, (x.usesUsed ?? 0) - amount) } : x),
                })} />
            )
          })}
          {isWeapon && weaponMeta.attackStat && toHit && (
            <p className="text-xs text-white/40">{toHitBreakdown()} = <span className="text-white/70 font-semibold">{toHit}</span></p>
          )}
          {feature.description ? (
            <div className="relative">
              <div ref={descRef} className="max-h-[60vh] overflow-y-auto overscroll-contain">
                <Markdown text={feature.description} tone="dark" textColorOverride={bodyTextColor} />
              </div>
              <ScrollHint show={descHasMore} />
            </div>
          ) : !readOnly ? (
            <p className="text-xs text-white/20 italic">No description — click ✎ to add one.</p>
          ) : null}
        </div>
      </PopTransition>

      {/* Automation "sub-tree" picker — a feature with triggerVariants set
          (Automation → Features → "multiple possible effects") asks which
          one applies each time a use is spent, instead of always firing the
          same single Form/Conditional. Picking one just writes its ids onto
          this feature's own triggerFormId/triggerConditionalId alongside the
          usesUsed bump — featureUsePatch (shared/utils.ts) then fires them
          exactly as it already does for a non-variant feature. */}
      {pendingVariantUses != null && (
        <Modal onClose={() => setPendingVariantUses(null)}>
          <div className="bg-zinc-900 border border-white/20 rounded-2xl shadow-2xl w-72 flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-white/10">
              <p className="text-sm font-bold text-white">Which effect?</p>
              <p className="text-[10px] text-white/40 mt-0.5 truncate">{feature.name || unnamedLabel}</p>
            </div>
            <div className="p-3 flex flex-col gap-1.5 max-h-80 overflow-y-auto">
              {(feature.triggerVariants ?? []).map(v => (
                <button key={v.id} type="button"
                  onClick={() => { onChange({ usesUsed: pendingVariantUses, triggerFormId: v.triggerFormId, triggerConditionalId: v.triggerConditionalId }); setPendingVariantUses(null) }}
                  className="text-left text-sm px-3 py-2 rounded-lg bg-white/5 hover:bg-purple-500/20 text-white/80 hover:text-white transition-colors truncate">
                  {v.label || "Unnamed variant"}
                </button>
              ))}
              <button type="button"
                onClick={() => { onChange({ usesUsed: pendingVariantUses, triggerFormId: undefined, triggerConditionalId: undefined }); setPendingVariantUses(null) }}
                className="text-left text-xs px-3 py-2 rounded-lg text-white/40 hover:text-white/70 transition-colors mt-1">
                Skip — spend the use with no effect
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
