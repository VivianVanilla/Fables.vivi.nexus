// ════════════════════════════════════════════════════════════════════════════
// FavoritesPanel.tsx — drag-drop favorites panel
//
// Cards render the exact same entry component used elsewhere (SpellEntry,
// FeatureEntry) — favorites only adds an unfavorite star around it, it
// never re-implements the item's own display.
//
// Press and hold a card (mouse or touch) to reorder it — same SortableItem
// mechanism as every other reorderable list on the sheet. Dragging a card in
// from elsewhere (Gear, Spells, Martial) to add it as a favorite is still
// the older native-HTML5-drag mechanism (onDragOver/onDrop below,
// FeatureEntry.tsx/SpellEntry.tsx's own dragAttrs) — NOT yet migrated to
// dnd-kit (that needs one shared DndContext lifted above this panel and
// SpellsEquipPanel, a bigger change than the container-drag fix got). It
// likely has the same silent conflict on Spells/Martial rows (also
// SortableItem-wrapped there for reordering) that broke drag-to-container
// before that fix — the ⭐ click is the one favoriting path guaranteed to
// work everywhere in the meantime.
// ★ removes from favorites (not the underlying item).
// ════════════════════════════════════════════════════════════════════════════

import type { userInfo } from "@/types/userInfo"
import type { FavoriteRef, SpellItem, Feature, FamiliarRef } from "@/components/shared/types"
import type { MonsterData } from "@/components/shared/monster/monster-types"
import { SpellEntry } from "../entries/SpellEntry"
import { FeatureEntry, categoryAccentStyle } from "../entries/FeatureEntry"
import { FavoriteStar } from "../ui/FavoriteStar"
import { safeParseJson } from "@/components/shared/utils"
import { matchOwnClassKey } from "@/components/shared/classColors"
import type { Theme } from "@/components/shared/themes"
import { DEFAULT_ACCENT_COLOR, type FavoriteCategory, type CardStyle } from "@/components/shared/constants"
import { useState } from "react"
import { DndContext, DragOverlay, closestCenter, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { SortableItem, DragOverlayCard, useDragSensors } from "@/components/shared/SortableItem"

// ── Familiar favorite card — compact, resolves the linked Monster live ───────

function FamiliarFavoriteEntry({
  fam, monster, poppedOut, onPopOut, isFavorite, onToggleFavorite, accentColor, accentStyle, bgHex,
}: {
  fam: FamiliarRef; monster: userInfo.Objects; poppedOut: boolean; onPopOut: () => void
  isFavorite?: boolean; onToggleFavorite?: () => void; accentColor?: string; accentStyle?: CardStyle; bgHex?: string
}) {
  const mData = safeParseJson(monster.data) as MonsterData
  return (
    <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 flex items-center gap-2.5 min-h-11"
      style={categoryAccentStyle(accentColor, accentStyle, bgHex)}>
      <div className="size-8 rounded-lg overflow-hidden bg-white/5 ring-1 ring-white/10 shrink-0 flex items-center justify-center">
        {mData.portrait
          ? <img src={mData.portrait} alt="" className="w-full h-full object-cover" />
          : <span className="text-[9px] text-white/20">—</span>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{fam.nickname || monster.name}</p>
        <p className="text-[10px] text-white/40 uppercase tracking-wider">Familiar</p>
      </div>
      {onToggleFavorite && (
        <FavoriteStar isFavorite={!!isFavorite} onToggle={onToggleFavorite} />
      )}
      <button type="button" onClick={onPopOut} title={poppedOut ? "Already popped out" : "Pop out"}
        className={`size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-sm shrink-0 transition-colors ${poppedOut ? "text-primary" : "text-white/50 hover:text-white"}`}>
        ⧉
      </button>
    </div>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface FavoritesPanelProps {
  favorites:         FavoriteRef[]
  spellItems:        SpellItem[]
  features:          Feature[]
  familiars:         FamiliarRef[]
  monsters:          userInfo.Objects[]
  poppedOutIds:      Set<string>
  pb:                number
  statMods:          Record<string, number>
  classes:           string[]
  onRemove:          (refId: string) => void
  onReorder:         (fromIdx: number, toIdx: number) => void
  featureCategoryById:     Record<string, FavoriteCategory>  // resolves which of the 5 Feature lists a "feature"-type favorite came from
  favoriteCategoryColors?: Partial<Record<FavoriteCategory, string>>  // Settings (Feature Stylings) — accent color per category
  tagTextColor?:  "black" | "white"  // Settings — global override for the source tag + "Lv N" badge text color
  bodyTextColor?: "black" | "white"  // Settings — global override for each card's own description text color
  favoriteCategoryStyle?:  Partial<Record<FavoriteCategory, CardStyle>>  // Settings — none/outline/galaxy per category (card background)
  favoriteCategorySliderStyle?: Partial<Record<FavoriteCategory, CardStyle>>  // Settings — none/outline/galaxy per category (tracking slider, independent of the card background)
  favoriteCategorySliderColors?: Partial<Record<FavoriteCategory, string>>  // Settings — color of the tracking slider per category, independent of the card accent color above
  classFeatureColorsByClass?: boolean            // Settings — when true, favorited Class Features resolve their color from classFeatureColors (by source) instead of the shared favoriteCategoryColors.class
  classFeatureColors?: Record<string, string>    // Settings — card accent color per class key, only used when classFeatureColorsByClass is on — see character-class-colors.ts's matchClassKey
  classFeatureSliderColors?: Record<string, string>  // Settings — this class's own "Track uses" bar color — falls back to classFeatureColors when unset
  onChangeSpell:     (id: string, patch: Partial<SpellItem>) => void
  onRemoveSpell:     (id: string) => void
  onUpdateFeature:   (featureId: string, patch: Partial<Feature>) => void
  onRemoveFeature:   (featureId: string) => void
  onLinkToggle:      (featureId: string, otherId: string) => void
  onPopOutFamiliar:  (id: string) => void
  theme:             Theme
  card:              string
  readOnly:          boolean
  showMagicStar?:    boolean
  magicItemStyle?:   "none" | "outline" | "galaxy"
  magicItemColor?:   string
  magicItemSliderStyle?: "none" | "outline" | "galaxy"
  magicItemColorsByRarity?: boolean
  magicItemRarityColors?: Partial<Record<NonNullable<Feature["rarity"]>, string>>
  magicItemRaritySliderColors?: Partial<Record<NonNullable<Feature["rarity"]>, string>>
  dragOver:          boolean
  onDragOver:        (e: React.DragEvent) => void
  onDragLeave:       () => void
  onDrop:            (e: React.DragEvent) => void
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function FavoritesPanel({
  favorites, spellItems, features, familiars, monsters, poppedOutIds, pb, statMods, classes,
  onRemove, onReorder,
  featureCategoryById, favoriteCategoryColors, tagTextColor, bodyTextColor, favoriteCategoryStyle, favoriteCategorySliderStyle, favoriteCategorySliderColors,
  classFeatureColorsByClass, classFeatureColors, classFeatureSliderColors,
  onChangeSpell, onRemoveSpell,
  onUpdateFeature, onRemoveFeature, onLinkToggle, onPopOutFamiliar,
  theme, card, readOnly, showMagicStar, magicItemStyle, magicItemColor, magicItemSliderStyle,
  magicItemColorsByRarity, magicItemRarityColors, magicItemRaritySliderColors,
  dragOver, onDragOver, onDragLeave, onDrop,
}: FavoritesPanelProps) {
  const dragSensors = useDragSensors()
  // Which favorite is currently being dragged — drives the floating
  // DragOverlayCard clone below (see SortableItem.tsx's comment on why the
  // in-place row doesn't try to follow the pointer itself).
  const [activeId, setActiveId] = useState<string | null>(null)

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }
  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const fromIdx = favorites.findIndex(f => f.refId === active.id)
    const toIdx   = favorites.findIndex(f => f.refId === over.id)
    if (fromIdx === -1 || toIdx === -1) return
    onReorder(fromIdx, toIdx)
  }

  // ── Resolve helpers ──────────────────────────────────────────────────────

  function resolveSpell(refId: string)    { return spellItems.find(s => s.id === refId) }
  function resolveFeature(refId: string)  { return features.find(f => f.id === refId) }
  function resolveFamiliar(refId: string) { return familiars.find(f => f.id === refId) }

  function resolveCategory(fav: FavoriteRef): FavoriteCategory {
    if (fav.refType === "feature") return featureCategoryById[fav.refId] ?? "item"
    return fav.refType
  }
  // "item" never has a color/style set (Settings deliberately excludes it —
  // see STYLING_CATEGORIES), so this naturally resolves to undefined/"none"
  // for Items-tab favorites without any special-casing here.
  //
  // Class Features are the one category that can instead be colored per-class
  // (Settings' "Separate color per class") — when that's on, a favorited
  // Class Feature resolves its color from its own `source` (e.g. "Fighter")
  // the same way InfoTab.tsx's Class Features list does, instead of the one
  // shared favoriteCategoryColors.class swatch.
  function accentColorFor(fav: FavoriteRef): string | undefined {
    const category = resolveCategory(fav)
    if (category === "class" && classFeatureColorsByClass) {
      const key = matchOwnClassKey(resolveFeature(fav.refId)?.source, classes)
      // Once per-class is on, a matched class commits to its own color —
      // the same DEFAULT_ACCENT_COLOR Settings' own swatch shows before it's
      // been explicitly repicked, never quietly back to the whole
      // category's one shared flat color below.
      if (key) return classFeatureColors?.[key] ?? DEFAULT_ACCENT_COLOR
    }
    return favoriteCategoryColors?.[category]
  }
  function accentStyleFor(fav: FavoriteRef): CardStyle | undefined {
    return favoriteCategoryStyle?.[resolveCategory(fav)]
  }
  function sliderStyleFor(fav: FavoriteRef): CardStyle | undefined {
    return favoriteCategorySliderStyle?.[resolveCategory(fav)]
  }
  function sliderColorFor(fav: FavoriteRef): string | undefined {
    const category = resolveCategory(fav)
    if (category === "class" && classFeatureColorsByClass) {
      const key = matchOwnClassKey(resolveFeature(fav.refId)?.source, classes)
      if (key) return classFeatureSliderColors?.[key] ?? classFeatureColors?.[key] ?? DEFAULT_ACCENT_COLOR
    }
    return favoriteCategorySliderColors?.[category]
  }

  // Builds the exact card shown for one favorite — shared by the normal
  // list render below AND the DragOverlay clone, so the floating "picked up"
  // copy is pixel-identical to the row it came from, not a re-derived look.
  function renderFavoriteEntry(fav: FavoriteRef): React.ReactNode {
    const onToggleFavorite = readOnly ? undefined : () => onRemove(fav.refId)

    // Resolved once per favorite and passed straight into the entry
    // component's own accentColor/accentStyle props — the accent
    // renders on the item's own card, the same as everywhere else
    // it's shown, so there's no separate Favorites-only styling
    // layer to keep in sync.
    const accentColor = accentColorFor(fav)
    const accentStyle = accentStyleFor(fav)
    const sliderStyle = sliderStyleFor(fav)
    const sliderColor = sliderColorFor(fav)
    // Only Gear/Martial items get the weight/rarity/weapon-stat extras —
    // a favorited Feat or Racial Trait shouldn't suddenly show item-only
    // edit fields just because it shares this render branch.
    const isItemFavorite = resolveCategory(fav) === "item" || resolveCategory(fav) === "equipment"

    if (fav.refType === "spell") {
      const spell = resolveSpell(fav.refId)
      return spell
        ? <SpellEntry spell={spell} theme={theme} readOnly={readOnly} showPrepToggle={false} classes={classes}
            isFavorite onToggleFavorite={onToggleFavorite}
            accentColor={accentColor} accentStyle={accentStyle} bodyTextColor={bodyTextColor}
            onChange={p => onChangeSpell(fav.refId, p)}
            onRemove={() => onRemoveSpell(fav.refId)} />
        : <NotFoundRow label="Spell not found." onRemove={onToggleFavorite} />
    } else if (fav.refType === "familiar") {
      const fam = resolveFamiliar(fav.refId)
      const monster = fam ? monsters.find(m => m.id === fam.monsterId) : undefined
      return fam && monster
        ? <FamiliarFavoriteEntry fam={fam} monster={monster}
            poppedOut={poppedOutIds.has(fam.id)}
            onPopOut={() => onPopOutFamiliar(fam.id)}
            isFavorite onToggleFavorite={onToggleFavorite}
            accentColor={accentColor} accentStyle={accentStyle} bgHex={theme.boxHex} />
        : <NotFoundRow label="Familiar not found." onRemove={onToggleFavorite} />
    } else {
      const feat = resolveFeature(fav.refId)
      return feat
        ? <FeatureEntry
            feature={feat}
            allFeatures={features.filter(f => f.id !== feat.id && f.trackable)}
            theme={theme}
            readOnly={readOnly}
            pb={pb} statMods={statMods}
            isFavorite onToggleFavorite={onToggleFavorite}
            showItemExtras={isItemFavorite}
            showMagicStar={showMagicStar}
            magicItemStyle={magicItemStyle}
            magicItemColor={magicItemColor}
            magicItemSliderStyle={magicItemSliderStyle}
            magicItemColorsByRarity={magicItemColorsByRarity}
            magicItemRarityColors={magicItemRarityColors}
            magicItemRaritySliderColors={magicItemRaritySliderColors}
            accentColor={accentColor} accentStyle={accentStyle} sliderStyle={sliderStyle}
            tagTextColor={tagTextColor} bodyTextColor={bodyTextColor} sliderColor={sliderColor}
            onChange={patch => onUpdateFeature(fav.refId, patch)}
            onRemove={() => onRemoveFeature(fav.refId)}
            onLinkToggle={otherId => onLinkToggle(fav.refId, otherId)}
          />
        : <NotFoundRow label="Feature not found." onRemove={onToggleFavorite} />
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={`${card} flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden`}>
      <div className="flex flex-col gap-2 flex-1 min-h-0"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}>

        {/* Header */}
        <div className="flex items-center gap-2 shrink-0 px-3 pt-3">
          <span className="text-xs uppercase tracking-widest text-white/50 font-semibold flex-1">Favorites</span>
        </div>

        {/* Card list */}
        <div className={`flex flex-col gap-1.5 px-3 pb-3 overflow-auto flex-1 min-h-0 rounded-xl transition-colors ${dragOver ? "ring-1 ring-primary/40 bg-primary/5" : ""}`}>

          {favorites.length === 0 && (
            <div className={`flex-1 flex flex-col items-center justify-center text-center py-8 rounded-xl border-2 border-dashed transition-colors ${dragOver ? "border-primary/50" : "border-white/10"}`}>
              <span className="text-white/20 text-2xl mb-2">★</span>
              <p className="text-sm text-white/30">Drag spells, items, features or familiars here</p>
              <p className="text-xs text-white/20 mt-0.5">or use ★ in quick search</p>
            </div>
          )}

          <DndContext sensors={dragSensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveId(null)}>
          <SortableContext items={favorites.map(f => f.refId)} strategy={verticalListSortingStrategy}>
          {favorites.map(fav => (
            <SortableItem key={fav.refId} id={fav.refId} disabled={readOnly}>
              {renderFavoriteEntry(fav)}
            </SortableItem>
          ))}
          </SortableContext>
          <DragOverlay>
            {(() => {
              const activeFav = activeId ? favorites.find(f => f.refId === activeId) : undefined
              return activeFav ? <DragOverlayCard>{renderFavoriteEntry(activeFav)}</DragOverlayCard> : null
            })()}
          </DragOverlay>
          </DndContext>
        </div>
      </div>
    </div>
  )
}

function NotFoundRow({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5">
      <p className="text-sm text-white/30 italic flex-1">{label}</p>
      {onRemove && (
        <button type="button" onClick={onRemove}
          className="text-xs text-white/30 hover:text-white/60 transition-colors shrink-0">
          Remove
        </button>
      )}
    </div>
  )
}
