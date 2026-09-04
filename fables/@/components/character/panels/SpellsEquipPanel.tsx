import { useState } from "react"
import type { CharacterData, SpellItem, Feature, SpellSlot, FavoriteRef } from "@/components/shared/types"
import { SpellEntry } from "../entries/SpellEntry"
import { FeatureEntry } from "../entries/FeatureEntry"
import { TracingSlider }  from "../../ui/tracing-slider"
import { slotLevelColor, slotLevelGradient } from "@/components/shared/themes"
import type { Theme, SlotTheme } from "@/components/shared/themes"
import { profBonus, reorderSubset } from "@/components/shared/utils"
import { SAVE_TO_ABILITY, type FavoriteCategory } from "@/components/shared/constants"
import { Modal } from "@/components/shared/ui/Modal"
import { MartialModal } from "../modals/stats/MartialModal"
import { DndContext, DragOverlay, closestCenter, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable"
import { SortableItem, DragOverlayCard, useDragSensors } from "@/components/shared/SortableItem"

// Master-toggle "Cast" button (Automation → Cast tab → "Show Cast button")
// sitting next to the Cantrips stat rather than one button per spell row —
// see SpellEntry.tsx's note on why that wasn't mobile-friendly. Opens a full
// modal (not a small anchored popover) listing just the spells enabled for
// Cast in Automation, styled with the character's own theme.
function CastButton({ theme, spells, onCast }: { theme: Theme; spells: SpellItem[]; onCast: (spell: SpellItem) => void }) {
  const [open, setOpen] = useState(false)
  // Set while choosing which of a spell's castVariants applies — mirrors
  // AutomationModal.tsx's CastTab variant prompt, needed here too since
  // this button is the other (more commonly used) way to actually cast.
  const [variantSpell, setVariantSpell] = useState<SpellItem | null>(null)

  function pick(s: SpellItem) {
    if (s.castVariants?.length) { setVariantSpell(s); return }
    onCast(s)
    setOpen(false)
  }
  function pickVariant(s: SpellItem, v: NonNullable<SpellItem["castVariants"]>[number]) {
    onCast({ ...s, castFormId: v.castFormId, castConditionalId: v.castConditionalId })
    setVariantSpell(null)
    setOpen(false)
  }

  return (
    <div className="flex flex-col items-center leading-none gap-0.5 shrink-0">
      <button type="button" onClick={() => setOpen(true)} disabled={spells.length === 0}
        title={spells.length === 0 ? "Enable a spell for Cast in Automation first" : "Cast a spell"}
        className={`size-6 pl-6 pr-6 py-4 text-sm flex items-center justify-center rounded-sm ring-1 transition-colors disabled:opacity-30 disabled:cursor-default ${theme.ring} ${theme.color} hover:bg-white/10`}>
        Cast
      </button>

      {open && (
        <Modal onClose={() => { setOpen(false); setVariantSpell(null) }}>
          <div className="bg-zinc-900 border border-white/15 rounded-2xl shadow-2xl w-[min(420px,92vw)] max-h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
              <p className={`text-sm font-bold ${theme.color}`}>
                {variantSpell ? `Which effect? — ${variantSpell.name || "Unnamed Spell"}` : "Cast a Spell"}
              </p>
              <button type="button" onClick={() => { setOpen(false); setVariantSpell(null) }}
                className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-1.5">
              {variantSpell ? (
                <>
                  <button type="button" onClick={() => setVariantSpell(null)}
                    className="text-xs text-white/40 hover:text-white self-start transition-colors mb-1">← Back</button>
                  {(variantSpell.castVariants ?? []).map(v => (
                    <button key={v.id} type="button" onClick={() => pickVariant(variantSpell, v)}
                      className={`text-left px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-white/80 hover:text-white transition-colors truncate border border-transparent hover:ring-1 ${theme.ring}`}>
                      {v.label || "Unnamed variant"}
                    </button>
                  ))}
                </>
              ) : (
                <>
                  {spells.length === 0 && (
                    <p className="text-sm text-white/30 italic text-center py-6">No spells enabled for Cast — set that up in Automation.</p>
                  )}
                  {spells.map(s => (
                    <button key={s.id} type="button" onClick={() => pick(s)}
                      className={`text-left px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-white/80 hover:text-white transition-colors truncate border border-transparent hover:ring-1 ${theme.ring}`}>
                      {s.name || "Unnamed Spell"}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

interface Props {
  card: string
  theme: Theme
  data: CharacterData
  readOnly?: boolean
  userId?: string | null
  spellItems: SpellItem[]
  allFeatures: Feature[]
  spellSlots: SpellSlot[]
  slotTheme: SlotTheme
  slotAnimated?: boolean
  characterId: string
  activeSubTab: "spells" | "martial"
  onChangeSubTab: (v: "spells" | "martial") => void
  onShowSpellcastingModal: () => void
  onChangeSlot: (id: string, patch: Partial<SpellSlot>) => void
  onAddSpell: () => void
  onChangeSpell: (id: string, patch: Partial<SpellItem>) => void
  onRemoveSpell: (id: string) => void
  pendingSpellId?: string | null
  onAutoEditConsumed?: () => void
  onAddMartialWeapon: () => void
  onChangeFeature: (id: string, patch: Partial<Feature>) => void
  onRemoveFeature: (id: string) => void
  onLinkToggle: (featureId: string, otherId: string) => void
  onCastSpell?: (spell: SpellItem) => void  // Automation — wired only when data.castButtonEnabled shows the Cast button
  favorites?: FavoriteRef[]
  onToggleFeatureFavorite?: (id: string, label: string) => void
  onUpdate: (patch: Partial<CharacterData>) => void
}

export function SpellsEquipPanel({
  card, theme, data, readOnly, userId,
  spellItems, allFeatures, spellSlots, slotTheme, slotAnimated, characterId,
  activeSubTab, onChangeSubTab,
  onShowSpellcastingModal, onChangeSlot,
  onAddSpell, onChangeSpell, onRemoveSpell,
  onAddMartialWeapon, onChangeFeature, onRemoveFeature, onLinkToggle,
  pendingSpellId, onAutoEditConsumed,
  onCastSpell, favorites, onToggleFeatureFavorite, onUpdate,
}: Props) {
  const [showMartialModal, setShowMartialModal] = useState(false)
  // Settings — a martial-only or caster-only character can hide the side
  // they never use so this panel stops reading as "half empty" whichever way
  // they look. If someone somehow enables both at once, neither takes effect
  // (falls back to showing the normal switcher) rather than hiding everything.
  const spellsHidden  = !!data.hideSpellsSection  && !data.hideMartialSection
  const martialHidden = !!data.hideMartialSection && !data.hideSpellsSection
  const showSubTabSwitcher = !spellsHidden && !martialHidden
  const showSpells = martialHidden ? true : spellsHidden ? false : activeSubTab === "spells"
  // Feature Stylings (Settings) applied sheet-wide, mirrors InfoTab.tsx's favAccentColor/favAccentStyle.
  const favAccentColor = (cat: FavoriteCategory) => data.favoriteCategoryColors?.[cat]
  const favAccentStyle = (cat: FavoriteCategory) => data.favoriteCategoryStyle?.[cat]
  // Settings' "Modules and Font Size" — sheet-wide text color switch.
  const bodyTextColor = data.textColorOverride === "dark" ? "black" as const : undefined
  const [hideUnprepared, setHideUnprepared] = useState(() => {
    try { return localStorage.getItem(`fables-prep-filter-${characterId}`) === "1" } catch { return false }
  })
  // Rituals are castable whether or not they're prepared, so "Prepared
  // only" alone hides exactly the spells this filter exists to surface —
  // an unprepared ritual you'd forgotten you had. Independent of (and ANDed
  // with) hideUnprepared, not a replacement for it.
  const [ritualOnly, setRitualOnly] = useState(() => {
    try { return localStorage.getItem(`fables-ritual-filter-${characterId}`) === "1" } catch { return false }
  })
  const [collapsedLevels, setCollapsedLevels] = useState<Set<number>>(() => {
    try {
      const raw = localStorage.getItem(`fables-spell-collapsed-${characterId}`)
      return raw ? new Set(JSON.parse(raw) as number[]) : new Set()
    } catch { return new Set() }
  })

  const slotDisplay    = data.spellSlotDisplay ?? "integrated"
  const spellsDisplay  = data.spellsDisplay ?? "list"
  // Cantrips are always considered prepared/available — they don't count
  // against the Prepared total (that's leveled spells only) or Known either.
  const preparedCount  = spellItems.filter(s => s.prepared && !s.alwaysPrepared && !s.freeSpell && (s.level ?? 0) > 0).length
  const knownCount     = spellItems.filter(s => s.alwaysPrepared && !s.freeSpell && (s.level ?? 0) > 0).length
  const cantripCount   = spellItems.filter(s => (s.level ?? 0) === 0 && !s.freeSpell).length
  const isSpellVisible = (s: SpellItem) =>
    !!(!hideUnprepared || s.prepared || s.alwaysPrepared || (s.level ?? 0) === 0) &&
    (!ritualOnly || !!s.ritual)
  const visibleSpells  = spellItems
    .filter(isSpellVisible)
    .slice()
    .sort((a, b) => (a.level ?? 0) - (b.level ?? 0))

  // Hoisted out of the render below so handleSpellDragEnd can determine
  // which group (Pinned, or a given level) a dragged spell belongs to —
  // same grouping the render uses to actually draw the Pinned section and
  // level headers.
  const pinnedSpells = visibleSpells.filter(s => s.pinned)
  const groupedSpells = new Map<number, SpellItem[]>()
  for (const s of visibleSpells) {
    const lvl = s.level ?? 0
    if (!groupedSpells.has(lvl)) groupedSpells.set(lvl, [])
    groupedSpells.get(lvl)!.push(s)
  }
  if (slotDisplay === "integrated") {
    for (const slot of spellSlots) {
      if (!groupedSpells.has(slot.level)) groupedSpells.set(slot.level, [])
    }
  }
  const spellLevels = Array.from(groupedSpells.keys()).sort((a, b) => a - b)

  const dragSensors = useDragSensors()
  // Which row is currently being dragged — drives the floating
  // DragOverlayCard clone (see SortableItem.tsx for why the in-place row
  // doesn't try to follow the pointer itself). Spells and Martial weapons
  // never show at the same time (showSpells toggles between them), so one
  // id tracks whichever DndContext is actually active.
  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  // Reordering only makes sense within a group: dragging one pinned spell
  // past another, or one same-level spell past another — cross-group drops
  // (a level change) stay the job of editing the spell's Level field, same
  // as the comment on levels.flatMap below already explains. Merges back
  // into spellItems via the same isSpellVisible predicate the visible
  // groups were built from, so a "Prepared only" filter hiding some
  // same-level spells doesn't throw off the fold-back.
  function handleSpellDragEnd(event: DragEndEvent) {
    setActiveDragId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    if (pinnedSpells.some(s => s.id === active.id) && pinnedSpells.some(s => s.id === over.id)) {
      const oldIndex = pinnedSpells.findIndex(s => s.id === active.id)
      const newIndex = pinnedSpells.findIndex(s => s.id === over.id)
      const reordered = arrayMove(pinnedSpells, oldIndex, newIndex)
      onUpdate({ spellItems: reorderSubset(spellItems, s => !!s.pinned && isSpellVisible(s), reordered) })
      return
    }
    const activeSpell = spellItems.find(s => s.id === active.id)
    if (!activeSpell) return
    const lvl = activeSpell.level ?? 0
    const group = groupedSpells.get(lvl) ?? []
    const oldIndex = group.findIndex(s => s.id === active.id)
    const newIndex = group.findIndex(s => s.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(group, oldIndex, newIndex)
    onUpdate({ spellItems: reorderSubset(spellItems, s => (s.level ?? 0) === lvl && isSpellVisible(s), reordered) })
  }

  // A weapon shows here either because it was sent over from Gear
  // (inMartial) or made directly here (martialOnly, e.g. fists/natural
  // attacks) — same Feature, same FeatureEntry card, wherever it renders.
  const isMartialWeapon = (i: Feature) => i.equipKind === "weapon" && !!(i.inMartial || i.martialOnly)
  const martialWeapons = (data.items ?? []).filter(isMartialWeapon)

  function handleMartialDragEnd(event: DragEndEvent) {
    setActiveDragId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = martialWeapons.findIndex(i => i.id === active.id)
    const newIndex = martialWeapons.findIndex(i => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(martialWeapons, oldIndex, newIndex)
    onUpdate({ items: reorderSubset(data.items ?? [], isMartialWeapon, reordered) })
  }

  // Shared by both the Pinned section and per-level groups below AND the
  // DragOverlay clone — pixel-identical to whichever row it came from.
  // Pinned rows always have spell.pinned true, so `{ pinned: !spell.pinned }`
  // unpins there exactly like the old pinned-only handler did.
  function renderSpellCard(spell: SpellItem) {
    return (
      <SpellEntry spell={spell} theme={theme} readOnly={readOnly} classes={availableClasses}
        compact={spellsDisplay === "bubbles"}
        autoEdit={spell.id === pendingSpellId} onAutoEditConsumed={onAutoEditConsumed}
        accentColor={favAccentColor("spell")} accentStyle={favAccentStyle("spell")} bodyTextColor={bodyTextColor}
        showKnownBadge={data.showKnownBadge}
        isPinned={!!spell.pinned} onTogglePin={() => onChangeSpell(spell.id, { pinned: !spell.pinned })}
        onChange={p => onChangeSpell(spell.id, p)} onRemove={() => onRemoveSpell(spell.id)} />
    )
  }

  // Shared by the Martial list below AND its DragOverlay clone.
  function renderMartialCard(feature: Feature) {
    return (
      <FeatureEntry
        feature={feature}
        allFeatures={allFeatures.filter(a => a.id !== feature.id && a.trackable)}
        theme={theme} readOnly={readOnly} pb={pb} statMods={statMods}
        suggestionSource="item" userId={userId}
        isFavorite={favorites?.some(f => f.refId === feature.id)}
        onToggleFavorite={onToggleFeatureFavorite ? () => onToggleFeatureFavorite(feature.id, feature.name || "Item") : undefined}
        showItemExtras
        showMagicStar={data.showMagicItemStar}
        magicItemStyle={data.magicItemStyle}
        magicItemColor={data.magicItemColor}
        magicItemSliderStyle={data.magicItemSliderStyle}
        magicItemColorsByRarity={data.magicItemColorsByRarity}
        magicItemRarityColors={data.magicItemRarityColors}
        magicItemRaritySliderColors={data.magicItemRaritySliderColors}
        accentColor={favAccentColor("equipment")} accentStyle={favAccentStyle("equipment")} bodyTextColor={bodyTextColor}
        onChange={patch => onChangeFeature(feature.id, patch)}
        onRemove={() => onRemoveFeature(feature.id)}
        onLinkToggle={otherId => onLinkToggle(feature.id, otherId)}
      />
    )
  }

  const statMods = {
    str: Math.floor(((data.strength     ?? 10) - 10) / 2),
    dex: Math.floor(((data.dexterity    ?? 10) - 10) / 2),
    con: Math.floor(((data.constitution ?? 10) - 10) / 2),
    int: Math.floor(((data.intelligence ?? 10) - 10) / 2),
    wis: Math.floor(((data.wisdom       ?? 10) - 10) / 2),
    cha: Math.floor(((data.charisma     ?? 10) - 10) / 2),
  }

  const pb = profBonus(data.level ?? 1)

  // Save DC / attack bonus are computed from the spellcasting ability + PB,
  // plus an optional flat extra bonus (magic items, feats) set in the spellcasting modal.
  const spellAbilityKey = data.spellcastingAbility ? SAVE_TO_ABILITY[data.spellcastingAbility.toLowerCase()] : undefined
  const spellAbilityMod = spellAbilityKey ? Math.floor(((data[spellAbilityKey as keyof CharacterData] as number ?? 10) - 10) / 2) : 0
  const computedSaveDC   = data.spellcastingAbility ? 8 + pb + spellAbilityMod + (data.spellSaveDCBonus ?? 0) : undefined
  const computedAtkBonus = data.spellcastingAbility ? pb + spellAbilityMod + (data.spellAttackBonusBonus ?? 0) : undefined

  // Classes available to tag a spell's source (multiclass casters can know/prepare from more than one)
  const availableClasses = data.multiclass && data.classes?.length
    ? data.classes.map(c => c.cls).filter(Boolean)
    : (data.class ? [data.class] : [])

  return (
    <div className={`${card} p-4 flex flex-col gap-3`}>

      {/* Header */}
      <div className="flex flex-col gap-2 shrink-0">
        <div className="flex items-center gap-2">
          {showSubTabSwitcher ? (
            <div className="flex items-center gap-1 rounded-full bg-white/10 p-0.5 shrink-0">
              <button type="button" onClick={() => onChangeSubTab("spells")}
                className={`text-xs px-3 py-1 rounded-full font-semibold transition-colors ${showSpells ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70"}`}>
                Spells
              </button>
              <button type="button" onClick={() => onChangeSubTab("martial")}
                className={`text-xs px-3 py-1 rounded-full font-semibold transition-colors ${!showSpells ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70"}`}>
                Martial
              </button>
            </div>
          ) : (
            <span className="text-xs font-bold uppercase tracking-widest text-white/50 shrink-0">{showSpells ? "Spells" : "Martial"}</span>
          )}
          {showSpells && (
            <button type="button" onClick={onShowSpellcastingModal}
              className="size-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors ml-auto shrink-0"
              title="Configure spellcasting">⚙</button>
          )}
          {!showSpells && (
            <button type="button" onClick={() => setShowMartialModal(true)}
              className="size-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors ml-auto shrink-0"
              title="Configure Martial">⚙</button>
          )}
        </div>

        {showSpells && (
          <div className="flex items-center gap-4 flex-wrap min-w-0">
            {data.spellcastingAbility && (
              <div className="flex flex-col items-center leading-none gap-0.5">
                <span className="text-base font-bold text-white/70 uppercase tracking-wider">{data.spellcastingAbility}</span>
                <span className="text-[10px] text-white/35 uppercase tracking-wider">Ability</span>
              </div>
            )}
            <div className="flex flex-col items-center leading-none gap-0.5">
              <span className="text-lg font-bold text-white tabular-nums">{computedSaveDC ?? "—"}</span>
              <span className="text-[10px] text-white/40 uppercase tracking-wider">Save DC</span>
            </div>
            <div className="flex flex-col items-center leading-none gap-0.5">
              <span className="text-lg font-bold text-white tabular-nums">{computedAtkBonus != null ? `+${computedAtkBonus}` : "—"}</span>
              <span className="text-[10px] text-white/40 uppercase tracking-wider">Spell Atk</span>
            </div>
            {!!data.spellsPrepared && (
              <div className="flex flex-col items-center leading-none gap-0.5">
                <span className={`text-lg font-bold tabular-nums ${preparedCount > data.spellsPrepared ? "text-red-400" : "text-white"}`}>
                  {preparedCount}<span className="text-white/30 text-sm">/{data.spellsPrepared}</span>
                </span>
                <span className="text-[10px] text-white/40 uppercase tracking-wider">Prepared</span>
              </div>
            )}
            <div className="flex flex-col items-center leading-none gap-0.5">
              <span className={`text-lg font-bold tabular-nums ${knownCount > (data.spellsKnown ?? Infinity) ? "text-red-400" : "text-white"}`}>
                {knownCount}<span className="text-white/30 text-sm">/{data.spellsKnown ?? "—"}</span>
              </span>
              <span className="text-[10px] text-white/40 uppercase tracking-wider">Known</span>
            </div>
            <div className="flex flex-col items-center leading-none gap-0.5">
              <span className={`text-lg font-bold tabular-nums ${cantripCount > (data.cantripsKnown ?? Infinity) ? "text-red-400" : "text-white"}`}>
                {cantripCount}<span className="text-white/30 text-sm">/{data.cantripsKnown ?? "—"}</span>
              </span>
              <span className="text-[10px] text-white/40 uppercase tracking-wider">Cantrips</span>
            </div>
            {!!data.invocationsKnown && (
              <div className="flex flex-col items-center leading-none gap-0.5">
                <span className="text-lg font-bold text-white tabular-nums">{data.invocationsKnown}</span>
                <span className="text-[10px] text-white/40 uppercase tracking-wider">Invocations</span>
              </div>
            )}
            {data.castButtonEnabled && onCastSpell && (
              <CastButton theme={theme} spells={spellItems.filter(s => s.castEnabled)} onCast={onCastSpell} />
            )}
          </div>
        )}

        {/* Martial's own stat row — mirrors Spells' Save DC/Atk tiles above so
            a martial character doesn't read as the "lesser" half of this
            panel. Fully optional (unlike spellcasting, most martial
            abilities don't call for a DC), set from its own modal (the ⚙
            above) rather than a popover — same as Spellcasting's — and
            entirely absent, not just blank, whenever nothing's set. */}
        {!showSpells && !!data.martialSaveDC && (
          <div className="flex items-center gap-4 flex-wrap min-w-0">
            <button type="button" onClick={() => !readOnly && setShowMartialModal(true)}
              className="flex flex-col items-center leading-none gap-0.5 hover:opacity-80 transition-opacity">
              <span className="text-lg font-bold text-white tabular-nums">{data.martialSaveDC}</span>
              <span className="text-[10px] text-white/40 uppercase tracking-wider">Martial DC</span>
            </button>
          </div>
        )}
      </div>

      {showMartialModal && (
        <MartialModal data={data} readOnly={readOnly} onUpdate={onUpdate}
          onClose={() => setShowMartialModal(false)} accentColor={theme.accent} />
      )}

      {/* Spell slots — standalone block in Classic mode; Integrated mode merges them into the level headers below */}
      {showSpells && slotDisplay === "classic" && spellSlots.length > 0 && (
        <div className="flex flex-col gap-2 border-b border-white/10 pb-3 shrink-0">
          {spellSlots.map(slot => {
            const rem = Math.max(0, slot.total - slot.used)
            return (
              <div key={slot.id} className="flex items-center gap-2">
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs text-white/50 w-8 shrink-0">Lv {slot.level}</span>
                  {slot.pact && (
                    <span className="text-[10px] px-1 py-0.5 rounded bg-violet-500/20 text-violet-300 font-semibold leading-none">Pact</span>
                  )}
                </div>
                <TracingSlider
                  value={rem} max={slot.total} disabled={readOnly}
                  showButtons buttonSize="sm"
                  className=""
                  color={slotAnimated ? slotLevelGradient(slotTheme, slot.level) : slotLevelColor(slotTheme, slot.level)}
                  animated={slotAnimated}
                  onChange={val => onChangeSlot(slot.id, { used: Math.max(0, slot.total - val) })}
                />
                <span className="text-xs text-white/30 w-8 text-right tabular-nums shrink-0">{rem}/{slot.total}</span>
              </div>
            )
          })}
        </div>
      )}
      {showSpells && spellSlots.length === 0 && !readOnly && (
        <button type="button" onClick={onShowSpellcastingModal}
          className="text-xs text-white/30 hover:text-white/60 transition-colors text-left shrink-0">
          + Add spell slots
        </button>
      )}

      {/* Filter controls */}
      {showSpells && (
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button type="button"
            onClick={() => setHideUnprepared(h => {
              const next = !h
              try { localStorage.setItem(`fables-prep-filter-${characterId}`, next ? "1" : "0") } catch {}
              return next
            })}
            className={`text-xs px-2.5 py-0.5 rounded-full font-semibold transition-colors border ${hideUnprepared ? "bg-primary/20 border-primary/50 text-white" : "border-white/15 text-white/40 hover:text-white/70 hover:border-white/30"}`}>
            Prepared only
          </button>
          <button type="button" title="Rituals can be cast whether prepared or not — this ignores Prepared only"
            onClick={() => setRitualOnly(r => {
              const next = !r
              try { localStorage.setItem(`fables-ritual-filter-${characterId}`, next ? "1" : "0") } catch {}
              return next
            })}
            className={`text-xs px-2.5 py-0.5 rounded-full font-semibold transition-colors border ${ritualOnly ? "bg-amber-500/20 border-amber-400/50 text-white" : "border-white/15 text-white/40 hover:text-white/70 hover:border-white/30"}`}>
            Ritual only
          </button>
          {(hideUnprepared || ritualOnly) && visibleSpells.length === 0 && (
            <span className="text-xs text-white/25 italic">
              {ritualOnly && hideUnprepared ? "No prepared rituals" : ritualOnly ? "No rituals" : "No prepared spells"}
            </span>
          )}
        </div>
      )}

      {/* Spell / martial list */}
      <div className="flex flex-col gap-1.5">
        {showSpells ? (
          <DndContext sensors={dragSensors} collisionDetection={closestCenter} onDragStart={e => setActiveDragId(String(e.active.id))} onDragEnd={handleSpellDragEnd} onDragCancel={() => setActiveDragId(null)}>
            {pinnedSpells.length > 0 && (
              <div className={`flex ${spellsDisplay === "bubbles" ? "flex-wrap gap-1.5" : "flex-col gap-1"} mb-2 pb-2 border-b border-white/10`}>
                <div className="w-full flex items-center gap-2 px-1 py-1">
                  <span className="text-sm font-bold uppercase tracking-widest text-white/75">🖈 Pinned</span>
                  <span className="text-xs text-white/40">({pinnedSpells.length})</span>
                </div>

                <SortableContext items={pinnedSpells.map(s => s.id)} strategy={verticalListSortingStrategy}>
                  {pinnedSpells.map(spell => (
                    <SortableItem key={spell.id} id={spell.id} disabled={readOnly || spellsDisplay === "bubbles"}>
                      {renderSpellCard(spell)}
                    </SortableItem>
                  ))}
                </SortableContext>
              </div>
            )}
            {/* Rendered as ONE flat list of siblings (not nested per-level containers) so
                that changing a spell's level — which moves it between groups — reorders it
                within the same parent instead of unmounting/remounting it (which would lose
                the spell's own open edit/detail modal state). */}
            <div className={`flex ${spellsDisplay === "bubbles" ? "flex-wrap gap-1.5" : "flex-col gap-1"}`}>
              {spellLevels.flatMap((lvl, idx) => {
                const spells       = groupedSpells.get(lvl)!
                const isOpen       = !collapsedLevels.has(lvl)
                const groupLabel   = lvl === 0 ? "Cantrips" : `Level ${lvl}`
                const matchingSlots = slotDisplay === "integrated" ? spellSlots.filter(s => s.level === lvl) : []
                // A visual break between level groups — skipped on the very
                // first group (nothing above it to separate from).
                const nodes: React.ReactNode[] = [
                  <div key={`header-${lvl}`}
                    className={`w-full flex items-center gap-3 px-1 py-1 rounded-lg hover:bg-white/5 transition-colors ${idx > 0 ? "mt-2 pt-3 border-t border-white/10" : ""}`}>
                    <button type="button"
                      onClick={() => setCollapsedLevels(prev => {
                        const next = new Set(prev)
                        next.has(lvl) ? next.delete(lvl) : next.add(lvl)
                        try { localStorage.setItem(`fables-spell-collapsed-${characterId}`, JSON.stringify([...next])) } catch {}
                        return next
                      })}
                      className="flex items-center gap-2 shrink-0 select-none">
                      <span className="text-sm font-bold uppercase tracking-widest text-white/75">{groupLabel}</span>
                      <span className="text-xs text-white/40">({spells.length})</span>
                    </button>
                    {matchingSlots.length > 0 && (
                      <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap">
                        {matchingSlots.map(slot => {
                          const rem = Math.max(0, slot.total - slot.used)
                          return (
                            <div key={slot.id} className="flex items-center gap-1.5 flex-1 min-w-35">
                              {slot.pact && (
                                <span className="text-[10px] px-1 py-0.5 rounded bg-violet-500/20 text-violet-300 font-semibold leading-none shrink-0">Pact</span>
                              )}
                              <TracingSlider
                                value={rem} max={slot.total} disabled={readOnly}
                                showButtons buttonSize="sm"
                                color={slotAnimated ? slotLevelGradient(slotTheme, slot.level) : slotLevelColor(slotTheme, slot.level)}
                                animated={slotAnimated}
                                onChange={val => onChangeSlot(slot.id, { used: Math.max(0, slot.total - val) })}
                                className="flex-1 min-w-0"
                              />
                              <span className="text-xs text-white/30 tabular-nums shrink-0">{rem}/{slot.total}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ]
                if (isOpen) {
                  nodes.push(
                    <SortableContext key={`group-${lvl}`} items={spells.map(s => s.id)} strategy={verticalListSortingStrategy}>
                      {spells.map(spell => (
                        <SortableItem key={spell.id} id={spell.id} disabled={readOnly || spellsDisplay === "bubbles"}>
                          {renderSpellCard(spell)}
                        </SortableItem>
                      ))}
                    </SortableContext>
                  )
                }
                return nodes
              })}
            </div>
            {!readOnly && (
              <button type="button" onClick={onAddSpell}
                className="text-sm text-white/40 hover:text-white border border-dashed border-white/15 hover:border-white/30 rounded-xl py-2.5 transition-colors shrink-0">
                + Add Spell
              </button>
            )}
            <DragOverlay>
              {(() => {
                const activeSpell = activeDragId ? visibleSpells.find(s => s.id === activeDragId) : undefined
                return activeSpell ? <DragOverlayCard>{renderSpellCard(activeSpell)}</DragOverlayCard> : null
              })()}
            </DragOverlay>
          </DndContext>
        ) : (
          <DndContext sensors={dragSensors} collisionDetection={closestCenter} onDragStart={e => setActiveDragId(String(e.active.id))} onDragEnd={handleMartialDragEnd} onDragCancel={() => setActiveDragId(null)}>
            <SortableContext items={martialWeapons.map(i => i.id)} strategy={verticalListSortingStrategy}>
              {martialWeapons.map(feature => (
                <SortableItem key={feature.id} id={feature.id} disabled={readOnly}>
                  {renderMartialCard(feature)}
                </SortableItem>
              ))}
            </SortableContext>
            {!readOnly && (
              <button type="button" onClick={onAddMartialWeapon}
                className="text-sm text-white/40 hover:text-white border border-dashed border-white/15 hover:border-white/30 rounded-xl py-2.5 transition-colors shrink-0">
                + Add Weapon
              </button>
            )}
            <DragOverlay>
              {(() => {
                const activeFeature = activeDragId ? martialWeapons.find(i => i.id === activeDragId) : undefined
                return activeFeature ? <DragOverlayCard>{renderMartialCard(activeFeature)}</DragOverlayCard> : null
              })()}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  )
}
