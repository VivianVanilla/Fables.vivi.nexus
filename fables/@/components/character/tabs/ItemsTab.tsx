// ════════════════════════════════════════════════════════════════════════════
// ItemsTab.tsx — "Armor & Items": equipped armor + carried items (weapons,
// gear, containers). Its own top-level Tab in CharacterSheet.tsx rather than
// a Details subtab, since it's what players open most during play — see the
// swap note in InfoTab.tsx's SUB_TABS (Familiars moved into Details to make
// room). Reuses InfoTab's FeatureList/ContainerItemsList rather than
// duplicating them, since those two are also shared by Details' other lists.
// ════════════════════════════════════════════════════════════════════════════

import { useState } from "react"
import type { CharacterData, Feature, FavoriteRef } from "@/components/shared/types"
import type { Theme } from "@/components/shared/themes"
import type { PackItem } from "@/components/documentation/doc-types"
import { nanoid, reorderSubset } from "@/components/shared/utils"
import { itemPatchFromSuggestion, type Suggestion } from "../entries/FeatureEntry"
import { FeatureList, ContainerItemsList, FeatureSuggestionPickerModal } from "./InfoTab"

interface ItemsTabProps {
  data: CharacterData
  update: (patch: Partial<CharacterData>) => void
  onChangeFeature: (id: string, patch: Partial<Feature>) => void
  onRemoveFeature: (id: string) => void
  onLinkToggle: (featureId: string, otherId: string) => void
  theme: Theme
  card: string
  readOnly: boolean
  pb: number
  statMods: Record<string, number>
  userId?: string | null
  favorites: FavoriteRef[]
  onToggleFavorite: (id: string, label: string) => void
}

export function ItemsTab({
  data, update, onChangeFeature, onRemoveFeature, onLinkToggle, theme, card, readOnly, pb, statMods, userId,
  favorites, onToggleFavorite,
}: ItemsTabProps) {
  // Opens a newly-added Carried Item straight into its edit form instead of
  // dropping an unnamed collapsed row into the list — same pattern as the
  // spell list's pendingSpellId (see CharacterSheet.tsx).
  const [pendingItemId, setPendingItemId] = useState<string | null>(null)
  const [showItemPicker, setShowItemPicker] = useState(false)

  // Other feature lists (Race & Feats, Features) can link to an item as a
  // "linked feature" — same cross-list set InfoTab.tsx builds for its own lists.
  const allFeatures: Feature[] = [
    ...(data.racialTraits  ?? []),
    ...(data.feats         ?? []),
    ...(data.classFeatures ?? []),
    ...(data.items         ?? []),
    ...(data.invocations   ?? []),
    ...(data.infusions     ?? []),
  ]

  // Single shared add point for both lists below — lands in Carried as a
  // plain unequipped item; toggling "Armor & Equipment" + Equip from there
  // is one click, so a second, separate "add straight into Equipped" button
  // was just a redundant path to the same place.
  function addItem(parentId?: string) {
    const id = nanoid()
    update({ items: [...(data.items ?? []), { id, name: "", category: "item", parentId }] })
    setPendingItemId(id)
  }

  // A "pack" is just a documentation item entry (item_type "pack") that
  // carries a pack_items list instead of weapon/armor stats — see
  // DocEntryForm.tsx. Picking one from the name-suggestion dropdown (same
  // dropdown any other item uses) replaces the in-progress blank item with
  // every item the pack contains, each its own singular-named Feature
  // ("Torch" ×10, not one "10 Torches" row) landing unequipped in Carried
  // Items — one update() call so there's no intermediate state to race.
  function addPackToInventory(blankId: string, packItems: PackItem[]) {
    const newFeatures: Feature[] = packItems.map(pi => ({
      id: nanoid(),
      name: pi.name,
      category: "item",
      amount: pi.amount,
      trackAmount: pi.amount > 1,
      weight: pi.weight || undefined,
      value: pi.value || undefined,
    }))
    update({ items: [...(data.items ?? []).filter(f => f.id !== blankId), ...newFeatures] })
  }

  // Mirrors FeatureEntry.tsx's inline suggestion handler: packs explode into
  // their contained items via the existing addPackToInventory, everything
  // else becomes a fresh item with weapon/armor/rarity/etc. fields mapped in
  // via itemPatchFromSuggestion instead of landing as a bare name.
  function addItemFromSuggestion(s: Suggestion) {
    if (s.meta?.item_type === "pack" && s.meta.pack_items) {
      addPackToInventory(nanoid(), s.meta.pack_items)
      return
    }
    const blank: Feature = { id: nanoid(), name: s.name, category: "item" }
    const patch = itemPatchFromSuggestion("item", s, blank)
    update({ items: [...(data.items ?? []), { ...blank, description: s.description, ...patch }] })
  }

  // A weapon that's also shown in Martial (inMartial/martialOnly) keeps its
  // Martial ("equipment") category styling here in Gear too, instead of
  // falling back to plain/magic-item styling — same item, same look,
  // wherever it's shown (see SpellsEquipPanel.tsx, which every item here
  // that's inMartial also renders through).
  const isMartialWeapon = (f: Feature) => !!(f.inMartial || f.martialOnly)
  const martialAccentColor = (f: Feature) => isMartialWeapon(f) ? data.favoriteCategoryColors?.equipment : undefined
  const martialAccentStyle = (f: Feature) => isMartialWeapon(f) ? data.favoriteCategoryStyle?.equipment : undefined

  // Settings' "Modules and Font Size" — sheet-wide text color switch
  // (tagTextColor is deliberately not wired here — Gear items never used
  // the old per-category tag color either).
  const bodyTextColor = data.textColorOverride === "dark" ? "black" as const : undefined

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      {!readOnly && (
        <button type="button" onClick={() => setShowItemPicker(true)}
          className="text-sm px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors self-start shrink-0">
          + Add Item
        </button>
      )}
      {showItemPicker && (
        <FeatureSuggestionPickerModal
          label="Item" suggestionSource="item" userId={userId}
          existingNames={(data.items ?? []).map(f => f.name)}
          onPick={addItemFromSuggestion}
          onClose={() => setShowItemPicker(false)}
        />
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 min-h-0">
        <FeatureList
          items={(data.items ?? []).filter(i => i.category === "armor" && i.equipped && !i.martialOnly)} allFeatures={allFeatures} label="Equipped"
          onAdd={() => addItem()} showAddButton={false}
          onChange={onChangeFeature}
          onRemove={onRemoveFeature}
          onLinkToggle={onLinkToggle}
          theme={theme} card={card} readOnly={readOnly} pb={pb} statMods={statMods}
          suggestionSource="item" userId={userId}
          favorites={favorites} onToggleFavorite={onToggleFavorite}
          onAddPack={addPackToInventory}
          showAttunement
          showItemExtras
          showMagicStar={data.showMagicItemStar} magicItemStyle={data.magicItemStyle} magicItemColor={data.magicItemColor} magicItemSliderStyle={data.magicItemSliderStyle} magicItemColorsByRarity={data.magicItemColorsByRarity} magicItemRarityColors={data.magicItemRarityColors} magicItemRaritySliderColors={data.magicItemRaritySliderColors}
          perItemAccentColor={martialAccentColor} perItemAccentStyle={martialAccentStyle}
          bodyTextColor={bodyTextColor}
          onReorder={newOrder => update({ items: reorderSubset(data.items ?? [], i => i.category === "armor" && !!i.equipped && !i.martialOnly, newOrder) })}
        />
        {/* Everything not equipped lands here — armor/weapons you own but
            aren't wearing, and every generic item (which has no Equip
            checkbox at all, so it can never leave this list on its own).
            martialOnly entries (made directly from the Martial tab, e.g.
            fists) are excluded — they live only there, see SpellsEquipPanel.tsx. */}
        <ContainerItemsList
          items={(data.items ?? []).filter(i => !(i.category === "armor" && i.equipped) && !i.martialOnly)} allFeatures={allFeatures}
          onAdd={addItem} showAddButton={false}
          onChange={onChangeFeature}
          onRemove={onRemoveFeature}
          onLinkToggle={onLinkToggle}
          theme={theme} card={card} readOnly={readOnly} pb={pb} statMods={statMods}
          userId={userId}
          favorites={favorites} onToggleFavorite={onToggleFavorite}
          onAddPack={addPackToInventory}
          showMagicStar={data.showMagicItemStar} magicItemStyle={data.magicItemStyle} magicItemColor={data.magicItemColor} magicItemSliderStyle={data.magicItemSliderStyle} magicItemColorsByRarity={data.magicItemColorsByRarity} magicItemRarityColors={data.magicItemRarityColors} magicItemRaritySliderColors={data.magicItemRaritySliderColors}
          perItemAccentColor={martialAccentColor} perItemAccentStyle={martialAccentStyle}
          bodyTextColor={bodyTextColor}
          pendingItemId={pendingItemId} onAutoEditConsumed={() => setPendingItemId(null)}
          onReorder={newOrder => update({ items: reorderSubset(data.items ?? [], i => !(i.category === "armor" && !!i.equipped) && !i.martialOnly, newOrder) })}
        />
      </div>
    </div>
  )
}
