// ════════════════════════════════════════════════════════════════════════════
// InfoTab.tsx — Info tab with Notes / Traits / Feats / Features / Armor & Items / Profs
// ════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import type { userInfo } from "@/types/userInfo"
import type { CharacterData, Feature, FavoriteRef, ProficiencyEntry, LinkedNoteRef } from "@/components/shared/types"
import type { Theme } from "@/components/shared/themes"
import type { FavoriteCategory, CardStyle } from "@/components/shared/constants"
import { nanoid, profBonus, safeParseJson, uniqueName, weightExemptItemIds } from "@/components/shared/utils"
import {
  LANGUAGE_SUGGESTIONS, ARMOR_PROFICIENCY_SUGGESTIONS, TOOL_PROFICIENCY_SUGGESTIONS, WEAPON_PROFICIENCY_SUGGESTIONS,
} from "@/components/shared/constants"
import { useUserContext } from "../../../../src/contexts/UserContext"
import { Markdown } from "../../ui/Markdown"
import { MarkdownTextarea } from "../../ui/MarkdownTextarea"
import { PopTransition } from "@/components/shared/ui/PopTransition"
import { FeatureEntry, type SuggestionSource } from "../entries/FeatureEntry"
import { usePopoverPosition, useClickOutside } from "@/components/shared/usePortalMenu"
import { matchClassKey } from "@/components/shared/classColors"
import { FavoriteStar } from "../ui/FavoriteStar"

// ── Types ─────────────────────────────────────────────────────────────────────

export type InfoSubTab = "overview" | "raceFeats" | "features" | "items" | "profs"

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
  objects: userInfo.Objects[]
  createObject: (payload: { name: string; type: string; parent_id?: string | null; data?: Record<string, unknown> }) => Promise<userInfo.Objects>
  updateObject: (id: string, updates: userInfo.ObjectsUpdate) => Promise<userInfo.Objects>
  favorites: FavoriteRef[]
  onToggleFavorite: (id: string, label: string) => void
  onAddItemToEquipment: (feature: Feature) => void
  equipmentLinkedIds: Set<string>
  subTab: InfoSubTab
  onSubTabChange: (tab: InfoSubTab) => void
  isWarlock: boolean
  isArtificer: boolean
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
}

const MAX_ATTUNEMENTS = 3

export function FeatureList({ items, allFeatures, label, onAdd, onChange, onRemove, onLinkToggle, theme, card, readOnly, pb, suggestionSource, userId, favorites, onToggleFavorite, onAddToEquipment, equipmentLinkedIds, showAttunement, showItemExtras, showMagicStar, magicItemStyle, magicItemColor, magicItemSliderStyle, accentColor, accentStyle, sliderStyle, perItemAccentColor, sortable }: FeatureListProps) {
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
        {!readOnly && (
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

interface ContainerItemsListProps {
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
}

function ContainerItemsList({ items, allFeatures, onAdd, onChange, onRemove, onLinkToggle, theme, card, readOnly, pb, userId, favorites, onToggleFavorite, showMagicStar, magicItemStyle, magicItemColor, magicItemSliderStyle, pendingItemId, onAutoEditConsumed }: ContainerItemsListProps) {
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
        {!readOnly && (
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

// Static name suggestions offered via <datalist> — proficiencies are
// freeform tags with no mechanical data behind them (contrast with the
// weapon *items* seeded into the `documentation` table, which drive
// EquipmentEntry's damage/weight autofill instead).
const PROFICIENCY_SUGGESTIONS: Record<string, readonly string[]> = {
  Weapons: WEAPON_PROFICIENCY_SUGGESTIONS,
  Armor: ARMOR_PROFICIENCY_SUGGESTIONS,
  Tools: TOOL_PROFICIENCY_SUGGESTIONS,
  Languages: LANGUAGE_SUGGESTIONS,
}

// Delete used to be a bare "✕" sitting right next to the text field — easy
// to hit by accident while scanning a long list. Same fix as LinkMenu above:
// behind a small ⋮ menu so it's a deliberate two-click action.
function ProficiencyEditMenu({ onDelete }: { onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const pos = usePopoverPosition(open, triggerRef, contentRef)
  useClickOutside(open, () => setOpen(false), triggerRef, contentRef)

  return (
    <div className="relative shrink-0">
      <button type="button" ref={triggerRef} onClick={() => setOpen(v => !v)} title="Edit"
        className="text-white/30 hover:text-white text-xs size-6 flex items-center justify-center rounded hover:bg-white/10 transition-colors">
        ⋮
      </button>
      {open && pos && createPortal(
        <div ref={contentRef} style={{ position: "fixed", top: pos.top, right: pos.right }}
          className="z-50 bg-zinc-900 border border-white/15 rounded-lg shadow-xl overflow-hidden w-32 animate-in fade-in zoom-in-95 duration-150">
          <button type="button" onClick={() => { setOpen(false); onDelete() }}
            className="w-full text-left px-3 py-2 text-xs text-red-300 hover:bg-red-500/10 transition-colors whitespace-nowrap">
            Delete
          </button>
        </div>,
        document.body
      )}
    </div>
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
  const datalistId = `profs-suggest-${label.toLowerCase()}`

  // Favorited entries pin to the top (stable otherwise) — a quick way to
  // surface the handful that actually matter (main weapon, spoken
  // languages) out of a list that can otherwise grow long.
  const displayEntries = [...entries].sort((a, b) => (a.favorite ? 0 : 1) - (b.favorite ? 0 : 1))

  function addEntry()                        { onChange([...entries, { id: nanoid(), name: "" }]) }
  function changeEntry(id: string, name: string) { onChange(entries.map(e => e.id === id ? { ...e, name } : e)) }
  function removeEntry(id: string)           { onChange(entries.filter(e => e.id !== id)) }
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
      {suggestions && !readOnly && (
        <datalist id={datalistId}>
          {suggestions.map(s => <option key={s} value={s} />)}
        </datalist>
      )}
      <div className="flex flex-col gap-1.5">
        {entries.length === 0 && (
          <p className="text-[10px] text-white/25 italic text-center py-3">
            {readOnly ? "None" : "None yet — click Add"}
          </p>
        )}
        {displayEntries.map(entry => (
          <div key={entry.id} className="flex items-center gap-1.5 bg-white/5 rounded-lg px-2 py-1">
            {!readOnly ? (
              <FavoriteStar isFavorite={!!entry.favorite} onToggle={() => toggleFavorite(entry.id)} />
            ) : entry.favorite ? (
              <span className="text-yellow-400 text-xs shrink-0 w-7 text-center">★</span>
            ) : null}
            <input value={entry.name} disabled={readOnly} placeholder="e.g. Longswords" list={suggestions ? datalistId : undefined}
              onChange={e => changeEntry(entry.id, e.target.value)}
              className="flex-1 min-w-0 bg-transparent outline-none text-xs text-white/80 placeholder:text-white/20 disabled:opacity-60" />
            {!readOnly && <ProficiencyEditMenu onDelete={() => removeEntry(entry.id)} />}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Sub-component: Linked Notes ───────────────────────────────────────────────

function getDescendantNotes(objects: userInfo.Objects[], folderId: string): userInfo.Objects[] {
  const direct     = objects.filter(o => o.parent_id === folderId)
  const notes      = direct.filter(o => o.type === "note")
  const subfolders = direct.filter(o => o.type === "folder")
  return [...notes, ...subfolders.flatMap(f => getDescendantNotes(objects, f.id))]
}

// Unlinking used to be a bare "✕" — easy to hit by accident while scanning the
// list. It now lives behind a small edit menu so unlinking is a deliberate
// two-click action instead of a hair-trigger one. Dropdowns triggered from
// inside a note row need to escape that row's `overflow-hidden` (used for its
// own rounded corners) or they render clipped — position is computed from the
// trigger's screen rect and the menu is portaled to <body> as `position: fixed`
// (see ../../collab/usePortalMenu), closing on click-outside rather than blur.
function LinkMenu({ onUnlink, itemLabel }: { onUnlink: () => void; itemLabel: string }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const pos = usePopoverPosition(open, triggerRef, contentRef)
  useClickOutside(open, () => setOpen(false), triggerRef, contentRef)

  return (
    <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
      <button type="button" ref={triggerRef}
        onClick={() => setOpen(v => !v)}
        title="Edit link"
        className="text-white/30 hover:text-white text-xs size-5 flex items-center justify-center rounded hover:bg-white/10 transition-colors">
        ✎
      </button>
      {open && pos && createPortal(
        <div ref={contentRef} style={{ position: "fixed", top: pos.top, right: pos.right }}
          className="z-50 bg-zinc-900 border border-white/15 rounded-lg shadow-xl overflow-hidden w-36 animate-in fade-in zoom-in-95 duration-150">
          <button type="button" onClick={() => { setOpen(false); onUnlink() }}
            className="w-full text-left px-3 py-2 text-xs text-red-300 hover:bg-red-500/10 transition-colors whitespace-nowrap">
            Unlink {itemLabel}
          </button>
        </div>,
        document.body
      )}
    </div>
  )
}

// Note editor embedded inline in the character sheet — a linked note is a
// plain single-owner note, same model as the standalone NoteView page.
function InlineNote({ note, expanded, onToggle, onRemove, readOnly, autoEdit, onAutoEditConsumed }: {
  note: userInfo.Objects
  expanded: boolean
  onToggle: () => void
  onRemove?: () => void
  readOnly: boolean
  autoEdit?: boolean
  onAutoEditConsumed?: () => void
}) {
  const { updateObject } = useUserContext()
  const initialData = safeParseJson(note.data) as { content?: string }

  const [content, setContent] = useState(initialData.content ?? "")
  const [editing, setEditing] = useState(!!autoEdit)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Newly-created notes open straight into edit mode, once — mirrors the
  // auto-edit-on-add pattern used for newly added spells.
  useEffect(() => {
    if (autoEdit) onAutoEditConsumed?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleChange(next: string) {
    setContent(next)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      updateObject(note.id, { data: { content: next } as unknown as JSON }).catch(e => console.error(e))
    }, 700)
  }

  function handleEditClick() {
    if (!expanded) onToggle()
    setEditing(expanded ? v => !v : true)
  }

  return (
    <div className="rounded-lg bg-white/5 border border-white/10 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-white/10 transition-colors" onClick={onToggle}>
        <span className="text-[10px] text-white/30 w-3 shrink-0">{expanded ? "▼" : "▶"}</span>
        <span className="text-xs text-white/70 flex-1 min-w-0 truncate">{note.name}</span>
        {!readOnly && (
          <button type="button" onClick={e => { e.stopPropagation(); handleEditClick() }}
            className="text-[10px] px-2 py-0.5 rounded-full transition-colors shrink-0 bg-white/10 hover:bg-white/20 text-white/60 hover:text-white">
            {expanded && editing ? "👁 Preview" : "✎ Edit"}
          </button>
        )}
        {onRemove && <LinkMenu onUnlink={onRemove} itemLabel="note" />}
      </div>
      {expanded && (
        <div className="px-3 pb-2 max-h-64 overflow-y-auto">
          {editing && !readOnly ? (
            <MarkdownTextarea
              value={content}
              onChange={handleChange}
              autoFocus
              placeholder={`# Note title\n\nStart writing… Supports **bold**, *italic*, \`code\`, and - lists. Ctrl/Cmd+B/I/E for quick formatting.`}
              className="w-full min-h-32 bg-transparent outline-none text-xs text-white/80 placeholder:text-white/20 resize-none leading-relaxed font-mono"
              wrapperClassName="flex flex-col gap-1"
              variant="light"
            />
          ) : (
            content.trim()
              ? <Markdown text={content} tone="dark" size="xs" />
              : <p className="text-[10px] text-white/20 italic">{readOnly ? "Empty note." : "Empty note — click ✎ Edit to start writing."}</p>
          )}
        </div>
      )}
    </div>
  )
}

function LinkedNotesSection({ objects, linkedRefs, onChange, onCreateNote, readOnly, card }: {
  objects: userInfo.Objects[]
  linkedRefs: LinkedNoteRef[]
  onChange: (refs: LinkedNoteRef[]) => void
  onCreateNote: () => Promise<string>
  readOnly: boolean
  card: string
}) {
  const [pickerValue, setPickerValue]     = useState("")
  const [expandedId, setExpandedId]       = useState<string | null>(null)
  const [pendingEditId, setPendingEditId] = useState<string | null>(null)
  const [creating, setCreating]           = useState(false)

  const linkable = objects.filter(o =>
    (o.type === "note" || o.type === "folder") && !linkedRefs.some(r => r.id === o.id)
  )

  function handleAdd() {
    if (!pickerValue) return
    const obj = objects.find(o => o.id === pickerValue)
    if (!obj) return
    onChange([...linkedRefs, { id: obj.id, type: obj.type === "folder" ? "folder" : "note" }])
    setPickerValue("")
  }
  function handleRemove(id: string) { onChange(linkedRefs.filter(r => r.id !== id)) }

  async function handleCreate() {
    setCreating(true)
    try {
      const id = await onCreateNote()
      setExpandedId(id)
      setPendingEditId(id)
    } catch (e) {
      console.error(e)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className={`${card} p-3 flex flex-col gap-2`}>
      <div className="flex items-center justify-between shrink-0 gap-2">
        <span className="text-[10px] uppercase tracking-widest text-white/50 font-semibold">Linked Notes</span>
        {!readOnly && (
          <button type="button" onClick={handleCreate} disabled={creating}
            className="text-sm px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors disabled:opacity-40 ml-auto">
            {creating ? "Creating…" : "+ New Note"}
          </button>
        )}
      </div>

      {!readOnly && linkable.length > 0 && (
        <div className="flex items-center gap-2">
          <select value={pickerValue} onChange={e => setPickerValue(e.target.value)}
            className="flex-1 min-w-0 bg-zinc-800 rounded-lg px-3 py-2 text-xs text-white outline-none">
            <option value="" className="bg-zinc-800 text-white">Link a note or folder…</option>
            {linkable.map(o => <option key={o.id} value={o.id} className="bg-zinc-800 text-white">{o.type === "folder" ? "📁 " : ""}{o.name}</option>)}
          </select>
          <button type="button" onClick={handleAdd} disabled={!pickerValue}
            className="text-xs px-3 py-2 rounded-lg bg-primary/80 hover:bg-primary disabled:opacity-30 disabled:cursor-default text-white font-semibold transition-colors shrink-0">
            Link
          </button>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {linkedRefs.length === 0 && (
          <p className="text-xs text-white/25 italic">No notes linked yet — click "+ New Note", or link an existing note/folder above.</p>
        )}
        {linkedRefs.map(ref => {
          const obj = objects.find(o => o.id === ref.id)
          if (!obj) {
            return (
              <div key={ref.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5">
                <span className="text-xs text-white/30 italic">Not found (deleted?)</span>
                {!readOnly && <LinkMenu onUnlink={() => handleRemove(ref.id)} itemLabel="reference" />}
              </div>
            )
          }

          if (ref.type === "folder") {
            const notes = getDescendantNotes(objects, ref.id)
            return (
              <div key={ref.id} className="rounded-lg bg-white/5 border border-white/10 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2">
                  <span className="text-xs font-semibold text-white/70 flex-1 min-w-0 truncate">📁 {obj.name}</span>
                  <span className="text-[10px] text-white/30 shrink-0">{notes.length} note{notes.length === 1 ? "" : "s"}</span>
                  {!readOnly && <LinkMenu onUnlink={() => handleRemove(ref.id)} itemLabel="folder" />}
                </div>
                {notes.length > 0 && (
                  <div className="flex flex-col gap-1 px-2 pb-2">
                    {notes.map(n => (
                      <InlineNote key={n.id} note={n} readOnly={readOnly}
                        expanded={expandedId === n.id}
                        onToggle={() => setExpandedId(expandedId === n.id ? null : n.id)}
                        autoEdit={pendingEditId === n.id}
                        onAutoEditConsumed={() => setPendingEditId(null)} />
                    ))}
                  </div>
                )}
              </div>
            )
          }

          return (
            <InlineNote key={ref.id} note={obj} readOnly={readOnly}
              expanded={expandedId === ref.id}
              onToggle={() => setExpandedId(expandedId === ref.id ? null : ref.id)}
              onRemove={!readOnly ? () => handleRemove(ref.id) : undefined}
              autoEdit={pendingEditId === ref.id}
              onAutoEditConsumed={() => setPendingEditId(null)} />
          )
        })}
      </div>
    </div>
  )
}

// ── Main InfoTab component ────────────────────────────────────────────────────

const SUB_TABS: [InfoSubTab, string][] = [
  ["overview",   "Notes"],
  ["raceFeats",  "Race & Feats"],
  ["features",   "Features"],
  ["items",      "Armor & Items"],
  ["profs",      "Proficiencies"]
]

export function InfoTab({ data, update, onChangeFeature, onRemoveFeature, onLinkToggle, theme, card, readOnly, userId, objects, createObject, favorites, onToggleFavorite, onAddItemToEquipment, equipmentLinkedIds, subTab, onSubTabChange, isWarlock, isArtificer }: InfoTabProps) {

  const pb = profBonus(data.level ?? 1)

  // Opens a newly-added Carried Item straight into its edit form instead of
  // dropping an unnamed collapsed row into the list — same pattern as the
  // spell list's pendingSpellId (see CharacterSheet.tsx).
  const [pendingItemId, setPendingItemId] = useState<string | null>(null)

  // Feature Stylings (Settings) applied sheet-wide — same source of truth
  // FavoritesPanel.tsx reads, just resolved per fixed list here since each of
  // these lists is a single, known category. "item" (the Items tab) is
  // deliberately never looked up — it already has its own Magic Item styling.
  const favAccentColor = (cat: FavoriteCategory) => data.favoriteCategoryColors?.[cat]
  const favAccentStyle = (cat: FavoriteCategory) => data.favoriteCategoryStyle?.[cat]
  const favSliderStyle = (cat: FavoriteCategory) => data.favoriteCategorySliderStyle?.[cat]

  // Settings' "Separate color per class" — resolves each Class Feature's own
  // accent from its `source` (e.g. "Fighter (Champion)") instead of the one
  // shared favoriteCategoryColors.class swatch.
  const classFeatureAccentColor = data.classFeatureColorsByClass
    ? (f: Feature) => {
        const key = matchClassKey(f.source)
        return key ? data.classFeatureColors?.[key] : undefined
      }
    : undefined

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

  type FeatureKey = "racialTraits" | "feats" | "classFeatures" | "items" | "invocations" | "infusions"

  function addFeature(key: FeatureKey, patch?: Partial<Feature>) {
    update({ [key]: [...(data[key] ?? []), { id: nanoid(), name: "", ...patch }] })
  }

  function addCarriedItem(parentId?: string) {
    const id = nanoid()
    addFeature("items", { id, category: "item", parentId })
    setPendingItemId(id)
  }

  // ── Linked Notes helpers — create a real sidebar Note object and link it ──

  async function handleCreateNote(): Promise<string> {
    const name = uniqueName("New Note", objects.filter(o => o.type === "note").map(o => o.name))
    const note = await createObject({ name, type: "note" })
    update({ linkedNoteRefs: [...(data.linkedNoteRefs ?? []), { id: note.id, type: "note" }] })
    return note.id
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

          <div className={`${card} p-3 flex flex-col gap-2`}>
            <span className="text-[10px] uppercase tracking-widest text-white/50 font-semibold">Background</span>
            <input value={data.background ?? ""} onChange={e => update({ background: e.target.value })}
              placeholder="Acolyte, Sage…" disabled={readOnly}
              className="bg-transparent outline-none text-xs text-white placeholder:text-white/20 border-b border-white/10 pb-1 disabled:opacity-60" />
            <input value={data.alignment ?? ""} onChange={e => update({ alignment: e.target.value })}
              placeholder="Alignment…" disabled={readOnly}
              className="bg-transparent outline-none text-xs text-white placeholder:text-white/20 disabled:opacity-60" />
          </div>

          <div className={`${card} p-3 flex flex-col gap-2`}>
            <span className="text-[10px] uppercase tracking-widest text-white/50 font-semibold">Description</span>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              {([
                ["age", "Age"], ["height", "Height"], ["weight", "Weight"],
                ["eyes", "Eyes"], ["skin", "Skin"], ["hair", "Hair"],
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

          {data.multiclass && data.classes && data.classes.length > 1 && (
            <div className={`${card} p-3 flex flex-col gap-2`}>
              <span className="text-[10px] uppercase tracking-widest text-white/50 font-semibold">Classes</span>
              {data.classes.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-white/70 flex-1">{c.cls}</span>
                  <span className="text-white/40">Lv {c.level}</span>
                </div>
              ))}
            </div>
          )}

          <LinkedNotesSection
            objects={objects}
            linkedRefs={data.linkedNoteRefs ?? []}
            onChange={refs => update({ linkedNoteRefs: refs })}
            onCreateNote={handleCreateNote}
            readOnly={readOnly}
            card={card}
          />
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
            onAdd={() => addFeature("feats")}
            onChange={onChangeFeature}
            onRemove={onRemoveFeature}
            onLinkToggle={onLinkToggle}
            theme={theme} card={card} readOnly={readOnly} pb={pb}
            suggestionSource="feat" userId={userId}
            favorites={favorites} onToggleFavorite={onToggleFavorite}
            accentColor={favAccentColor("feat")} accentStyle={favAccentStyle("feat")} sliderStyle={favSliderStyle("feat")}
          />
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
        <FeatureList
          items={data.classFeatures ?? []} allFeatures={allFeatures} label="Class Features"
          onAdd={() => addFeature("classFeatures")}
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
      )}

      {/* ── Armor & Items ─────────────────────────────────────────────────── */}

      {subTab === "items" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 min-h-0">
          <FeatureList
            items={(data.items ?? []).filter(i => i.category === "armor" && i.equipped)} allFeatures={allFeatures} label="Equipped"
            onAdd={() => addFeature("items", { category: "armor", equipped: true })}
            onChange={onChangeFeature}
            onRemove={onRemoveFeature}
            onLinkToggle={onLinkToggle}
            theme={theme} card={card} readOnly={readOnly} pb={pb}
            suggestionSource="item" userId={userId}
            favorites={favorites} onToggleFavorite={onToggleFavorite}
            onAddToEquipment={onAddItemToEquipment}
            equipmentLinkedIds={equipmentLinkedIds}
            showAttunement
            showItemExtras
            showMagicStar={data.showMagicItemStar} magicItemStyle={data.magicItemStyle} magicItemColor={data.magicItemColor} magicItemSliderStyle={data.magicItemSliderStyle}
          />
          {/* Everything not equipped lands here — armor/weapons you own but
              aren't wearing, and every generic item (which has no Equip
              checkbox at all, so it can never leave this list on its own). */}
          <ContainerItemsList
            items={(data.items ?? []).filter(i => !(i.category === "armor" && i.equipped))} allFeatures={allFeatures}
            onAdd={addCarriedItem}
            onChange={onChangeFeature}
            onRemove={onRemoveFeature}
            onLinkToggle={onLinkToggle}
            theme={theme} card={card} readOnly={readOnly} pb={pb}
            userId={userId}
            favorites={favorites} onToggleFavorite={onToggleFavorite}
            showMagicStar={data.showMagicItemStar} magicItemStyle={data.magicItemStyle} magicItemColor={data.magicItemColor} magicItemSliderStyle={data.magicItemSliderStyle}
            pendingItemId={pendingItemId} onAutoEditConsumed={() => setPendingItemId(null)}
          />
        </div>
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
