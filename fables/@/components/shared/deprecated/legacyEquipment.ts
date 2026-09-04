// DEPRECATED — pre-merge Martial tab shape. A weapon used to exist as two
// synced records (a Feature in Gear, a separate EquipmentItem in the Martial
// tab, linked via sourceFeatureId). Martial weapons are now plain Features
// (see Feature.inMartial/martialOnly in ../types.ts) rendered once via
// FeatureEntry in both places — this type only still exists so
// migrateEquipmentItems() (migrateMartialItems.ts) has something typed to
// read from on a character's first load after the merge, before clearing
// CharacterData.equipmentItems to []. Nothing renders from this shape
// anymore — do not import this anywhere new.

import type { DamageEntry, UseTracker } from "../types"

export interface EquipmentItem {
  id: string
  name: string
  toHit?: string
  damage?: string
  damageType?: string
  multiDamage?: boolean
  damages?: DamageEntry[]
  type?: string
  notes?: string
  cost?: string
  magicBonus?: string
  properties?: string
  proficient?: boolean
  attackStat?: "str" | "dex" | "con" | "int" | "wis" | "cha"
  extraToHit?: number
  extraDamage?: number
  meleeRange?: string
  throwRange?: string
  range?: string
  weight?: number
  sourceFeatureId?: string
  isMagicItem?: boolean
  trackable?: boolean
  trackerLabel?: string
  maxUses?: number
  maxUsesFormula?: "pb"
  usesUsed?: number
  resetsOn?: "short" | "long" | "dawn" | "manual"
  multiTracking?: boolean
  trackers?: UseTracker[]
}
