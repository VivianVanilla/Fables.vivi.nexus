// ════════════════════════════════════════════════════════════════════════════
// InfoTab.tsx — Info tab with Notes / Traits / Feats / Features / Armor & Items / Profs
// ════════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from "react"
import type { userInfo } from "@/types/userInfo"
import type { CharacterData, Feature, FavoriteRef, ProficiencyEntry, FamiliarRef } from "@/components/shared/types"
import type { Theme } from "@/components/shared/themes"
import type { PackItem } from "@/components/documentation/doc-types"
import type { FavoriteCategory, CardStyle } from "@/components/shared/constants"
import { nanoid, profBonus, weightExemptItemIds } from "@/components/shared/utils"
import {
  LANGUAGE_SUGGESTIONS, ARMOR_PROFICIENCY_SUGGESTIONS, TOOL_PROFICIENCY_SUGGESTIONS, WEAPON_PROFICIENCY_SUGGESTIONS,
} from "@/components/shared/constants"
import { Markdown } from "../../ui/Markdown"
import { MarkdownTextarea } from "../../ui/MarkdownTextarea"
import { PopTransition } from "@/components/shared/ui/PopTransition"
import { FeatureEntry, getSuggestions, type Suggestion, type SuggestionSource } from "../entries/FeatureEntry"
import { FamiliarsTab } from "./FamiliarsTab"
import { matchOwnClassKey, deriveCharacterClassNames } from "@/components/shared/classColors"
import { FavoriteStar } from "../ui/FavoriteStar"
import { Modal } from "@/components/shared/ui/Modal"

// ── Types ─────────────────────────────────────────────────────────────────────

export type InfoSubTab = "overview" | "raceFeats" | "features" | "familiars" | "profs"

interface InfoTabProps {
  data: CharacterData
  update: (patch: Partial<CharacterData>) => void
  onChangeFeature: (id: string, patch: Partial<Feature>) => void
  onRemoveFeature: (id: string) => void
  onLinkToggle: (featureId: string, otherId: string) => void
  theme: Theme
  card: string
  readOnly: boolean
  userId?: string | null
  favorites: FavoriteRef[]
  onToggleFavorite: (id: string, label: string) => void
  subTab: InfoSubTab
  onSubTabChange: (tab: InfoSubTab) => void
  isWarlock: boolean
  isArtificer: boolean
  // Familiars subtab — mirrors the props FamiliarsTab took when it was its
  // own top-level Tab in CharacterSheet.tsx (see the tab-swap note above).
  familiars: FamiliarRef[]
  monsters: userInfo.Objects[]
  poppedOutIds: Set<string>
  onAddFamiliar: (monsterId: string) => void
  onUpdateFamiliar: (id: string, patch: Partial<FamiliarRef>) => void
  onRemoveFamiliar: (id: string) => void
  onToggleFamiliarFavorite: (id: string, label: string) => void
  onPopOutFamiliar: (id: string) => void
}

// ── Sub-component: FeatureList ────────────────────────────────────────────────

interface FeatureListProps {
  items: Feature[]
  allFeatures: Feature[]
  label: string
  onAdd: () => void
  onChange: (id: string, patch: Partial<Feature>) => void
  onRemove: (id: string) => void
  onLinkToggle: (featureId: string, otherId: string) => void
  theme: Theme
  card: string
  readOnly: boolean
  pb: number
  suggestionSource?: SuggestionSource
  userId?: string | null
  favorites: FavoriteRef[]
  onToggleFavorite: (id: string, label: string) => void
  onAddToEquipment?: (feature: Feature) => void
  equipmentLinkedIds?: Set<string>
  onAddPack?: (id: string, packItems: PackItem[]) => void  // only wired for the Items tab — a picked pack suggestion replaces feature `id` with every item it contains
  showAttunement?: boolean
  showItemExtras?: boolean
  showMagicStar?: boolean
  magicItemStyle?: "none" | "outline" | "galaxy"
  magicItemColor?: string
  magicItemSliderStyle?: "none" | "outline" | "galaxy"
  accentColor?: string
  accentStyle?: CardStyle
  sliderStyle?: CardStyle
  perItemAccentColor?: (f: Feature) => string | undefined  // overrides accentColor per feature — only used for Class Features when "Separate color per class" is on; falls back to accentColor when it returns undefined
  sortable?: boolean
  showAddButton?: boolean  // default true — false when a caller (ItemsTab) renders one shared "+ Add Item" button above multiple lists instead of one per list
}

// Searchable grid over the same core+homebrew suggestion pool the inline
// autocomplete (FeatureEntry.tsx, while typing a name in edit mode) already
// draws from — picking one here fills name/description exactly like typing
// it out and clicking the inline suggestion would, just without needing to
// know the exact spelling first. Manually typing a custom name still gets
// that inline autofill same as always; this modal doesn't replace it, it's
// just another way to reach the same pool before you've started typing.
function FeatureSuggestionPickerModal({ label, suggestionSource, userId, existingNames, classFilter, onPick, onClose }: {
  label: string
  suggestionSource: SuggestionSource
  userId?: string | null
  existingNames: string[]
  classFilter?: string[]  // Class Features only — restricts the grid to features tagged with one of these class names (see getSuggestions' meta.class), so a Fighter doesn't see Wizard spell features
  onPick: (s: Suggestion) => void
  onClose: () => void
}) {
  const [all, setAll] = useState<Suggestion[]>([])
  const [loaded, setLoaded] = useState(false)
  const [query, setQuery] = useState("")
  const [customName, setCustomName] = useState("")
  // Clicking a grid tile opens it for a look (full description) rather than
  // adding it immediately — Add is a separate, deliberate confirm step from
  // there. Clearing this returns to the grid (still open, so picking a few
  // in a row doesn't mean reopening the modal each time).
  const [selected, setSelected] = useState<Suggestion | null>(null)

  useEffect(() => {
    let cancelled = false
    getSuggestions(suggestionSource, userId).then(s => { if (!cancelled) { setAll(s); setLoaded(true) } })
    return () => { cancelled = true }
  }, [suggestionSource, userId])

  // Falls back to showing everything if the character has no class set yet
  // (an empty filter would otherwise mean "match nothing").
  const classNames = classFilter && classFilter.length > 0 ? new Set(classFilter.map(c => c.toLowerCase())) : null
  const existing = new Set(existingNames.map(n => n.trim().toLowerCase()))
  const q = query.trim().toLowerCase()
  const available = all.filter(s =>
    (!classNames || (s.meta?.class && classNames.has(s.meta.class.toLowerCase()))) &&
    !existing.has(s.name.toLowerCase()) && (!q || s.name.toLowerCase().includes(q))
  )

  function addCustom() {
    const name = customName.trim()
    if (!name) return
    onPick({ name, description: "" })
    setCustomName("")
  }

  return (
    <Modal onClose={onClose}>
      <div className="bg-zinc-900 border border-white/15 rounded-2xl shadow-2xl w-[min(640px,calc(100vw-2rem))] max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <span className="text-sm font-bold text-white">{selected ? selected.name : `Add ${label}`}</span>
          <button type="button" onClick={onClose}
            className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white">✕</button>
        </div>
        {selected ? (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="p-5 overflow-y-auto flex-1 min-h-0">
              {selected.description ? (
                <Markdown text={selected.description} tone="dark" />
              ) : (
                <p className="text-xs text-white/30 italic">No description available.</p>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-white/10 shrink-0">
              <button type="button" onClick={() => setSelected(null)}
                className="text-xs px-3 py-2 rounded-lg text-white/50 hover:text-white transition-colors">
                ← Back
              </button>
              <button type="button" onClick={() => { onPick(selected); setSelected(null) }}
                className="text-xs px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white font-semibold transition-colors">
                + Add {selected.name}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 flex flex-col gap-3 overflow-hidden flex-1 min-h-0">
            <input
              autoFocus value={query} onChange={e => setQuery(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}…`}
              className="bg-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 shrink-0"
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 overflow-y-auto flex-1 min-h-0 content-start">
              {!loaded ? (
                <p className="col-span-full text-xs text-white/30 italic text-center py-6">Loading…</p>
              ) : available.length === 0 ? (
                <p className="col-span-full text-xs text-white/30 italic text-center py-6">
                  {q ? "No matches — add it as custom below." : "All suggestions already added."}
                </p>
              ) : available.map(s => (
                <button key={s.name} type="button" onClick={() => setSelected(s)}
                  className="text-left text-xs px-3 py-2 rounded-lg bg-white/5 hover:bg-white/15 text-white/80 hover:text-white border border-white/10 transition-colors flex flex-col gap-0.5">
                  <span className="font-medium truncate">{s.name}</span>
                  {s.description && (
                    <span className="text-white/35 truncate">{s.description.slice(0, 50)}{s.description.length > 50 ? "…" : ""}</span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-3 border-t border-white/10 shrink-0">
              <input
                value={customName} onChange={e => setCustomName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addCustom()}
                placeholder="Custom — type here…"
                className="flex-1 min-w-0 bg-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
              />
              <button type="button" onClick={addCustom} disabled={!customName.trim()}
                className="text-xs px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors disabled:opacity-40 shrink-0">
                Add
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

const MAX_ATTUNEMENTS = 3

export function FeatureList({ items, allFeatures, label, onAdd, onChange, onRemove, onLinkToggle, theme, card, readOnly, pb, suggestionSource, userId, favorites, onToggleFavorite, onAddToEquipment, equipmentLinkedIds, onAddPack, showAttunement, showItemExtras, showMagicStar, magicItemStyle, magicItemColor, magicItemSliderStyle, accentColor, accentStyle, sliderStyle, perItemAccentColor, sortable, showAddButton = true }: FeatureListProps) {
  const attunedCount = showAttunement ? items.filter(f => f.attuned).length : 0
  const [sortBy, setSortBy] = useState<"class" | "level">("class")

  const displayedItems = sortable
    ? items.slice().sort((a, b) => sortBy === "level"
        ? (a.level ?? 0) - (b.level ?? 0) || (a.source ?? "").localeCompare(b.source ?? "")
        : (a.source ?? "").localeCompare(b.source ?? "") || (a.level ?? 0) - (b.level ?? 0))
    : items

  return (
    <div className={`${card} p-3 flex flex-col gap-2 flex-1 min-h-0`}>
      <div className="flex items-center justify-between shrink-0 gap-2">
        <span className="text-[10px] uppercase tracking-widest text-white/50 font-semibold">{label}</span>
        {showAttunement && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${
            attunedCount > MAX_ATTUNEMENTS ? "bg-red-500/20 text-red-300" : "bg-purple-500/15 text-purple-300"
          }`}>
            Attuned {attunedCount}/{MAX_ATTUNEMENTS}
          </span>
        )}
        {sortable && (
          <div className="flex items-center gap-1 rounded-full bg-white/10 p-0.5 shrink-0 ml-auto">
            <button type="button" onClick={() => setSortBy("class")}
              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold transition-colors ${sortBy === "class" ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70"}`}>
              Sort: Class
            </button>
            <button type="button" onClick={() => setSortBy("level")}
              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold transition-colors ${sortBy === "level" ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70"}`}>
              Sort: Level
            </button>
          </div>
        )}
        {!readOnly && showAddButton && (
          <button type="button" onClick={onAdd}
            className={`text-sm px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors ${sortable ? "shrink-0" : "ml-auto"}`}>
            + Add
          </button>
        )}
      </div>
      <div className="flex flex-col gap-1 overflow-auto flex-1">
        {items.length === 0 && (
          <p className="text-[10px] text-white/25 italic text-center py-6">
            {readOnly ? "None" : "None yet — click Add"}
          </p>
        )}
        {displayedItems.map(f => (
          <FeatureEntry
            key={f.id}
            feature={f}
            allFeatures={allFeatures.filter(a => a.id !== f.id && a.trackable)}
            theme={theme}
            readOnly={readOnly}
            pb={pb}
            suggestionSource={suggestionSource}
            userId={userId}
            isFavorite={favorites.some(fav => fav.refId === f.id)}
            onToggleFavorite={() => onToggleFavorite(f.id, f.name)}
            onAddToEquipment={onAddToEquipment}
            inEquipment={equipmentLinkedIds?.has(f.id)}
            onAddPack={onAddPack ? packItems => onAddPack(f.id, packItems) : undefined}
            showAttunement={showAttunement}
            showItemExtras={showItemExtras}
            showMagicStar={showMagicStar}
            magicItemStyle={magicItemStyle}
            magicItemColor={magicItemColor}
            magicItemSliderStyle={magicItemSliderStyle}
            accentColor={perItemAccentColor?.(f) ?? accentColor}
            accentStyle={accentStyle}
            sliderStyle={sliderStyle}
            onChange={patch => onChange(f.id, patch)}
            onRemove={() => onRemove(f.id)}
            onLinkToggle={otherId => onLinkToggle(f.id, otherId)}
          />
        ))}
      </div>
    </div>
  )
}

// ── Sub-component: ContainerItemsList — generic items, with folder-like containers ────

export interface ContainerItemsListProps {
  items: Feature[]  // full generic-items array (for parent/child resolution)
  allFeatures: Feature[]
  onAdd: (parentId?: string) => void
  onChange: (id: string, patch: Partial<Feature>) => void
  onRemove: (id: string) => void
  onLinkToggle: (featureId: string, otherId: string) => void
  theme: Theme
  card: string
  readOnly: boolean
  pb: number
  userId?: string | null
  favorites: FavoriteRef[]
  onToggleFavorite: (id: string, label: string) => void
  showMagicStar?: boolean
  magicItemStyle?: "none" | "outline" | "galaxy"
  magicItemColor?: string
  magicItemSliderStyle?: "none" | "outline" | "galaxy"
  pendingItemId?: string | null   // set right after Add — opens that item straight into its edit form
  onAutoEditConsumed?: () => void
  showAddButton?: boolean  // default true — false when a caller (ItemsTab) renders one shared "+ Add Item" button above multiple lists instead of one per list
  onAddToEquipment?: (feature: Feature) => void  // toggles this item's "+ Martial Tab" link — omit to hide the button
  equipmentLinkedIds?: Set<string>               // sourceFeatureIds already linked into the Martial tab
  onAddPack?: (id: string, packItems: PackItem[]) => void  // a picked pack suggestion replaces feature `id` with every item it contains
}

export function ContainerItemsList({ items, allFeatures, onAdd, onChange, onRemove, onLinkToggle, theme, card, readOnly, pb, userId, favorites, onToggleFavorite, showMagicStar, magicItemStyle, magicItemColor, magicItemSliderStyle, pendingItemId, onAutoEditConsumed, showAddButton = true, onAddToEquipment, equipmentLinkedIds, onAddPack }: ContainerItemsListProps) {
  // Which containers (isContainer feature ids) have their contents shown —
  // per-container, not a whole-panel toggle; hidden by default; ephemeral
  // (resets on reload), same as FeatureEntry's own expanded/collapsed state.
  const [openContainers, setOpenContainers] = useState<Set<string>>(new Set())
  function toggleContainerOpen(id: string) {
    setOpenContainers(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const roots = items.filter(i => !i.parentId)
  // Items inside a "Bag of Holding" container (containerIgnoresWeight) don't
  // count toward this total — see character-utils.ts's weightExemptItemIds.
  const weightExempt = weightExemptItemIds(items)
  const totalWeight = items.reduce((sum, i) => sum + (weightExempt.has(i.id) ? 0 : (i.weight ?? 0) * (i.amount ?? 1)), 0)

  // A container can't be dropped into itself or into one of its own descendants
  function isSelfOrDescendant(candidateId: string, movingId: string): boolean {
    let current: Feature | undefined = items.find(i => i.id === candidateId)
    const visited = new Set<string>()
    while (current) {
      if (current.id === movingId) return true
      if (visited.has(current.id)) break
      visited.add(current.id)
      current = current.parentId ? items.find(i => i.id === current!.parentId) : undefined
    }
    return false
  }

  function handleDrop(targetId: string | undefined, e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (readOnly) return
    const raw = e.dataTransfer.getData("x-fable-ref")
    if (!raw) return
    let ref: { refId?: string; refType?: string }
    try { ref = JSON.parse(raw) } catch { return }
    if (ref.refType !== "feature" || !ref.refId) return
    if (!items.some(i => i.id === ref.refId)) return // only reparent items that live in this generic-items list
    if (targetId && (ref.refId === targetId || isSelfOrDescendant(targetId, ref.refId))) return // no self/cycle
    onChange(ref.refId, { parentId: targetId })
  }

  function renderItem(f: Feature, depth: number) {
    const children     = items.filter(c => c.parentId === f.id)
    const childWeight  = children.reduce((sum, c) => sum + (c.weight ?? 0) * (c.amount ?? 1), 0)
    const overCapacity = f.maxWeight != null && childWeight > f.maxWeight
    const contentsOpen = openContainers.has(f.id)
    // Same button-based fallback as the drop targets below (handleDrop) —
    // every other container is a valid destination except this item's own
    // subtree, which would create a cycle.
    const containerOptions = readOnly ? undefined : items
      .filter(i => i.isContainer && i.id !== f.id && !isSelfOrDescendant(i.id, f.id))
      .map(i => ({ id: i.id, name: i.name }))
    return (
      <div key={f.id} className="flex flex-col gap-1" style={{ marginLeft: depth * 16 }}>
        <FeatureEntry
          feature={f}
          allFeatures={allFeatures.filter(a => a.id !== f.id && a.trackable)}
          theme={theme}
          readOnly={readOnly}
          pb={pb}
          suggestionSource="item"
          userId={userId}
          isFavorite={favorites.some(fav => fav.refId === f.id)}
          onToggleFavorite={() => onToggleFavorite(f.id, f.name)}
          showItemExtras
          showWeightColumn
          showMagicStar={showMagicStar}
          magicItemStyle={magicItemStyle}
          magicItemColor={magicItemColor}
          magicItemSliderStyle={magicItemSliderStyle}
          containerOptions={containerOptions}
          onMoveToContainer={containerId => onChange(f.id, { parentId: containerId })}
          containerContentsOpen={f.isContainer ? contentsOpen : undefined}
          onToggleContainerContents={f.isContainer ? () => toggleContainerOpen(f.id) : undefined}
          onChange={patch => onChange(f.id, patch)}
          onRemove={() => onRemove(f.id)}
          onLinkToggle={otherId => onLinkToggle(f.id, otherId)}
          autoEdit={f.id === pendingItemId}
          onAutoEditConsumed={onAutoEditConsumed}
          onAddToEquipment={onAddToEquipment}
          inEquipment={equipmentLinkedIds?.has(f.id)}
          onAddPack={onAddPack ? packItems => onAddPack(f.id, packItems) : undefined}
        />
        <PopTransition show={!!f.isContainer}>
          <div className="ml-4 border-l border-white/10 pl-2 flex flex-col gap-1 rounded-r-lg transition-colors"
            onDragOver={e => { if (!readOnly) e.preventDefault() }}
            onDrop={e => handleDrop(f.id, e)}>
            {(childWeight > 0 || f.maxWeight != null) && (
              <span className={`text-[9px] px-2 py-0.5 rounded-full self-start ${overCapacity ? "bg-red-500/20 text-red-300" : "bg-white/10 text-white/40"}`}>
                {childWeight % 1 === 0 ? childWeight : childWeight.toFixed(1)}{f.maxWeight != null ? `/${f.maxWeight}` : ""} lb
              </span>
            )}
            {contentsOpen && (
              <>
                {children.map(c => renderItem(c, depth + 1))}
                {children.length === 0 && (
                  <p className="text-[10px] text-white/20 italic text-center py-2 border border-dashed border-white/10 rounded-lg">
                    Drag items here
                  </p>
                )}
              </>
            )}
          </div>
        </PopTransition>
      </div>
    )
  }

  return (
    <div className={`${card} p-3 flex flex-col gap-2 flex-1 min-h-0`}
      onDragOver={e => { if (!readOnly) e.preventDefault() }}
      onDrop={e => handleDrop(undefined, e)}>
      <div className="flex items-center justify-between shrink-0 gap-2">
        <span className="text-[10px] uppercase tracking-widest text-white/50 font-semibold">Carried Items</span>
        {totalWeight > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/40 shrink-0">
            {totalWeight % 1 === 0 ? totalWeight : totalWeight.toFixed(1)} lb total
          </span>
        )}
        {!readOnly && showAddButton && (
          <button type="button" onClick={() => onAdd()}
            className="text-sm px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors ml-auto shrink-0">
            + Add
          </button>
        )}
      </div>
      <div className="flex flex-col gap-1 overflow-auto flex-1">
        {roots.length === 0 && (
          <p className="text-[10px] text-white/25 italic text-center py-6">
            {readOnly ? "None" : "None yet — click Add"}
          </p>
        )}
        {roots.map(f => renderItem(f, 0))}
      </div>
    </div>
  )
}

// ── Sub-component: ProficiencyList — entry-based, replaces the old free-text textarea ─

function toProfEntries(value: ProficiencyEntry[] | string | undefined): ProficiencyEntry[] {
  if (Array.isArray(value)) return value
  if (typeof value === "string" && value.trim()) {
    return value.split(/[,\n]/).map(s => s.trim()).filter(Boolean).map(name => ({ id: nanoid(), name }))
  }
  return []
}

// Static name suggestions surfaced through ProficiencyPickerModal's
// searchable grid — proficiencies are freeform tags with no mechanical data
// behind them (contrast with the weapon *items* seeded into the
// `documentation` table, which drive EquipmentEntry's damage/weight
// autofill instead). No inline <datalist> autofill on the manual rename
// input below — the modal is the one place to pick from this list now.
const PROFICIENCY_SUGGESTIONS: Record<string, readonly string[]> = {
  Weapons: WEAPON_PROFICIENCY_SUGGESTIONS,
  Armor: ARMOR_PROFICIENCY_SUGGESTIONS,
  Tools: TOOL_PROFICIENCY_SUGGESTIONS,
  Languages: LANGUAGE_SUGGESTIONS,
}

// Browsing ~30 weapon names (or armor/tools) through a single-line
// datalist dropdown is cramped — this surfaces the same suggestion list as
// a searchable grid instead, staying open across multiple picks (each pick
// drops out of the grid immediately since it's now in `existingNames`) so
// adding several at once — e.g. three languages — doesn't mean reopening
// the picker each time.
function ProficiencyPickerModal({ label, suggestions, existingNames, onPick, onClose }: {
  label: string
  suggestions: readonly string[]
  existingNames: string[]
  onPick: (name: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState("")
  const [customName, setCustomName] = useState("")
  const existing = new Set(existingNames.map(n => n.trim().toLowerCase()))
  const q = query.trim().toLowerCase()
  const available = suggestions.filter(s => !existing.has(s.toLowerCase()) && (!q || s.toLowerCase().includes(q)))

  function addCustom() {
    const name = customName.trim()
    if (!name) return
    onPick(name)
    setCustomName("")
  }

  return (
    <Modal onClose={onClose}>
      <div className="bg-zinc-900 border border-white/15 rounded-2xl shadow-2xl w-[min(640px,calc(100vw-2rem))] max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <span className="text-sm font-bold text-white">Add {label}</span>
          <button type="button" onClick={onClose}
            className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white">✕</button>
        </div>
        <div className="p-4 flex flex-col gap-3 overflow-hidden flex-1 min-h-0">
          <input
            autoFocus value={query} onChange={e => setQuery(e.target.value)}
            placeholder={`Search ${label.toLowerCase()}…`}
            className="bg-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 shrink-0"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 overflow-y-auto flex-1 min-h-0 content-start">
            {available.map(s => (
              <button key={s} type="button" onClick={() => onPick(s)}
                className="text-left text-xs px-3 py-2 rounded-lg bg-white/5 hover:bg-white/15 text-white/80 hover:text-white border border-white/10 transition-colors truncate">
                {s}
              </button>
            ))}
            {available.length === 0 && (
              <p className="col-span-full text-xs text-white/30 italic text-center py-6">
                {q ? "No matches — add it as custom below." : "All suggestions already added."}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 pt-3 border-t border-white/10 shrink-0">
            <input
              value={customName} onChange={e => setCustomName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addCustom()}
              placeholder="[Custom] Type here…"
              className="flex-1 min-w-0 bg-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
            />
            <button type="button" onClick={addCustom} disabled={!customName.trim()}
              className="text-xs px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors disabled:opacity-40 shrink-0">
              Add
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function ProficiencyList({ label, value, onChange, readOnly, card }: {
  label: string
  value: ProficiencyEntry[] | string | undefined
  onChange: (entries: ProficiencyEntry[]) => void
  readOnly: boolean
  card: string
}) {
  const entries = toProfEntries(value)
  const suggestions = PROFICIENCY_SUGGESTIONS[label]

  // Entries are real, named things now — not a raw always-editable text
  // field with a hair-trigger ✕ next to it. Renaming/deleting requires
  // deliberately entering edit mode via the pencil first.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState(false)

  // Favorited entries pin to the top (stable otherwise) — a quick way to
  // surface the handful that actually matter (main weapon, spoken
  // languages) out of a list that can otherwise grow long.
  const displayEntries = [...entries].sort((a, b) => (a.favorite ? 0 : 1) - (b.favorite ? 0 : 1))

  // Categories with a suggestion list open the searchable grid picker
  // instead of a blank entry — anything without one (shouldn't happen
  // today, but keeps this safe if a label with no suggestions is ever
  // passed in) falls back to the old add-then-rename flow.
  function addEntry() {
    if (suggestions) { setShowPicker(true); return }
    const id = nanoid()
    onChange([...entries, { id, name: "" }])
    setEditingId(id)
  }
  function addNamedEntry(name: string) { onChange([...entries, { id: nanoid(), name }]) }
  function changeEntry(id: string, name: string) { onChange(entries.map(e => e.id === id ? { ...e, name } : e)) }
  function removeEntry(id: string) {
    onChange(entries.filter(e => e.id !== id))
    if (editingId === id) setEditingId(null)
  }
  function toggleFavorite(id: string)        { onChange(entries.map(e => e.id === id ? { ...e, favorite: !e.favorite } : e)) }

  return (
    <div className={`${card} p-3 flex flex-col gap-2`}>
      <div className="flex items-center justify-between shrink-0">
        <span className="text-[10px] uppercase tracking-widest text-white/50 font-semibold">{label}</span>
        {!readOnly && (
          <button type="button" onClick={addEntry}
            className="text-sm px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors">
            + Add
          </button>
        )}
      </div>
      {showPicker && suggestions && (
        <ProficiencyPickerModal
          label={label}
          suggestions={suggestions}
          existingNames={entries.map(e => e.name)}
          onPick={addNamedEntry}
          onClose={() => setShowPicker(false)}
        />
      )}
      <div className="flex flex-col gap-1.5">
        {entries.length === 0 && (
          <p className="text-[10px] text-white/25 italic text-center py-3">
            {readOnly ? "None" : "None yet — click Add"}
          </p>
        )}
        {displayEntries.map(entry => {
          const isEditing = editingId === entry.id
          // Styled after FeatureEntry's own card/edit-form split (see
          // entries/FeatureEntry.tsx) — a rounded card for the read view,
          // dropping into a small edit form (with the same animated
          // FavoriteStar, labeled, that feats/items use) rather than an
          // always-open text field with a hair-trigger delete next to it.
          return (
            <div key={entry.id} className="rounded-lg border border-white/10 bg-white/5 overflow-hidden">
              {isEditing ? (
                <div className="p-2.5 flex flex-col gap-2">
                  <input
                    autoFocus value={entry.name} placeholder="e.g. Longswords"
                    onChange={e => changeEntry(entry.id, e.target.value)}
                    onKeyDown={e => e.key === "Enter" && setEditingId(null)}
                    className="bg-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none placeholder:text-white/20"
                  />
                  <div className="flex items-center justify-between">
                    <button type="button" onClick={() => removeEntry(entry.id)}
                      className="text-xs text-red-300/80 hover:text-red-400 transition-colors">Delete</button>
                    <div className="flex items-center gap-2">
                      <FavoriteStar isFavorite={!!entry.favorite} onToggle={() => toggleFavorite(entry.id)} label="Favorite" />
                      <button type="button" onClick={() => setEditingId(null)}
                        className="text-[11px] px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors">
                        Done
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-2.5 py-1.5">
                  <span className="flex-1 min-w-0 text-xs text-white/80 truncate">
                    {entry.name || <span className="text-white/30 italic">Unnamed</span>}
                  </span>
                  {entry.favorite && <span className="text-yellow-400 text-xs shrink-0">★</span>}
                  {!readOnly && (
                    <button type="button" onClick={() => setEditingId(entry.id)} title="Edit"
                      className="text-white/30 hover:text-white text-xs shrink-0 transition-colors">
                      ✎
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main InfoTab component ────────────────────────────────────────────────────

// "Armor & Items" moved out to its own top-level Tab in CharacterSheet.tsx
// (it's what players open most, so it earned a one-click tab); Familiars
// moved in here to make room — see CharacterSheet.tsx's Tab bar.
const SUB_TABS: [InfoSubTab, string][] = [
  ["overview",   "Notes"],
  ["raceFeats",  "Race & Feats"],
  ["features",   "Features"],
  ["familiars",  "Familiars"],
  ["profs",      "Proficiencies"]
]

export function InfoTab({
  data, update, onChangeFeature, onRemoveFeature, onLinkToggle, theme, card, readOnly, userId,
  favorites, onToggleFavorite, subTab, onSubTabChange, isWarlock, isArtificer,
  familiars, monsters, poppedOutIds, onAddFamiliar, onUpdateFamiliar, onRemoveFamiliar, onToggleFamiliarFavorite, onPopOutFamiliar,
}: InfoTabProps) {

  const pb = profBonus(data.level ?? 1)

  // Background defaults to a rendered (read-only) view, same as every other
  // markdown field in the app — an explicit Edit toggle instead of always
  // showing a raw editable textarea.
  const [editingBackground, setEditingBackground] = useState(false)

  // Feature Stylings (Settings) applied sheet-wide — same source of truth
  // FavoritesPanel.tsx reads, just resolved per fixed list here since each of
  // these lists is a single, known category. "item" (the Items tab) is
  // deliberately never looked up — it already has its own Magic Item styling.
  const favAccentColor = (cat: FavoriteCategory) => data.favoriteCategoryColors?.[cat]
  const favAccentStyle = (cat: FavoriteCategory) => data.favoriteCategoryStyle?.[cat]
  const favSliderStyle = (cat: FavoriteCategory) => data.favoriteCategorySliderStyle?.[cat]

  // Settings' "Separate color per class" — resolves each Class Feature's own
  // accent from its `source` (e.g. "Fighter (Champion)") instead of the one
  // shared favoriteCategoryColors.class swatch. Matched against the
  // character's own typed class(es) (see deriveCharacterClassNames), not
  // just the 13 built-in presets, so a homebrew class's features get colored
  // too as long as its name appears in the feature's source.
  const ownClassNames = deriveCharacterClassNames(data)
  const classFeatureAccentColor = data.classFeatureColorsByClass
    ? (f: Feature) => {
        const key = matchOwnClassKey(f.source, ownClassNames)
        return key ? data.classFeatureColors?.[key] : undefined
      }
    : undefined

  // This character's own class(es) — restricts the Class Feature picker
  // modal to features tagged with one of these names (see getSuggestions'
  // meta.class) instead of every class in the whole documentation library.
  const characterClassNames = data.multiclass && data.classes?.length
    ? data.classes.map(c => c.cls).filter(Boolean)
    : data.class ? [data.class] : []

  // All features across all lists (for linking UI)
  const allFeatures: Feature[] = [
    ...(data.racialTraits  ?? []),
    ...(data.feats         ?? []),
    ...(data.classFeatures ?? []),
    ...(data.items         ?? []),
    ...(data.invocations   ?? []),
    ...(data.infusions     ?? []),
  ]

  // ── Feature list helpers ─────────────────────────────────────────────────

  type FeatureKey = "racialTraits" | "feats" | "classFeatures" | "invocations" | "infusions"

  function addFeature(key: FeatureKey, patch?: Partial<Feature>) {
    update({ [key]: [...(data[key] ?? []), { id: nanoid(), name: "", ...patch }] })
  }

  // Same picker-grid pattern as ProficiencyList, but the pick also autofills
  // description (and, for feats, a prerequisite line) — the exact same
  // fields FeatureEntry.tsx's inline while-typing autocomplete fills in,
  // just without needing to type the name out first. Typing a custom name
  // by hand still gets that inline autofill untouched.
  const [showFeatPicker, setShowFeatPicker] = useState(false)
  const [showClassFeaturePicker, setShowClassFeaturePicker] = useState(false)

  function addFeatureFromSuggestion(key: FeatureKey, s: Suggestion) {
    const description = s.meta?.prerequisite
      ? `*Prerequisite: ${s.meta.prerequisite}*\n\n${s.description}`
      : s.description
    addFeature(key, { name: s.name, description })
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">

      {/* Sub-tab bar */}
      <div className="flex items-center gap-1 flex-wrap shrink-0">
        {SUB_TABS.map(([tab, label]) => (
          <button key={tab} type="button" onClick={() => onSubTabChange(tab)}
            className={`px-3 py-1 text-[10px] uppercase tracking-widest rounded-full font-semibold transition-colors ${
              subTab === tab ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70 hover:bg-white/5"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Notes (formerly Overview) ────────────────────────────────────── */}

      {subTab === "overview" && (
        <div className="flex flex-col gap-3 overflow-auto flex-1">

          {/* Its own card with real room — this used to share a cramped
              single-line input with Alignment, not enough space for an
              actual background writeup (personality, ideals, bonds, flaws…). */}
          <div className={`${card} p-3 flex flex-col gap-2`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-widest text-white/50 font-semibold">Background</span>
              {!readOnly && (
                <button type="button" onClick={() => setEditingBackground(v => !v)}
                  className="text-[10px] px-2 py-0.5 rounded-full transition-colors shrink-0 bg-white/10 hover:bg-white/20 text-white/60 hover:text-white">
                  {editingBackground ? "Confirm" : "✎"}
                </button>
              )}
            </div>
            {!readOnly && editingBackground ? (
              <MarkdownTextarea
                value={data.background ?? ""} onChange={v => update({ background: v })}
                placeholder="Acolyte, Sage… personality traits, ideals, bonds, flaws…"
                rows={6}
                className="bg-white/5 rounded-lg px-2.5 py-1.5 outline-none text-xs text-white placeholder:text-white/20 resize-none"
              />
            ) : data.background ? (
              <Markdown text={data.background} tone="auto" size="sm" />
            ) : (
              <p className="text-xs text-white/25 italic">{readOnly ? "No background yet." : "No background yet — click Edit to add one."}</p>
            )}
          </div>

          <div className={`${card} p-3 flex flex-col gap-2`}>
            <span className="text-[10px] uppercase tracking-widest text-white/50 font-semibold">Description</span>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              {([
                ["alignment", "Alignment"], ["age", "Age"], ["height", "Height"],
                ["weight", "Weight"], ["eyes", "Eyes"], ["skin", "Skin"], ["hair", "Hair"],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex flex-col gap-1">
                  <span className="text-[9px] uppercase tracking-wider text-white/30">{label}</span>
                  <input value={data[key] ?? ""} onChange={e => update({ [key]: e.target.value })}
                    placeholder={label + "…"} disabled={readOnly}
                    className="bg-white/5 rounded px-2 py-1 outline-none text-xs text-white placeholder:text-white/20 disabled:opacity-60" />
                </label>
              ))}
            </div>
          </div>

          <div className={`${card} p-3 flex flex-col gap-2`}>
            <span className="text-[10px] uppercase tracking-widest text-white/50 font-semibold">Party</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/50 shrink-0">Code</span>
              <input value={data.partyCode ?? ""} onChange={e => update({ partyCode: e.target.value.trim().toUpperCase() })}
                placeholder="Enter party code from DM…" maxLength={8} disabled={readOnly}
                className="flex-1 bg-white/10 rounded px-2 py-1 text-xs font-mono tracking-widest text-white outline-none focus:ring-1 focus:ring-primary placeholder:text-white/20 uppercase disabled:opacity-60" />
            </div>
            {data.partyCode && (
              <p className="text-[9px] text-white/40">Joined: <span className="text-white/70 font-mono">{data.partyCode}</span></p>
            )}
          </div>
        </div>
      )}

      {/* ── Race & Feats (tiled, side-by-side) ───────────────────────────────── */}

      {subTab === "raceFeats" && (() => {
        const extraCols = (isWarlock ? 1 : 0) + (isArtificer ? 1 : 0)
        return (
        <div className={`grid grid-cols-1 md:grid-cols-2 ${extraCols === 1 ? "lg:grid-cols-3" : extraCols === 2 ? "lg:grid-cols-4" : ""} gap-3 flex-1 min-h-0`}>
          <FeatureList
            items={data.racialTraits ?? []} allFeatures={allFeatures} label="Racial Traits"
            onAdd={() => addFeature("racialTraits")}
            onChange={onChangeFeature}
            onRemove={onRemoveFeature}
            onLinkToggle={onLinkToggle}
            theme={theme} card={card} readOnly={readOnly} pb={pb}
            suggestionSource="race" userId={userId}
            favorites={favorites} onToggleFavorite={onToggleFavorite}
            accentColor={favAccentColor("race")} accentStyle={favAccentStyle("race")} sliderStyle={favSliderStyle("race")}
          />
          <FeatureList
            items={data.feats ?? []} allFeatures={allFeatures} label="Feats"
            onAdd={() => setShowFeatPicker(true)}
            onChange={onChangeFeature}
            onRemove={onRemoveFeature}
            onLinkToggle={onLinkToggle}
            theme={theme} card={card} readOnly={readOnly} pb={pb}
            suggestionSource="feat" userId={userId}
            favorites={favorites} onToggleFavorite={onToggleFavorite}
            accentColor={favAccentColor("feat")} accentStyle={favAccentStyle("feat")} sliderStyle={favSliderStyle("feat")}
          />
          {showFeatPicker && (
            <FeatureSuggestionPickerModal
              label="Feat" suggestionSource="feat" userId={userId}
              existingNames={(data.feats ?? []).map(f => f.name)}
              onPick={s => addFeatureFromSuggestion("feats", s)}
              onClose={() => setShowFeatPicker(false)}
            />
          )}
          {isWarlock && (
            <FeatureList
              items={data.invocations ?? []} allFeatures={allFeatures} label="Eldritch Invocations"
              onAdd={() => addFeature("invocations")}
              onChange={onChangeFeature}
              onRemove={onRemoveFeature}
              onLinkToggle={onLinkToggle}
              theme={theme} card={card} readOnly={readOnly} pb={pb}
              suggestionSource="invocation" userId={userId}
              favorites={favorites} onToggleFavorite={onToggleFavorite}
              accentColor={favAccentColor("invocation")} accentStyle={favAccentStyle("invocation")} sliderStyle={favSliderStyle("invocation")}
            />
          )}
          {isArtificer && (
            <FeatureList
              items={data.infusions ?? []} allFeatures={allFeatures} label="Infusions"
              onAdd={() => addFeature("infusions")}
              onChange={onChangeFeature}
              onRemove={onRemoveFeature}
              onLinkToggle={onLinkToggle}
              theme={theme} card={card} readOnly={readOnly} pb={pb}
              suggestionSource="infusion" userId={userId}
              favorites={favorites} onToggleFavorite={onToggleFavorite}
              accentColor={favAccentColor("infusion")} accentStyle={favAccentStyle("infusion")} sliderStyle={favSliderStyle("infusion")}
            />
          )}
        </div>
        )
      })()}

      {/* ── Class Features ─────────────────────────────────────────────────── */}

      {subTab === "features" && (
        <>
          <FeatureList
            items={data.classFeatures ?? []} allFeatures={allFeatures} label="Class Features"
            onAdd={() => setShowClassFeaturePicker(true)}
            onChange={onChangeFeature}
            onRemove={onRemoveFeature}
            onLinkToggle={onLinkToggle}
            theme={theme} card={card} readOnly={readOnly} pb={pb}
            suggestionSource="class" userId={userId}
            favorites={favorites} onToggleFavorite={onToggleFavorite}
            accentColor={favAccentColor("class")} accentStyle={favAccentStyle("class")} sliderStyle={favSliderStyle("class")}
            perItemAccentColor={classFeatureAccentColor}
            sortable
          />
          {showClassFeaturePicker && (
            <FeatureSuggestionPickerModal
              label="Class Feature" suggestionSource="class" userId={userId}
              existingNames={(data.classFeatures ?? []).map(f => f.name)}
              classFilter={characterClassNames}
              onPick={s => addFeatureFromSuggestion("classFeatures", s)}
              onClose={() => setShowClassFeaturePicker(false)}
            />
          )}
        </>
      )}

      {/* ── Familiars ─────────────────────────────────────────────────────── */}
      {/* "Armor & Items" moved out to its own top-level Tab — see the note on
          SUB_TABS above — and Familiars moved in here in its place. */}

      {subTab === "familiars" && (
        <FamiliarsTab
          familiars={familiars}
          monsters={monsters}
          favorites={favorites}
          card={card}
          readOnly={readOnly}
          poppedOutIds={poppedOutIds}
          onAdd={onAddFamiliar}
          onUpdate={onUpdateFamiliar}
          onRemove={onRemoveFamiliar}
          onToggleFavorite={onToggleFamiliarFavorite}
          onPopOut={onPopOutFamiliar}
          accentColor={favAccentColor("familiar")}
          accentStyle={favAccentStyle("familiar")}
        />
      )}

      {/* ── Proficiencies ──────────────────────────────────────────────────── */}

      {subTab === "profs" && (
        <div className="flex flex-col gap-3 overflow-auto flex-1">
          <ProficiencyList label="Weapons"   value={data.weaponProfs}   onChange={v => update({ weaponProfs:   v })} readOnly={readOnly} card={card} />
          <ProficiencyList label="Armor"     value={data.armorProfs}    onChange={v => update({ armorProfs:    v })} readOnly={readOnly} card={card} />
          <ProficiencyList label="Tools"     value={data.toolProfs}     onChange={v => update({ toolProfs:     v })} readOnly={readOnly} card={card} />
          <ProficiencyList label="Languages" value={data.languageProfs} onChange={v => update({ languageProfs: v })} readOnly={readOnly} card={card} />
        </div>
      )}

    </div>
  )
}
