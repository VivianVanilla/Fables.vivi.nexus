// ════════════════════════════════════════════════════════════════════════════
// InfoTab.tsx — Info tab with Notes / Traits / Feats / Features / Armor & Items / Profs
// ════════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from "react"
import type { userInfo } from "@/types/userInfo"
import type { CharacterData, Feature, FavoriteRef, ProficiencyEntry, FamiliarRef } from "@/components/shared/types"
import type { Theme } from "@/components/shared/themes"
import type { PackItem } from "@/components/documentation/doc-types"
import type { FavoriteCategory, CardStyle } from "@/components/shared/constants"
import { nanoid, profBonus, weightExemptItemIds, reorderSubset } from "@/components/shared/utils"
import { DndContext, DragOverlay, closestCenter, pointerWithin, type DragEndEvent, type CollisionDetection } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable"
import { SortableItem, DropZone, DragOverlayCard, useDragSensors } from "@/components/shared/SortableItem"
import {
  LANGUAGE_SUGGESTIONS, ARMOR_PROFICIENCY_SUGGESTIONS, TOOL_PROFICIENCY_SUGGESTIONS, WEAPON_PROFICIENCY_SUGGESTIONS, DEFAULT_ACCENT_COLOR,
} from "@/components/shared/constants"
import { Markdown } from "../../ui/Markdown"
import { MarkdownTextarea } from "../../ui/MarkdownTextarea"
import { useWikiLinks } from "@/components/shared/wikiLinks"
import { NpcQuickViewModal } from "@/components/npcTracker/NpcQuickViewModal"
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
  statMods?: Record<string, number>
  suggestionSource?: SuggestionSource
  userId?: string | null
  favorites: FavoriteRef[]
  onToggleFavorite: (id: string, label: string) => void
  onAddPack?: (id: string, packItems: PackItem[]) => void  // only wired for the Items tab — a picked pack suggestion replaces feature `id` with every item it contains
  showAttunement?: boolean
  maxAttuned?: number  // defaults to DEFAULT_MAX_ATTUNEMENTS (3) when unset
  onChangeMaxAttuned?: (n: number) => void
  hideAttunedBadge?: boolean  // keeps the per-entry Attuned checkbox (showAttunement) but hides the "Attuned N/M" counter pill — set on the Infusions list once ItemsTab's Equipped list (which also merges in infused Infusions, see perItemIsInfusion) became the one authoritative attunement count, so the two lists don't show two different tallies against the same maxAttunedItems
  showInfusedToggle?: boolean  // Artificer's Infusions list only — "Infused" checkbox per entry (Feature.infused) + a counter badge, same shape as showAttunement/attuned
  maxInfused?: number
  onChangeMaxInfused?: (n: number) => void
  perItemIsInfusion?: (f: Feature) => boolean  // forces infusion-style rendering for this entry — no item-extras (rarity/weight/weapon stats — infusions don't receive rarities), its own Infused checkbox, and not draggable — regardless of the list's own showItemExtras/showInfusedToggle. Used by ItemsTab's Equipped list, which merges in currently-infused Infusions (Feature.infused) alongside armor/weapons — same record shown in both places, same look wherever it's shown, exactly like Martial-linked weapons (perItemAccentColor above) already work.
  showItemExtras?: boolean
  showMagicStar?: boolean
  magicItemStyle?: CardStyle
  magicItemColor?: string
  magicItemSliderStyle?: CardStyle
  magicItemColorsByRarity?: boolean
  magicItemRarityColors?: Partial<Record<NonNullable<Feature["rarity"]>, string>>
  magicItemRaritySliderColors?: Partial<Record<NonNullable<Feature["rarity"]>, string>>
  accentColor?: string
  accentStyle?: CardStyle
  sliderStyle?: CardStyle
  tagTextColor?: "black" | "white"   // Settings — global override for the small source tag AND "Lv N" badge text color
  bodyTextColor?: "black" | "white"  // Settings — global override for each card's own description text color
  sliderColor?: string  // Settings — color of this category's own "Track uses" bars, independent of accentColor above
  perItemAccentColor?: (f: Feature) => string | undefined  // overrides accentColor per feature — used for Class Features' "Separate color per class" and Items' Martial-linked weapons; falls back to accentColor when it returns undefined
  perItemAccentStyle?: (f: Feature) => CardStyle | undefined  // overrides accentStyle per feature, same fallback rule as perItemAccentColor
  perItemSliderColor?: (f: Feature) => string | undefined  // overrides sliderColor per feature, same fallback rule as perItemAccentColor
  onReorder?: (newOrder: Feature[]) => void  // enables drag-to-reorder — omit to render a plain (non-draggable) list
  showAddButton?: boolean  // default true — false when a caller (ItemsTab) renders one shared "+ Add Item" button above multiple lists instead of one per list
}

// Searchable grid over the same core+homebrew suggestion pool the inline
// autocomplete (FeatureEntry.tsx, while typing a name in edit mode) already
// draws from — picking one here fills name/description exactly like typing
// it out and clicking the inline suggestion would, just without needing to
// know the exact spelling first. Manually typing a custom name still gets
// that inline autofill same as always; this modal doesn't replace it, it's
// just another way to reach the same pool before you've started typing.
export function FeatureSuggestionPickerModal({ label, suggestionSource, userId, existingNames, classFilter, onPick, onClose }: {
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

  // A zero-match search reuses the typed query itself as the new item's
  // name — replaces the old separate "type a custom name" box below the
  // grid with a single inline result, one fewer field to fill in. Query
  // clears after adding so the modal's ready for the next one right away
  // (same "stays open, add several in a row" behavior custom-add already had).
  function addCustom() {
    const name = query.trim()
    if (!name) return
    onPick({ name, description: "" })
    setQuery("")
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
              onKeyDown={e => { if (e.key === "Enter" && available.length === 0 && q) addCustom() }}
              placeholder={`Search ${label.toLowerCase()}…`}
              className="bg-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 shrink-0"
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 overflow-y-auto flex-1 min-h-0 content-start">
              {!loaded ? (
                <p className="col-span-full text-xs text-white/30 italic text-center py-6">Loading…</p>
              ) : available.length === 0 && q ? (
                <button type="button" onClick={addCustom}
                  className="col-span-full text-left text-xs px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/15 text-white/80 hover:text-white border border-dashed border-white/20 hover:border-white/40 transition-colors flex items-center gap-2">
                  <span className="text-white/40">+</span>
                  <span>Add new — <span className="font-medium text-white">{query.trim()}</span></span>
                </button>
              ) : available.length === 0 ? (
                <p className="col-span-full text-xs text-white/30 italic text-center py-6">All suggestions already added.</p>
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
          </div>
        )}
      </div>
    </Modal>
  )
}

const DEFAULT_MAX_ATTUNEMENTS = 3

// "Attuned 2/3" or "Infused 1/2" — the count itself is read-only (derived
// from how many items/infusions actually have the flag set), but the max
// is a per-character number that varies (attunement is usually 3 but not
// always; infusions scale with Artificer level) — click it to edit in place
// rather than needing a separate Settings field for something this small.
function EditableCounterBadge({ label, count, max, onChangeMax, readOnly, positiveClass }: {
  label: string; count: number; max: number; onChangeMax: (n: number) => void; readOnly?: boolean; positiveClass: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(max))

  function commit() {
    const n = parseInt(draft, 10)
    onChangeMax(Number.isFinite(n) ? Math.max(0, n) : max)
    setEditing(false)
  }

  return (
    <span className={`flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${count > max ? "bg-red-500/20 text-red-300" : positiveClass}`}>
      {label} {count}/
      {editing ? (
        <input
          autoFocus value={draft} onChange={e => setDraft(e.target.value.replace(/[^\d]/g, ""))}
          onBlur={commit} onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false) }}
          onClick={e => e.stopPropagation()}
          className="w-6 bg-transparent outline-none text-center border-b border-current/50"
        />
      ) : (
        <button type="button" disabled={readOnly}
          onClick={e => { e.stopPropagation(); setDraft(String(max)); setEditing(true) }}
          title={readOnly ? undefined : "Click to edit max"}
          className="disabled:cursor-default">
          {max}
        </button>
      )}
    </span>
  )
}

export function FeatureList({ items, allFeatures, label, onAdd, onChange, onRemove, onLinkToggle, theme, card, readOnly, pb, statMods, suggestionSource, userId, favorites, onToggleFavorite, onAddPack, showAttunement, maxAttuned, onChangeMaxAttuned, hideAttunedBadge, showInfusedToggle, maxInfused, onChangeMaxInfused, perItemIsInfusion, showItemExtras, showMagicStar, magicItemStyle, magicItemColor, magicItemSliderStyle, magicItemColorsByRarity, magicItemRarityColors, magicItemRaritySliderColors, accentColor, accentStyle, sliderStyle, tagTextColor, bodyTextColor, sliderColor, perItemAccentColor, perItemAccentStyle, perItemSliderColor, onReorder, showAddButton = true }: FeatureListProps) {
  const attunedCount = showAttunement ? items.filter(f => f.attuned).length : 0
  const infusedCount = showInfusedToggle ? items.filter(f => f.infused).length : 0
  const sensors = useDragSensors()
  // Which item is currently being dragged — drives the floating
  // DragOverlayCard clone (see SortableItem.tsx for why the in-place row
  // doesn't try to follow the pointer itself).
  const [activeId, setActiveId] = useState<string | null>(null)

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex(f => f.id === active.id)
    const newIndex = items.findIndex(f => f.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    onReorder?.(arrayMove(items, oldIndex, newIndex))
  }

  // Shared by the normal list render below AND the DragOverlay clone, so the
  // floating "picked up" copy is pixel-identical to the row it came from.
  function renderCard(f: Feature) {
    const isInfusion = perItemIsInfusion?.(f) ?? false
    return (
      <FeatureEntry
        feature={f}
        allFeatures={allFeatures.filter(a => a.id !== f.id && a.trackable)}
        theme={theme}
        readOnly={readOnly}
        pb={pb}
        statMods={statMods}
        suggestionSource={suggestionSource}
        userId={userId}
        isFavorite={favorites.some(fav => fav.refId === f.id)}
        onToggleFavorite={() => onToggleFavorite(f.id, f.name)}
        onAddPack={onAddPack ? packItems => onAddPack(f.id, packItems) : undefined}
        showAttunement={showAttunement}
        showInfusedToggle={isInfusion ? true : showInfusedToggle}
        showItemExtras={isInfusion ? false : showItemExtras}
        showMagicStar={showMagicStar}
        magicItemStyle={magicItemStyle}
        magicItemColor={magicItemColor}
        magicItemSliderStyle={magicItemSliderStyle}
        magicItemColorsByRarity={magicItemColorsByRarity}
        magicItemRarityColors={magicItemRarityColors}
        magicItemRaritySliderColors={magicItemRaritySliderColors}
        accentColor={perItemAccentColor?.(f) ?? accentColor}
        accentStyle={perItemAccentStyle?.(f) ?? accentStyle}
        sliderStyle={sliderStyle}
        tagTextColor={tagTextColor}
        bodyTextColor={bodyTextColor}
        sliderColor={perItemSliderColor?.(f) ?? sliderColor}
        onChange={patch => onChange(f.id, patch)}
        onRemove={() => onRemove(f.id)}
        onLinkToggle={otherId => onLinkToggle(f.id, otherId)}
      />
    )
  }

  return (
    <div className={`${card} p-3 flex flex-col gap-2 flex-1 min-h-0`}>
      <div className="flex items-center justify-between shrink-0 gap-2">
        <span className="text-[10px] uppercase tracking-widest text-white/50 font-semibold">{label}</span>
        {showAttunement && !hideAttunedBadge && (
          <EditableCounterBadge label="Attuned" count={attunedCount} max={maxAttuned ?? DEFAULT_MAX_ATTUNEMENTS}
            onChangeMax={onChangeMaxAttuned ?? (() => {})} readOnly={readOnly || !onChangeMaxAttuned}
            positiveClass="bg-purple-500/15 text-purple-300" />
        )}
        {showInfusedToggle && (
          <EditableCounterBadge label="Infused" count={infusedCount} max={maxInfused ?? 0}
            onChangeMax={onChangeMaxInfused ?? (() => {})} readOnly={readOnly || !onChangeMaxInfused}
            positiveClass="bg-amber-500/15 text-amber-300" />
        )}
        {!readOnly && showAddButton && (
          <button type="button" onClick={onAdd}
            className="text-sm px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors ml-auto">
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={e => setActiveId(String(e.active.id))} onDragEnd={handleDragEnd} onDragCancel={() => setActiveId(null)}>
          <SortableContext items={items.map(f => f.id)} strategy={verticalListSortingStrategy}>
            {items.map(f => (
              <SortableItem key={f.id} id={f.id} disabled={readOnly || !onReorder || (perItemIsInfusion?.(f) ?? false)}>
                {renderCard(f)}
              </SortableItem>
            ))}
          </SortableContext>
          <DragOverlay>
            {(() => {
              const activeItem = activeId ? items.find(f => f.id === activeId) : undefined
              return activeItem ? <DragOverlayCard>{renderCard(activeItem)}</DragOverlayCard> : null
            })()}
          </DragOverlay>
        </DndContext>
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
  statMods?: Record<string, number>
  userId?: string | null
  favorites: FavoriteRef[]
  onToggleFavorite: (id: string, label: string) => void
  showMagicStar?: boolean
  magicItemStyle?: CardStyle
  magicItemColor?: string
  magicItemSliderStyle?: CardStyle
  magicItemColorsByRarity?: boolean
  magicItemRarityColors?: Partial<Record<NonNullable<Feature["rarity"]>, string>>
  magicItemRaritySliderColors?: Partial<Record<NonNullable<Feature["rarity"]>, string>>
  pendingItemId?: string | null   // set right after Add — opens that item straight into its edit form
  onAutoEditConsumed?: () => void
  showAddButton?: boolean  // default true — false when a caller (ItemsTab) renders one shared "+ Add Item" button above multiple lists instead of one per list
  onAddPack?: (id: string, packItems: PackItem[]) => void  // a picked pack suggestion replaces feature `id` with every item it contains
  onReorder?: (newOrder: Feature[]) => void  // reorders siblings (same parentId) — omit to render a plain (non-draggable) list
  accentColor?: string
  accentStyle?: CardStyle
  perItemAccentColor?: (f: Feature) => string | undefined  // overrides accentColor per feature — used for Martial-linked weapons; falls back to accentColor when it returns undefined
  perItemAccentStyle?: (f: Feature) => CardStyle | undefined  // overrides accentStyle per feature, same fallback rule as perItemAccentColor
  bodyTextColor?: "black" | "white"  // Settings — global override for each card's own description text color
}

export function ContainerItemsList({ items, allFeatures, onAdd, onChange, onRemove, onLinkToggle, theme, card, readOnly, pb, statMods, userId, favorites, onToggleFavorite, showMagicStar, magicItemStyle, magicItemColor, magicItemSliderStyle, magicItemColorsByRarity, magicItemRarityColors, magicItemRaritySliderColors, pendingItemId, onAutoEditConsumed, showAddButton = true, onAddPack, onReorder, accentColor, accentStyle, perItemAccentColor, perItemAccentStyle, bodyTextColor }: ContainerItemsListProps) {
  const sensors = useDragSensors()
  // Which item is currently being dragged — drives the floating
  // DragOverlayCard clone (see SortableItem.tsx for why the in-place row
  // doesn't try to follow the pointer itself).
  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  // A container's own DropZone (id "container:<id>") wraps its own
  // SortableItem, so the two nearly-overlap in the same spot — plain
  // closestCenter can't reliably tell "drop reparents into this container"
  // apart from "drop reorders as this container's own sibling", and was
  // silently picking the sibling-reorder interpretation, which is why drops
  // onto a bag looked like they did nothing. pointerWithin (literal
  // geometric containment, not nearest-center) checked first and made to
  // always prefer a "container:"-prefixed zone when the pointer is
  // genuinely over one — falling back to plain closestCenter otherwise —
  // makes "drop directly on a container" unambiguous. Prefers the most
  // specific (non-root) container hit when a drop is over a nested
  // container that's itself inside another's DropZone.
  const containerAwareCollision: CollisionDetection = args => {
    const hits = pointerWithin(args).filter(c => typeof c.id === "string" && c.id.startsWith("container:"))
    const specific = hits.find(c => c.id !== "container:root")
    if (specific) return [specific]
    if (hits.length > 0) return [hits[0]]
    return closestCenter(args)
  }

  // Two things can happen on drop: reorder within a sibling group (same
  // parentId — dropping onto a sibling's own sortable slot), or reparent
  // into a different container (dropping onto one of the DropZones
  // renderItem/the root wrap below register, id "container:<id>" or
  // "container:root"). Both share this one handler since both come through
  // the same DndContext.
  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null)
    const { active, over } = event
    if (!over) return
    const activeId = String(active.id)
    const overId   = String(over.id)

    const containerMatch = /^container:(.+)$/.exec(overId)
    if (containerMatch) {
      const targetId = containerMatch[1] === "root" ? undefined : containerMatch[1]
      if (activeId === targetId || (targetId && isSelfOrDescendant(targetId, activeId))) return
      const activeItem = items.find(i => i.id === activeId)
      if (activeItem && activeItem.parentId !== targetId) onChange(activeId, { parentId: targetId })
      return
    }

    if (activeId === overId) return
    const activeItem = items.find(i => i.id === activeId)
    if (!activeItem) return
    const group = items.filter(i => i.parentId === activeItem.parentId)
    const oldIndex = group.findIndex(i => i.id === activeId)
    const newIndex = group.findIndex(i => i.id === overId)
    if (oldIndex === -1 || newIndex === -1) return
    const reorderedGroup = arrayMove(group, oldIndex, newIndex)
    onReorder?.(reorderSubset(items, i => i.parentId === activeItem.parentId, reorderedGroup))
  }
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

  // Shared by the normal render below AND the DragOverlay clone, so the
  // floating "picked up" copy is pixel-identical to the row it came from.
  function renderCard(f: Feature) {
    const contentsOpen = openContainers.has(f.id)
    // Same button-based fallback as the drop targets below (handleDrop) —
    // every other container is a valid destination except this item's own
    // subtree, which would create a cycle.
    const containerOptions = readOnly ? undefined : items
      .filter(i => i.isContainer && i.id !== f.id && !isSelfOrDescendant(i.id, f.id))
      .map(i => ({ id: i.id, name: i.name }))
    return (
      <FeatureEntry
        feature={f}
        allFeatures={allFeatures.filter(a => a.id !== f.id && a.trackable)}
        theme={theme}
        readOnly={readOnly}
        pb={pb}
        statMods={statMods}
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
        magicItemColorsByRarity={magicItemColorsByRarity}
        magicItemRarityColors={magicItemRarityColors}
        magicItemRaritySliderColors={magicItemRaritySliderColors}
        accentColor={perItemAccentColor?.(f) ?? accentColor}
        accentStyle={perItemAccentStyle?.(f) ?? accentStyle}
        bodyTextColor={bodyTextColor}
        containerOptions={containerOptions}
        onMoveToContainer={containerId => onChange(f.id, { parentId: containerId })}
        containerContentsOpen={f.isContainer ? contentsOpen : undefined}
        onToggleContainerContents={f.isContainer ? () => toggleContainerOpen(f.id) : undefined}
        onChange={patch => onChange(f.id, patch)}
        onRemove={() => onRemove(f.id)}
        onLinkToggle={otherId => onLinkToggle(f.id, otherId)}
        autoEdit={f.id === pendingItemId}
        onAutoEditConsumed={onAutoEditConsumed}
        onAddPack={onAddPack ? packItems => onAddPack(f.id, packItems) : undefined}
      />
    )
  }

  function renderItem(f: Feature, depth: number) {
    const children     = items.filter(c => c.parentId === f.id)
    const childWeight  = children.reduce((sum, c) => sum + (c.weight ?? 0) * (c.amount ?? 1), 0)
    const overCapacity = f.maxWeight != null && childWeight > f.maxWeight
    const contentsOpen = openContainers.has(f.id)
    const row = (
      <SortableItem id={f.id} disabled={readOnly || !onReorder}>
        {renderCard(f)}
      </SortableItem>
    )
    return (
      <div key={f.id} className="flex flex-col gap-1" style={{ marginLeft: depth * 16 }}>
        {/* A container's own row is a drop target regardless of open/closed
            state — dropping an item onto it (from anywhere in this list)
            reparents into it. Only containers register this; a plain item's
            row is just its SortableItem, nothing more. */}
        {f.isContainer && !readOnly
          ? <DropZone id={`container:${f.id}`}>{row}</DropZone>
          : row}
        <PopTransition show={!!f.isContainer}>
          <div className="ml-4 border-l border-white/10 pl-2 flex flex-col gap-1 rounded-r-lg transition-colors">
            {(childWeight > 0 || f.maxWeight != null) && (
              <span className={`text-[9px] px-2 py-0.5 rounded-full self-start ${overCapacity ? "bg-red-500/20 text-red-300" : "bg-white/10 text-white/40"}`}>
                {childWeight % 1 === 0 ? childWeight : childWeight.toFixed(1)}{f.maxWeight != null ? `/${f.maxWeight}` : ""} lb
              </span>
            )}
            {contentsOpen && (
              <>
                <SortableContext items={children.map(c => c.id)} strategy={verticalListSortingStrategy}>
                  {children.map(c => renderItem(c, depth + 1))}
                </SortableContext>
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
    <div className={`${card} p-3 flex flex-col gap-2 flex-1 min-h-0`}>
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
        <DndContext sensors={sensors} collisionDetection={containerAwareCollision} onDragStart={e => setActiveDragId(String(e.active.id))} onDragEnd={handleDragEnd} onDragCancel={() => setActiveDragId(null)}>
          {/* Dropping on any blank space here (not onto a container) moves
              the dragged item back to the top level. */}
          <DropZone id="container:root" disabled={readOnly} className="flex-1 min-h-0">
            <SortableContext items={roots.map(f => f.id)} strategy={verticalListSortingStrategy}>
              {roots.map(f => renderItem(f, 0))}
            </SortableContext>
          </DropZone>
          <DragOverlay>
            {(() => {
              const activeItem = activeDragId ? items.find(i => i.id === activeDragId) : undefined
              return activeItem ? <DragOverlayCard>{renderCard(activeItem)}</DragOverlayCard> : null
            })()}
          </DragOverlay>
        </DndContext>
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
// `documentation` table, which drive FeatureEntry's damage/weight
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
  ["overview",   "Overview"],
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

  // [[Name]] mentions in Background resolve against this character's party's
  // NPCs and the viewer's own notes/characters — see wikiLinks.ts.
  const { linkify: linkifyNotes, onInternalLink: onNotesInternalLink, npcs: linkableNpcs, quickViewNpc, selectNpc, closeQuickView } = useWikiLinks(data.partyCode)

  // Feature Stylings (Settings) applied sheet-wide — same source of truth
  // FavoritesPanel.tsx reads, just resolved per fixed list here since each of
  // these lists is a single, known category. "item" (the Items tab) is
  // deliberately never looked up — it already has its own Magic Item styling.
  const favAccentColor = (cat: FavoriteCategory) => data.favoriteCategoryColors?.[cat]
  const favAccentStyle = (cat: FavoriteCategory) => data.favoriteCategoryStyle?.[cat]
  const favSliderStyle = (cat: FavoriteCategory) => data.favoriteCategorySliderStyle?.[cat]
  const favSliderColor = (cat: FavoriteCategory) => data.favoriteCategorySliderColors?.[cat]
  // Global (not per-category) — Settings' "Modules and Font Size" Tag Text / Body Text switches.
  const tagTextColor  = data.textColorOverride === "dark" ? "black" as const : "white" as const
  const bodyTextColor = data.textColorOverride === "dark" ? "black" as const : undefined

  // Settings' "Separate color per class" — resolves each Class Feature's own
  // accent from its `source` (e.g. "Fighter (Champion)") instead of the one
  // shared favoriteCategoryColors.class swatch. Matched against the
  // character's own typed class(es) (see deriveCharacterClassNames), not
  // just the 13 built-in presets, so a homebrew class's features get colored
  // too as long as its name appears in the feature's source.
  const ownClassNames = deriveCharacterClassNames(data)
  // Once "Separate by Class/Subclass" is on, every matched class commits to
  // its own color — falling back to the same DEFAULT_ACCENT_COLOR Settings'
  // own swatch shows when a class hasn't been explicitly repicked yet, never
  // quietly back to the whole category's one shared flat color (that's the
  // opposite of what turning per-class ON means).
  const classFeatureAccentColor = data.classFeatureColorsByClass
    ? (f: Feature) => {
        const key = matchOwnClassKey(f.source, ownClassNames)
        return key ? (data.classFeatureColors?.[key] ?? DEFAULT_ACCENT_COLOR) : undefined
      }
    : undefined
  // Same per-class resolution, for the "Track uses" bar — falls back to the
  // class's own Card color (not just undefined) when no Slider color was
  // set for it, same fallback favoriteCategorySliderColors has against
  // favoriteCategoryColors sheet-wide.
  const classFeatureSliderColor = data.classFeatureColorsByClass
    ? (f: Feature) => {
        const key = matchOwnClassKey(f.source, ownClassNames)
        return key ? (data.classFeatureSliderColors?.[key] ?? data.classFeatureColors?.[key] ?? DEFAULT_ACCENT_COLOR) : undefined
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
  const [showRacialTraitPicker, setShowRacialTraitPicker] = useState(false)
  const [showInvocationPicker, setShowInvocationPicker] = useState(false)

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
              <Markdown text={linkifyNotes(data.background)} tone="auto" size="sm" onInternalLink={onNotesInternalLink} />
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
            onAdd={() => setShowRacialTraitPicker(true)}
            onChange={onChangeFeature}
            onRemove={onRemoveFeature}
            onLinkToggle={onLinkToggle}
            theme={theme} card={card} readOnly={readOnly} pb={pb}
            suggestionSource="race" userId={userId}
            favorites={favorites} onToggleFavorite={onToggleFavorite}
            accentColor={favAccentColor("race")} accentStyle={favAccentStyle("race")} sliderStyle={favSliderStyle("race")}
            tagTextColor={tagTextColor} sliderColor={favSliderColor("race")}
            bodyTextColor={bodyTextColor}
            onReorder={newOrder => update({ racialTraits: newOrder })}
          />
          {showRacialTraitPicker && (
            <FeatureSuggestionPickerModal
              label="Racial Trait" suggestionSource="race" userId={userId}
              existingNames={(data.racialTraits ?? []).map(f => f.name)}
              onPick={s => addFeatureFromSuggestion("racialTraits", s)}
              onClose={() => setShowRacialTraitPicker(false)}
            />
          )}
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
            tagTextColor={tagTextColor} sliderColor={favSliderColor("feat")}
            bodyTextColor={bodyTextColor}
            onReorder={newOrder => update({ feats: newOrder })}
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
              onAdd={() => setShowInvocationPicker(true)}
              onChange={onChangeFeature}
              onRemove={onRemoveFeature}
              onLinkToggle={onLinkToggle}
              theme={theme} card={card} readOnly={readOnly} pb={pb}
              suggestionSource="invocation" userId={userId}
              favorites={favorites} onToggleFavorite={onToggleFavorite}
              accentColor={favAccentColor("invocation")} accentStyle={favAccentStyle("invocation")} sliderStyle={favSliderStyle("invocation")}
              tagTextColor={tagTextColor} sliderColor={favSliderColor("invocation")}
            bodyTextColor={bodyTextColor}
              onReorder={newOrder => update({ invocations: newOrder })}
            />
          )}
          {showInvocationPicker && (
            <FeatureSuggestionPickerModal
              label="Eldritch Invocation" suggestionSource="invocation" userId={userId}
              existingNames={(data.invocations ?? []).map(f => f.name)}
              onPick={s => addFeatureFromSuggestion("invocations", s)}
              onClose={() => setShowInvocationPicker(false)}
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
              tagTextColor={tagTextColor} sliderColor={favSliderColor("infusion")}
              bodyTextColor={bodyTextColor}
              // Attunement's real, editable count+max now lives on the Items
              // tab's Equipped list (which merges in infused Infusions —
              // see ItemsTab.tsx) — showAttunement here just keeps each
              // infusion's own Attuned checkbox editable; hideAttunedBadge
              // stops this list from also showing its own separate, only-
              // ever-counting-infusions tally against the same limit.
              showAttunement hideAttunedBadge
              showInfusedToggle maxInfused={data.maxInfusedItems} onChangeMaxInfused={n => update({ maxInfusedItems: n })}
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
            tagTextColor={tagTextColor} sliderColor={favSliderColor("class")}
            bodyTextColor={bodyTextColor}
            perItemAccentColor={classFeatureAccentColor}
            perItemSliderColor={classFeatureSliderColor}
            onReorder={newOrder => update({ classFeatures: newOrder })}
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

      {/* Popup for a [[Name]] mention in Background that resolved to an NPC —
          see wikiLinks.ts. An "object:" mention navigates straight there
          instead (see onNotesInternalLink), so needs no modal of its own. */}
      {quickViewNpc && (
        <NpcQuickViewModal
          npc={quickViewNpc}
          npcs={linkableNpcs}
          locationName={null}
          onClose={closeQuickView}
          onSelectNpc={selectNpc}
        />
      )}

    </div>
  )
}
