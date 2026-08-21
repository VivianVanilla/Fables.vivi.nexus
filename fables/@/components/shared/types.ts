// All data shapes used by the character sheet

import type { FavoriteCategory, CardStyle } from "./constants"

// One damage instance ("2d6" fire, "1d4" cold, etc.) — the base damage/damageType
// fields on weapons/actions/items stay as the single/primary instance for backward
// compatibility; `damages` holds any additional ones once `multiDamage` is toggled on
// (e.g. a flaming sword: primary damage/damageType is "1d8 Slashing", damages[0] is
// "1d6 Fire"). See character/ui/DamageFields.tsx for the shared editor/display.
export interface DamageEntry {
  id: string
  damage: string
  damageType?: string
}

export interface EquipmentItem {
  id: string
  name: string
  toHit?: string       // manual override when attackStat is not set
  damage?: string
  damageType?: string
  multiDamage?: boolean   // toggle — on splits damage across `damages` instead of the single damage/damageType pair
  damages?: DamageEntry[] // additional damage instances beyond the primary damage/damageType, only used when multiDamage is on
  type?: string        // "melee" | "ranged" | "armor" | "misc"
  notes?: string
  cost?: string        // e.g. "15 gp" — autofilled from Documentation's item data, same as damage/weight
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
  isMagicItem?: boolean  // mirrors Feature.isMagicItem — mirrored both ways by equipmentFieldsFromFeature/
                          // featureFieldsFromEquipment (character.tsx) so the Martial tab shows the same
                          // ✨ badge / card treatment as the Items tab for the same physical item
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
  usesPerDay?: number            // monster innate spellcasting (spellUsageMode "perDay") — e.g. 3 for "3/day"; undefined/0 = at will
  usesPerDayUsed?: number        // uses spent today — only meaningful when usesPerDay is set
  // Cast — configured entirely from Automation (not on the spell row itself,
  // which isn't mobile-friendly for one more small button). castSlotId/
  // castFormId/castConditionalId/castGrantConditions are independent and can
  // combine (e.g. cast Haste: expend a slot AND activate the Hasted form),
  // applied together via utils.ts's castSpellPatch.
  castEnabled?: boolean
  castSlotId?: string            // id of the specific SpellSlot row to expend one use of when cast — a specific
                                  // row rather than "any slot at this spell's level" so Pact Magic (and any
                                  // multiclass caster with more than one pool at the same level) burns the
                                  // right pool instead of a same-level regular slot
  castFormId?: string            // activates this Form (see CharacterForm) when cast
  castConditionalId?: string     // triggers this Conditional (see CharacterConditional) when cast
  castGrantConditions?: string[] // condition names (from ALL_CONDITIONS) applied when cast
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

// One tracked resource ("Charges 3/10", "1/Day Recall") — the base trackable/
// maxUses/usesUsed/resetsOn fields on Feature stay as the single/primary
// tracker for backward compatibility; `trackers` holds any additional ones
// once `multiTracking` is toggled on (e.g. a staff: primary tracker is
// "Charges 7/7", trackers[0] is "1/Day Recall"). Mirrors the multiDamage/
// damages pattern on DamageEntry.
export interface UseTracker {
  id: string
  label?: string
  maxUses?: number
  maxUsesFormula?: "pb"
  usesUsed?: number
  resetsOn?: "short" | "long" | "dawn" | "manual"
}

export interface Feature {
  id: string
  name: string
  source?: string            // "Fighter", "Variant Human", etc.
  level?: number             // character level this was gained at
  description?: string
  trackable?: boolean
  trackerLabel?: string      // name for the primary tracker's bar (e.g. "Charges") — mirrors UseTracker.label, mainly useful once multiTracking adds more bars so it's clear which is which
  maxUses?: number
  maxUsesFormula?: "pb"      // when set, max uses = proficiency bonus
  usesUsed?: number
  resetsOn?: "short" | "long" | "dawn" | "manual"
  linkedTo?: string[]        // IDs of features that share this use counter (bidirectional)
  multiTracking?: boolean    // toggle — on splits use-tracking across `trackers` instead of just the single trackable/maxUses/usesUsed triplet
  trackers?: UseTracker[]    // additional tracked bars beyond the primary trackable/maxUses/usesUsed, only used when multiTracking is on
  requiresAttunement?: boolean // does this item require attunement at all?
  attuned?: boolean          // is the character currently attuned to this item?
  equipped?: boolean         // currently worn/wielded/carried-in-hand — any item can be equipped, not just armor. Applies itemMeta.acBonus to AC when it's an armor-kind item; equipped or attuned items show under the character sheet's Equipped list, everything else lands in Carried Items
  isMagicItem?: boolean      // cosmetic flag — no mechanical effect. The visual treatment itself (None/Outline/Galaxy) is a sheet-wide Settings choice (CharacterData.magicItemStyle), not per item
  weight?: number            // lb — rolled into the character's total carried weight
  value?: number             // gp — per-unit value, rolled into the character's total carried value
  amount?: number            // Items tab, generic items only — quantity (armor/equipment is always qty 1)
  trackAmount?: boolean      // Items tab, generic items only — opt-in: shows a −/+ stepper (in the expanded description view) for consumables you add/remove one at a time; off by default so one-off items don't carry a counter nobody uses
  category?: "armor" | "item" // Items tab only — which stat fields this item's edit form shows (armor/weapon fields vs. generic amount/container fields); no longer determines which list (Equipped vs Carried) it shows in
  equipKind?: "armor" | "weapon" | "misc" // Armor & Equipment section only — which stat fields apply
  isContainer?: boolean      // Items tab only — acts like a folder; other items can be placed inside it
  maxWeight?: number         // Items tab only — containers: weight capacity for items placed inside
  containerIgnoresWeight?: boolean  // Items tab, containers only — "Bag of Holding": items placed inside don't count toward the character's total carried weight (the container's own weight, and its own maxWeight capacity check, are unaffected)
  parentId?: string          // Items tab only — id of the containing item, when nested inside a container
  rarity?: "Common" | "Uncommon" | "Rare" | "Very Rare" | "Legendary" | "Artifact" | "Wondrous"  // Items tab only
  itemMeta?: {                // set when created from an Items-tab documentation suggestion, or edited directly
    itemType?: string
    damage?: string
    damageType?: string
    multiDamage?: boolean     // toggle — on splits damage across `damages` instead of the single damage/damageType pair
    damages?: DamageEntry[]   // additional damage instances beyond the primary damage/damageType, only used when multiDamage is on
    properties?: string
    acBonus?: number          // flat AC bonus granted while equipped — stacks on top of everything (shields, rings, cloaks).
                               // Ignored when armorMode is "base" (that piece sets AC via armorBaseAc/armorDexMode instead).
    armorMode?: "base" | "bonus"      // "base" = this piece sets the character's whole AC while equipped (body armor),
                                       // replacing the 10 + ability formula; "bonus" (default, back-compat) = acBonus stacks as-is
    armorBaseAc?: number               // base AC value while equipped, only used when armorMode === "base"
    armorDexMode?: "full" | "half" | "none"  // how the Dex modifier applies on top of armorBaseAc — full (light),
                                              // half/max +2 (medium), or none (heavy); only used when armorMode === "base"
    stealthDisadvantage?: boolean  // this armor piece imposes disadvantage on Stealth checks while equipped —
                                    // surfaces as an auto (non-removable) pill in ConditionsCard, see character.tsx
    weaponKind?: "melee" | "ranged"  // only meaningful when equipKind === "weapon"
    meleeRange?: string       // e.g. "5 ft."
    throwRange?: string       // e.g. "20/60 ft." — thrown melee weapons
    range?: string            // e.g. "80/320 ft." — ranged weapons
    // The rest mirror EquipmentItem's attack-roll fields 1:1 so a weapon edited
    // here and one edited on the Martial tab (EquipmentEntry.tsx) offer the
    // exact same options — see equipmentFieldsFromFeature/featureFieldsFromEquipment
    // in character.tsx, which mirror edits made on either side onto the other.
    attackStat?: "str" | "dex" | "con" | "int" | "wis" | "cha"
    magicBonus?: string       // e.g. "+1", "+2"
    toHit?: string            // manual override when attackStat is not set
    extraToHit?: number       // flat bonus added to computed to-hit, only used when attackStat is set
    extraDamage?: number      // flat bonus added to computed damage, only used when attackStat is set
    proficient?: boolean
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
  source?: string  // e.g. `form:${formId}` — set when a Form auto-granted this condition, so
                    // reverting that Form only strips what it granted, never a condition of the
                    // same name the player added manually. Unset = manually added, as before.
}

// A reusable preset — Wild Shape, Haste, Rage, etc. — that temporarily overrides
// stats/AC/speed/HP, shows a notification pill near the character's level, and can
// auto-grant/revoke conditions while active. See CharacterData.forms/activeFormId
// and CharacterSheet.tsx's formActivationPatch/activateForm/castSpell.
export interface FormStatOverrides {
  strength?: number
  dexterity?: number
  constitution?: number
  intelligence?: number
  wisdom?: number
  charisma?: number
  acBonus?: number       // stacks on top of computed AC, same semantics as acMiscBonus
  acOverride?: number    // replaces the total AC outright when set
  speedOverride?: number // replaces walking speed when set (conditions forcing speed to 0 still win)
  maxHpBonus?: number    // stacks on top of maxHp + maxHpMod while this form is active
}

export interface CharacterForm {
  id: string
  name: string
  notes?: string
  overrides?: FormStatOverrides
  notification?: string        // banner text shown near Lv while active; blank = no banner
  grantedConditions?: string[] // names from ALL_CONDITIONS, auto-applied on activate / auto-removed on revert
  revertOnZeroHp?: boolean     // auto-revert to Base Form the instant HP hits 0 while this form is active
  formMaxHp?: number           // Wild Shape-style separate HP pool for this form, tracked in CharacterData.formHp —
                                // entirely independent of the character's own hp/maxHp while active. Unset (the
                                // default) means the form shares the character's normal HP pool as before.
  tempHp?: number              // grants this much temp HP on activation — same semantics as CharacterConditional's
                                // tempHp (take the higher of current and this, not additive)
  portraitUrl?: string         // replaces the header portrait while this form is active; blank = keep the character's own portrait
}

// The lightweight sibling of a Form — a one-shot "apply this now" (temp HP,
// healing, a condition or two) for things that don't warrant a whole Form
// with stat overrides/notification/revert rules. No active/revert state:
// triggering it just applies its effects once. See utils.ts's
// conditionalTriggerPatch.
export interface CharacterConditional {
  id: string
  name: string
  tempHp?: number           // grants this much temp HP (5e: take the higher of current and this, not additive)
  healHp?: number           // heals this much HP, clamped to max
  grantConditions?: string[] // condition names applied once when triggered
}

export interface ProficiencyEntry {
  id: string
  name: string
  favorite?: boolean
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
  age?: string
  height?: string
  weight?: string
  eyes?: string
  skin?: string
  hair?: string
  ac?: number          // legacy manual AC — only read as a fallback for characters that predate acAbility (see computeAc)
  acBase?: number      // base number the ability mod(s) are added to (formula is acBase + mods); default 10
  acAbility?: "str" | "dex" | "con" | "int" | "wis" | "cha"   // ability feeding the base AC formula; default "dex"
  acAbility2?: "str" | "dex" | "con" | "int" | "wis" | "cha"  // optional 2nd ability for dual-stat AC (Monk Wis, Barbarian Con); unset = off
  acMiscBonus?: number // flat AC adjustment on top of the computed value (feats, homebrew, etc.)
  hp?: number
  maxHp?: number
  maxHpMod?: number    // flat bonus or penalty to max HP (positive = bonus, negative = reduction)
  hideEquipAcBadge?: boolean // hides the "+X equip" AC-bonus badge under the HP/AC ring
  tempHp?: number
  formHp?: number  // current HP within the active form's own pool — only meaningful while
                    // activeFormId points at a form with formMaxHp set (see CharacterForm)
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
  showMagicItemStar?: boolean    // default true — the "✨" badge on items flagged Magic Item
  magicItemStyle?: "none" | "outline" | "galaxy"  // default "galaxy" — sheet-wide card background applied to every item flagged Magic Item; "none" = no card decoration beyond the star badge; "galaxy" is labeled "Animated" in the UI
  magicItemColor?: string  // accent color for both magicItemStyle and magicItemSliderStyle — default DEFAULT_ACCENT_COLOR
  magicItemSliderStyle?: "none" | "outline" | "galaxy"  // default "none" — separate look for magic items' own "Track uses" bars, independent of magicItemStyle (the card background)
  notes?: string
  backgroundImage?: string
  theme?: string
  themeCustomColor?: string  // accent color for theme "custom" — see character-themes.ts THEMES
  slotTheme?: string
  slotCustomColor?: string  // accent color for slotTheme "custom" — see character-themes.ts SLOT_THEMES
  slotAnimated?: boolean    // Settings — shimmering iridescent slot bars instead of a flat color
  equipmentItems?: EquipmentItem[]
  spellItems?: SpellItem[]
  hitDicePools?: HitDicePool[]
  spellSlots?: SpellSlot[]
  racialTraits?: Feature[]
  feats?: Feature[]
  classFeatures?: Feature[]
  items?: Feature[]
  invocations?: Feature[]  // Eldritch Invocations (Warlock)
  infusions?: Feature[]    // Infusions (Artificer)
  favorites?: FavoriteRef[]
  favoriteCategoryColors?: Partial<Record<FavoriteCategory, string>>  // Settings — accent color per category (race/class/feat/invocation/spell/equipment/familiar — "item" is deliberately excluded, see STYLING_CATEGORIES), applied everywhere that category renders, not just Favorites
  favoriteCategoryStyle?: Partial<Record<FavoriteCategory, CardStyle>>  // Settings — per category: "none" (default/off), "outline" (colored border), or "galaxy" (animated background in that color) — mirrors magicItemStyle
  favoriteCategorySliderStyle?: Partial<Record<FavoriteCategory, CardStyle>>  // Settings — per category: separate look for that category's own "Track uses" bars, independent of favoriteCategoryStyle (the card background) — mirrors magicItemSliderStyle
  classFeatureColorsByClass?: boolean  // Settings — when true, Class Features cards are colored per-class (classFeatureColors) instead of the single favoriteCategoryColors.class accent
  classFeatureColors?: Record<string, string>  // Settings — accent color per class key (e.g. "fighter"), only used when classFeatureColorsByClass is on — see character-class-colors.ts's matchClassKey/deriveCharacterClassNames
  uiScale?: 100 | 75 | 50  // Settings — "Modules and Font Size": sheet-wide zoom level, default 100
  carryCapacityBonus?: number  // flat lb bonus added on top of the computed STR × 15 carrying capacity — set via clicking the ⚖ carry-weight badge
  conditions?: ActiveCondition[]
  forms?: CharacterForm[]           // Automation — reusable alternate-form/buff presets, see CharacterForm
  activeFormId?: string | null      // id of the currently-active form; null/unset = Base Form
  // Multi-form mode — currently gated to a specific user+character in
  // CharacterSheet.tsx (see multiFormEnabled) rather than exposed generally,
  // since most characters only ever have one form active at a time. When
  // enabled, this fully replaces activeFormId: any number of forms can be
  // simultaneously active (e.g. a shapeshifted form stacked with a
  // buff/mutagen form), each contributing its own overrides/conditions/
  // notification. Whichever active form has formMaxHp set (if any) still
  // owns the one HP pool/portrait — you can't have two bodies at once.
  activeFormIds?: string[]
  conditionals?: CharacterConditional[] // Automation — one-shot "apply this now" effects, see CharacterConditional
  castButtonEnabled?: boolean // Automation (Cast tab) — master switch that shows the themed Cast button next to Cantrips in the Spells panel
  familiars?: FamiliarRef[]
  skillProfs?: Record<string, "half" | "prof" | "exp">
  skillBonuses?: Record<string, number>
  customSkills?: { id: string; name: string; ability: string }[]  // right-click "Add Custom Skill" on the Skills panel — stored separately from the fixed SKILLS list but keyed into skillProfs/skillBonuses by name just like a built-in skill
  saveBonuses?: Partial<Record<"str" | "dex" | "con" | "int" | "wis" | "cha", number>>
  spellsPrepared?: number
  initiativeStat?: string  // ability key e.g. "dex"; default "dex"
  initiativeBonus?: number // flat bonus added to the mod
  themeBg?: string             // background override key from BG_OPTIONS
  themeBgCustomColor?: string  // background color for themeBg "custom" — see character-themes.ts BG_OPTIONS
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
