// All data shapes used by the character sheet

export interface EquipmentItem {
  id: string
  name: string
  toHit?: string
  damage?: string
  damageType?: string
  type?: string   // "melee" | "ranged" | "armor" | "misc"
  notes?: string
}

export interface SpellItem {
  id: string
  name: string
  level?: number
  toHit?: string
  saveType?: string
  range?: string
  notes?: string
}

export interface HitDicePool {
  id: string
  dieType: string   // "d6" | "d8" | "d10" | "d12"
  total: number
  used: number
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
  equipment?: string
  spells?: string
  spellSaveDC?: number
  spellAttackBonus?: number
  notes?: string
  backgroundImage?: string
  theme?: string
  equipmentItems?: EquipmentItem[]
  spellItems?: SpellItem[]
  hitDicePools?: HitDicePool[]
}
