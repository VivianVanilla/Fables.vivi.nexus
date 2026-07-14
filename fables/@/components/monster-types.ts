// Data shapes used by the monster stat-block sheet

import type { DamageEntry, SpellItem, SpellSlot } from "./character-types"

export type ActionCategory = "trait" | "action" | "bonusAction" | "reaction" | "legendary" | "lair"

export interface MonsterAction {
  id: string
  name: string
  description?: string
  attackBonus?: string   // e.g. "+5"
  damage?: string         // e.g. "2d6+3"
  damageType?: string
  multiDamage?: boolean   // toggle — on splits damage across `damages` instead of the single damage/damageType pair
  damages?: DamageEntry[] // additional damage instances beyond the primary damage/damageType, only used when multiDamage is on
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
  speeds?: { walk?: number; fly?: number; swim?: number; climb?: number; burrow?: number; hover?: number }  // ft/round — hover isn't its own speed rating in 5e (it's a flag on fly speed), but tracking it as a number here keeps it consistent with the others and lets it double as "hovers at N ft."

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

  traits?: MonsterAction[]        // passive features shown right before Actions — same shape as actions, but only name/description are ever shown for them
  hasTraits?: boolean              // toggle — off hides the whole Traits section (Actions is always shown)
  hasMultiattack?: boolean         // toggle — shows the Multiattack entry at the top of Actions
  multiattackDescription?: string // free-text sentence describing the multiattack (e.g. "The monster makes two attacks: one with its bite and one with its claws.")

  // Session-use tracker shown as checkboxes in the Traits section header —
  // separate from any "Legendary Resistance (3/Day)" trait text (which is
  // just flavor/rules prose); this is the live "how many are left tonight" count.
  hasLegendaryResistance?: boolean  // toggle — off hides the checkbox tracker
  legendaryResistanceMax?: number   // uses per day, default 3
  legendaryResistanceUsed?: number

  actions?: MonsterAction[]
  bonusActions?: MonsterAction[]
  reactions?: MonsterAction[]
  legendaryActions?: MonsterAction[]
  lairActions?: MonsterAction[]   // no per-action cost/budget, unlike legendary — 5e triggers one of these per round on initiative count 20
  hasBonusActions?: boolean      // toggle — off hides the whole section (Actions is always shown)
  hasReactions?: boolean         // toggle — off hides the whole section
  hasLegendaryActions?: boolean  // toggle — off hides the whole legendary actions section
  legendaryActionsMax?: number
  legendaryActionsUsed?: number
  hasLairActions?: boolean       // toggle — off hides the whole lair actions section

  hasSpellcasting?: boolean      // toggle — off hides the whole spellcasting section
  spellcastingLevel?: string    // "9th-level spellcaster"
  spellAttackBonus?: number
  spellSaveDC?: number
  spellcastingAbility?: string
  spellUsageMode?: "slots" | "perDay"  // most monsters use "X/day" innate casting rather than leveled slots — "slots" (default) keeps the classic spellSlots-by-level display; "perDay" hides slot sliders and tracks each spell's own uses-per-day instead (see SpellItem.usesPerDay)

  spellItems?: SpellItem[]
  spellSlots?: SpellSlot[]
}
