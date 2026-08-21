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
import { nanoid } from "@/components/shared/utils"
import { FeatureList, ContainerItemsList } from "./InfoTab"

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
  userId?: string | null
  favorites: FavoriteRef[]
  onToggleFavorite: (id: string, label: string) => void
  onAddItemToEquipment: (feature: Feature) => void
  equipmentLinkedIds: Set<string>
}

export function ItemsTab({
  data, update, onChangeFeature, onRemoveFeature, onLinkToggle, theme, card, readOnly, pb, userId,
  favorites, onToggleFavorite, onAddItemToEquipment, equipmentLinkedIds,
}: ItemsTabProps) {
  // Opens a newly-added Carried Item straight into its edit form instead of
  // dropping an unnamed collapsed row into the list — same pattern as the
  // spell list's pendingSpellId (see CharacterSheet.tsx).
  const [pendingItemId, setPendingItemId] = useState<string | null>(null)

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

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      {!readOnly && (
        <button type="button" onClick={() => addItem()}
          className="text-sm px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors self-start shrink-0">
          + Add Item
        </button>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 min-h-0">
        <FeatureList
          items={(data.items ?? []).filter(i => i.category === "armor" && i.equipped)} allFeatures={allFeatures} label="Equipped"
          onAdd={() => addItem()} showAddButton={false}
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
          onAdd={addItem} showAddButton={false}
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
    </div>
  )
}
