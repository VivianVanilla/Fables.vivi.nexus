// All data shapes used by the character sheet

export interface EquipmentItem {
  id: string
  name: string
  toHit?: string
  damage?: string
  damageType?: string
  type?: string        // "melee" | "ranged" | "armor" | "misc"
  notes?: string
  magicBonus?: string  // e.g. "+1", "+2"
  properties?: string  // e.g. "Versatile, Finesse"
  proficient?: boolean
}

export interface SpellItem {
  id: string
  name: string
  level?: number
  school?: string               // "Evocation", "Conjuration", etc.
  toHit?: string                // attack bonus string
  saveAttr?: string             // "Dex", "Con", etc.
  saveType?: string             // legacy field (kept for compat)
  range?: string
  castTime?: string             // "1 action", "Bonus Action", etc.
  duration?: string             // "Instantaneous", "1 minute", etc.
  components?: string           // "V, S, M"
  materialComponents?: string
  damage?: string               // "8d6"
  damageType?: string           // "Thunder", "Fire", etc.
  notes?: string                // description
  prepared?: boolean
  alwaysPrepared?: boolean
  ritual?: boolean
}

export interface HitDicePool {
  id: string
  dieType: string  // "d6" | "d8" | "d10" | "d12"
  total: number
  used: number
}

export interface SpellSlot {
  id: string             // unique per row — allows multiple rows at the same level
  level: number          // 1-9
  total: number
  used: number
  resetsOn: "short" | "long"
  pact?: boolean         // Pact Magic marker — visual label for multiclass identification
}

export interface Feature {
  id: string
  name: string
  source?: string            // "Fighter 1", "Variant Human", etc.
  description?: string
  trackable?: boolean
  maxUses?: number
  usesUsed?: number
  resetsOn?: "short" | "long" | "dawn"
  sliderColor?: string
}

export interface FavoriteRef {
  refId: string
  refType: "spell" | "equipment" | "feature"
  label: string   // snapshot of the item name at time of favoriting
}

export interface ActiveCondition {
  id: string
  name: string
  level?: number   // for Exhaustion (1–6)
}

export interface CharacterData {
  portrait?: string
  race?: string
  class?: string
  level?: number
  background?: string
  alignment?: string
  ac?: number
  hp?: number
  maxHp?: number
  maxHpMod?: number    // flat bonus or penalty to max HP (positive = bonus, negative = reduction)
  tempHp?: number
  speed?: number
  initiative?: number
  strength?: number
  dexterity?: number
  constitution?: number
  intelligence?: number
  wisdom?: number
  charisma?: number
  savingThrowProfs?: Partial<Record<"str" | "dex" | "con" | "int" | "wis" | "cha", boolean>>
  spellSaveDC?: number
  spellAttackBonus?: number
  spellcastingAbility?: string
  cantripsKnown?: number
  spellsKnown?: number
  notes?: string
  backgroundImage?: string
  theme?: string
  slotTheme?: string
  equipmentItems?: EquipmentItem[]
  spellItems?: SpellItem[]
  hitDicePools?: HitDicePool[]
  spellSlots?: SpellSlot[]
  racialTraits?: Feature[]
  feats?: Feature[]
  classFeatures?: Feature[]
  favorites?: FavoriteRef[]
  conditions?: ActiveCondition[]
  skillProfs?: Record<string, "half" | "prof" | "exp">
  skillBonuses?: Record<string, number>
  saveBonuses?: Partial<Record<"str" | "dex" | "con" | "int" | "wis" | "cha", number>>
  spellsPrepared?: number
  // Party / multiclass
  partyCode?: string
  multiclass?: boolean
  classes?: Array<{ cls: string; level: number }>
}
