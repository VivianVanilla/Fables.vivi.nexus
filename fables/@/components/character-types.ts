// All data shapes used by the character sheet

export interface EquipmentItem {
  id: string
  name: string
  toHit?: string       // manual override when attackStat is not set
  damage?: string
  damageType?: string
  type?: string        // "melee" | "ranged" | "armor" | "misc"
  notes?: string
  magicBonus?: string  // e.g. "+1", "+2"
  properties?: string  // e.g. "Versatile, Finesse"
  proficient?: boolean
  attackStat?: "str" | "dex" | "con" | "int" | "wis" | "cha"
  extraToHit?: number  // flat bonus added to computed to-hit
  extraDamage?: number // flat bonus added to computed damage
  meleeRange?: string  // reach, e.g. "5 ft." — melee weapons
  throwRange?: string  // e.g. "20/60 ft." — thrown melee weapons
  range?: string       // e.g. "80/320 ft." — ranged weapons
  weight?: number      // lb — rolled into the character's total carried weight
  sourceFeatureId?: string  // set when toggled in from an Armor & Equipment item — its weight is
                             // already counted via that Feature, so it's excluded here to avoid double-counting
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
  requiresMaterial?: boolean    // toggle — track whether this spell needs a costed/consumable material
  materialOwned?: boolean       // only meaningful when requiresMaterial is set
  damage?: string               // "8d6"
  damageType?: string           // "Thunder", "Fire", etc.
  notes?: string                // description
  prepared?: boolean
  alwaysPrepared?: boolean
  freeSpell?: boolean            // granted free (subclass/domain spell) — doesn't count toward Known/Prepared caps
  ritual?: boolean
  concentration?: boolean
  sourceClass?: string           // which class this spell is known/prepared from (multiclass)
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
  source?: string            // "Fighter", "Variant Human", etc.
  level?: number             // character level this was gained at
  description?: string
  trackable?: boolean
  maxUses?: number
  maxUsesFormula?: "pb"      // when set, max uses = proficiency bonus
  usesUsed?: number
  resetsOn?: "short" | "long" | "dawn" | "manual"
  sliderColor?: string
  linkedTo?: string[]        // IDs of features that share this use counter (bidirectional)
  attuned?: boolean          // Items tab only — is the character currently attuned to this item?
  equipped?: boolean         // Items tab only — currently worn/wielded (applies itemMeta.acBonus to AC)
  weight?: number            // lb — rolled into the character's total carried weight
  value?: number             // gp — per-unit value, rolled into the character's total carried value
  amount?: number            // Items tab, generic items only — quantity (armor/equipment is always qty 1)
  category?: "armor" | "item" // Items tab only — which section it's listed under
  equipKind?: "armor" | "weapon" | "misc" // Armor & Equipment section only — which stat fields apply
  isContainer?: boolean      // Items tab only — acts like a folder; other items can be placed inside it
  maxWeight?: number         // Items tab only — containers: weight capacity for items placed inside
  parentId?: string          // Items tab only — id of the containing item, when nested inside a container
  rarity?: "Common" | "Uncommon" | "Rare" | "Very Rare" | "Legendary" | "Artifact"  // Items tab only
  itemMeta?: {                // set when created from an Items-tab documentation suggestion, or edited directly
    itemType?: string
    damage?: string
    damageType?: string
    properties?: string
    acBonus?: number          // AC bonus granted while equipped (armor/shield)
    weaponKind?: "melee" | "ranged"  // only meaningful when equipKind === "weapon"
    meleeRange?: string       // e.g. "5 ft."
    throwRange?: string       // e.g. "20/60 ft." — thrown melee weapons
    range?: string            // e.g. "80/320 ft." — ranged weapons
  }
}

export interface FavoriteRef {
  refId: string
  refType: "spell" | "equipment" | "feature" | "familiar"
  label: string   // snapshot of the item name at time of favoriting
}

export interface ActiveCondition {
  id: string
  name: string
  level?: number   // for Exhaustion (1–6)
}

export interface ProficiencyEntry {
  id: string
  name: string
}

export interface LinkedNoteRef {
  id: string             // object id — a note or a folder
  type: "note" | "folder"
}

export interface FamiliarRef {
  id: string          // stable instance id, independent of the source monster
  monsterId: string   // id of the linked Monster object — live reference
  nickname?: string
  currentHp?: number
  notes?: string
  // Favorited status lives in the shared `favorites` list (refType "familiar"),
  // not here — keeps familiars consistent with how spells/items/features favorite.
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
  hideEquipAcBadge?: boolean // hides the "+X equip" AC-bonus badge under the HP/AC ring
  tempHp?: number
  speed?: number   // walk speed, ft/round
  speeds?: { fly?: number; swim?: number; climb?: number }  // extra movement types, ft/round
  initiative?: number
  strength?: number
  dexterity?: number
  constitution?: number
  intelligence?: number
  wisdom?: number
  charisma?: number
  savingThrowProfs?: Partial<Record<"str" | "dex" | "con" | "int" | "wis" | "cha", boolean>>
  spellSaveDC?: number         // legacy manual value, superseded by computed 8 + PB + mod + spellSaveDCBonus
  spellAttackBonus?: number    // legacy manual value, superseded by computed PB + mod + spellAttackBonusBonus
  spellSaveDCBonus?: number       // extra flat bonus (magic items, feats, etc.) added on top of the computed save DC
  spellAttackBonusBonus?: number  // extra flat bonus added on top of the computed spell attack bonus
  spellcastingAbility?: string
  cantripsKnown?: number
  spellsKnown?: number
  invocationsKnown?: number   // Eldritch Invocations known (Warlock)
  spellSlotDisplay?: "integrated" | "classic"   // integrated = slot sliders next to level headers; classic = standalone block at the top
  spellsDisplay?: "list" | "bubbles"            // list = one spell per row; bubbles = spells size to their content and wrap to pack multiple per line
  hideDiceRoller?: boolean       // true = hide the dice roller panel on the Combat tab
  hideJumpCalculator?: boolean   // true = hide the jump distance calculator on the Combat tab
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
  items?: Feature[]
  invocations?: Feature[]  // Eldritch Invocations (Warlock)
  favorites?: FavoriteRef[]
  conditions?: ActiveCondition[]
  familiars?: FamiliarRef[]
  skillProfs?: Record<string, "half" | "prof" | "exp">
  skillBonuses?: Record<string, number>
  saveBonuses?: Partial<Record<"str" | "dex" | "con" | "int" | "wis" | "cha", number>>
  spellsPrepared?: number
  initiativeStat?: string  // ability key e.g. "dex"; default "dex"
  initiativeBonus?: number // flat bonus added to the mod
  themeMode?: "dark" | "light"
  themeBg?: string         // background override key from BG_OPTIONS
  plainSkills?: boolean    // when true, disable ability-color-coding on skills
  // Proficiencies — entry lists per category (legacy characters may still have
  // these as a single free-text string; components normalize on read).
  weaponProfs?: ProficiencyEntry[] | string
  armorProfs?: ProficiencyEntry[] | string
  toolProfs?: ProficiencyEntry[] | string
  languageProfs?: ProficiencyEntry[] | string
  // Notes linked into the character's Notes tab — either a specific note, or a
  // whole folder (all notes found under it are shown).
  linkedNoteRefs?: LinkedNoteRef[]
  // Death saving throws
  deathSaves?: { successes: number; failures: number; dead?: boolean }
  // Party / multiclass
  partyCode?: string
  multiclass?: boolean
  classes?: Array<{ cls: string; level: number }>
  subrace?: string
  // Wallet
  currency?: { cp?: number; sp?: number; ep?: number; gp?: number; pp?: number }
  currencyMode?: "classic" | "simple" | "custom"
  currencyNames?: string[]  // 5 custom names: [cp, sp, ep, gp, pp]
}
