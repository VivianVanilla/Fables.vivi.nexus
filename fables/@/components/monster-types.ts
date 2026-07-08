// Data shapes used by the monster stat-block sheet

import type { SpellItem, SpellSlot } from "./character-types"

export type ActionCategory = "action" | "bonusAction" | "reaction" | "legendary"

export interface MonsterAction {
  id: string
  name: string
  description?: string
  attackBonus?: string   // e.g. "+5"
  damage?: string         // e.g. "2d6+3"
  damageType?: string
  saveDC?: number
  saveAbility?: string    // "Dex", "Con", etc.
  recharge?: number       // e.g. 5 -> "Recharge 5-6"; undefined = no recharge
  rechargeUsed?: boolean  // true once spent, until recharge roll succeeds
  legendaryCost?: number  // legendary actions only — uses consumed per activation (default 1)
}

export interface MonsterData {
  portrait?: string
  portraitFilter?: { brightness: number; contrast: number; saturate: number }
  description?: string
  creatureType?: string   // e.g. "Medium beast, unaligned"
  alignment?: string

  ac?: number
  hp?: number
  maxHp?: number
  hitDice?: string        // e.g. "9d8+18"
  speed?: string          // legacy free-text notes (e.g. "burrow 20 ft.") — kept for movement types
                           // not covered by `speeds`, and as a fallback display for older monsters
  speeds?: { walk?: number; fly?: number; swim?: number; climb?: number }  // ft/round

  strength?: number
  dexterity?: number
  constitution?: number
  intelligence?: number
  wisdom?: number
  charisma?: number

  savingThrows?: string
  skills?: string
  damageResistances?: string
  damageImmunities?: string
  damageVulnerabilities?: string
  conditionImmunities?: string
  senses?: string
  languages?: string
  challengeRating?: string
  proficiencyBonus?: number

  actions?: MonsterAction[]
  bonusActions?: MonsterAction[]
  reactions?: MonsterAction[]
  legendaryActions?: MonsterAction[]
  hasBonusActions?: boolean      // toggle — off hides the whole section (Actions is always shown)
  hasReactions?: boolean         // toggle — off hides the whole section
  hasLegendaryActions?: boolean  // toggle — off hides the whole legendary actions section
  legendaryActionsMax?: number
  legendaryActionsUsed?: number

  hasSpellcasting?: boolean      // toggle — off hides the whole spellcasting section
  spellcastingLevel?: string    // "9th-level spellcaster"
  spellAttackBonus?: number
  spellSaveDC?: number
  spellcastingAbility?: string

  spellItems?: SpellItem[]
  spellSlots?: SpellSlot[]
}
