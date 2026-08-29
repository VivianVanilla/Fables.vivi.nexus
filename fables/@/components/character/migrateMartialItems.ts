// One-time migration: a weapon used to exist as two synced records (a
// Feature in Gear + a separate EquipmentItem in the Martial tab, linked via
// sourceFeatureId). Martial weapons are now plain Features (see
// Feature.inMartial/martialOnly), rendered once via FeatureEntry in both
// places. Called once per character load (see CharacterSheet.tsx) — a no-op
// once data.equipmentItems is empty, so it's safe to call unconditionally
// on every mount.

import type { CharacterData, Feature, FavoriteRef } from "@/components/shared/types"
import { nanoid } from "@/components/shared/utils"

export function migrateEquipmentItems(data: CharacterData): Partial<CharacterData> | null {
  const legacy = data.equipmentItems
  if (!legacy || legacy.length === 0) return null

  const items = [...(data.items ?? [])]
  // Legacy EquipmentItem.id -> the Feature id it now maps to (existing
  // sourceFeatureId for a linked weapon, or a freshly minted id for a
  // standalone one) — used below to remap favorites pointing at the old id.
  const idMap = new Map<string, string>()

  for (const equip of legacy) {
    if (equip.sourceFeatureId) {
      const idx = items.findIndex(f => f.id === equip.sourceFeatureId)
      if (idx === -1) continue // linked Feature no longer exists — nothing to flag, favorite (if any) gets dropped below
      items[idx] = { ...items[idx], inMartial: true }
      idMap.set(equip.id, equip.sourceFeatureId)
      continue
    }

    // Standalone (Martial-first) entry — becomes its own Feature, flagged
    // out of Gear's own lists. equip.type only ever came from a 3-option
    // dropdown (melee/ranged/misc) in the old EquipmentEntry.tsx form.
    const kind: NonNullable<Feature["equipKind"]> = equip.type === "ranged" ? "weapon" : equip.type === "misc" ? "misc" : "weapon"
    const newId = nanoid()
    items.push({
      id: newId,
      name: equip.name,
      description: equip.notes || undefined,
      category: "item",
      equipKind: kind,
      inMartial: true,
      martialOnly: true,
      weight: equip.weight,
      isMagicItem: equip.isMagicItem,
      trackable: equip.trackable,
      trackerLabel: equip.trackerLabel,
      maxUses: equip.maxUses,
      maxUsesFormula: equip.maxUsesFormula,
      usesUsed: equip.usesUsed,
      resetsOn: equip.resetsOn,
      multiTracking: equip.multiTracking,
      trackers: equip.trackers,
      itemMeta: kind === "weapon" ? {
        weaponKind: equip.type === "ranged" ? "ranged" : "melee",
        damage: equip.damage,
        damageType: equip.damageType,
        multiDamage: equip.multiDamage,
        damages: equip.damages,
        properties: equip.properties,
        meleeRange: equip.meleeRange,
        throwRange: equip.throwRange,
        range: equip.range,
        attackStat: equip.attackStat,
        magicBonus: equip.magicBonus,
        toHit: equip.toHit,
        extraToHit: equip.extraToHit,
        extraDamage: equip.extraDamage,
        proficient: equip.proficient,
      } : undefined,
    })
    idMap.set(equip.id, newId)
  }

  // Remap favorites: an "equipment" favorite becomes a "feature" favorite at
  // the mapped id — deduped against any favorite already there for that same
  // feature (a linked weapon could have ended up favorited from both sides
  // by the double-favorite bug fixed earlier this session). One pointing at
  // nothing (already orphaned) is dropped.
  const favorites = data.favorites ?? []
  const seenFeatureIds = new Set(favorites.filter(f => f.refType === "feature").map(f => f.refId))
  const nextFavorites: FavoriteRef[] = []
  for (const fav of favorites) {
    if (fav.refType !== "equipment") { nextFavorites.push(fav); continue }
    const mappedId = idMap.get(fav.refId)
    if (!mappedId || seenFeatureIds.has(mappedId)) continue
    seenFeatureIds.add(mappedId)
    nextFavorites.push({ refId: mappedId, refType: "feature", label: fav.label })
  }

  return { items, favorites: nextFavorites, equipmentItems: [] }
}
