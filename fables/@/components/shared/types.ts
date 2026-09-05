// All data shapes used by the character sheet

import type { FavoriteCategory, CardStyle } from "./constants"
import type { EquipmentItem } from "./deprecated/legacyEquipment"  // DEPRECATED — see deprecated/legacyEquipment.ts

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

export interface SpellItem {
  id: string
  name: string
  level?: number
  school?: string               // "Evocation", "Conjuration", etc.
  toHit?: string                // attack bonus string
  saveAttr?: string             // "Dex", "Con", etc.
  saveType?: string             // DEPRECATED field (kept for compat)
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
  pinned?: boolean               // shows this spell a second time in a "Pinned" section above Cantrips — it still renders in its normal level group too, this doesn't move it
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
  // Automation — set when a spell can trigger one of several alternate
  // effects (mirrors Feature.triggerVariants — same reasoning, e.g. a
  // spell that lets you pick a damage type or one of a few outcomes).
  // Casting with variants set shows a small picker (AutomationModal.tsx's
  // CastTab) that resolves castFormId/castConditionalId for that one cast
  // — nothing is written back onto the spell itself, unlike a feature's
  // use-tracking variants, since a Cast is a one-shot action, not a slider
  // whose state persists between spends.
  castVariants?: { id: string; label: string; castFormId?: string; castConditionalId?: string }[]
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
  manualBulkRegain?: boolean  // resetsOn "manual" only — shows a step number + "Regain" button on the card (like the HP +/- stepper) so recovering several at once doesn't mean clicking the slider one at a time
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
  manualBulkRegain?: boolean  // resetsOn "manual" only — see UseTracker.manualBulkRegain, same semantics
  linkedTo?: string[]        // IDs of features that share this use counter (bidirectional)
  triggerFormId?: string          // Automation — activates this Form (see CharacterForm) whenever a use of this feature is spent (see utils.ts's featureUsePatch)
  triggerConditionalId?: string   // Automation — triggers this Conditional (see CharacterConditional) whenever a use of this feature is spent
  // Automation — set when a feature can trigger one of several alternate
  // I HATE CONDITIONALS FUCK WHOEVER CAME UP WITH THIS SHIT AHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH
  triggerVariants?: { id: string; label: string; triggerFormId?: string; triggerConditionalId?: string }[]
  multiTracking?: boolean    // toggle — on splits use-tracking across `trackers` instead of just the single trackable/maxUses/usesUsed triplet
  trackers?: UseTracker[]    // additional tracked bars beyond the primary trackable/maxUses/usesUsed, only used when multiTracking is on
  requiresAttunement?: boolean // does this item require attunement at all?
  attuned?: boolean          // is the character currently attuned to this item?
  infused?: boolean          // Artificers Infusions list only — is this infusion currently "in use" (imbued into an item)? Counted against CharacterData.maxInfusedItems the same way attuned counts against maxAttunedItems
  equipped?: boolean         // currently worn/wielded/carried-in-hand — any item can be equipped, not just armor. Applies itemMeta.acBonus to AC when it's an armor-kind item; equipped or attuned items show under the character sheet's Equipped list, everything else lands in Carried Items
  isMagicItem?: boolean      // cosmetic flag — no mechanical effect. The visual treatment itself (None/Outline/Galaxy) is a sheet-wide Settings choice (CharacterData.magicItemStyle), not per item
  weight?: number            // lb — rolled into the character's total carried weight
  value?: number             // gp — per-unit value, rolled into the character's total carried value
  amount?: number            // Items tab, generic items only — quantity (armor/equipment is always qty 1)
  trackAmount?: boolean      // Items tab, generic items only — opt-in: shows a −/+ stepper (in the expanded description view) for consumables you add/remove one at a time; off by default so one-off items don't carry a counter nobody uses
  category?: "armor" | "item" // Items tab only — which stat fields this item's edit form shows (armor/weapon fields vs. generic amount/container fields); no longer determines which list (Equipped vs Carried) it shows in
  equipKind?: "armor" | "weapon" | "misc" // Armor & Equipment section only — which stat fields apply
  inMartial?: boolean    // weapon-only — also shown in the Martial tab (same record, not a copy — see FeatureEntry.tsx's "+ Martial Tab" toggle)
  martialOnly?: boolean  // weapon-only — created directly from the Martial tab ("+ Add Weapon", e.g. fists/natural attacks); stays out of Gear's own Equipped/Carried lists. Implies inMartial.
  isContainer?: boolean      // Items tab only — acts like a folder; other items can be placed inside it
  maxWeight?: number         // Items tab only — containers: weight capacity for items placed inside
  containerIgnoresWeight?: boolean  // Items tab, containers only — "Bag of Holding": items placed inside don't count toward the character's total carried weight (the container's own weight, and its own maxWeight capacity check, are unaffected)
  parentId?: string          // Items tab only — id of the containing item, when nested inside a container
  rarity?: "Common" | "Uncommon" | "Rare" | "Very Rare" | "Legendary" | "Artifact"  // Items tab only
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
    // The rest are the weapon's attack-roll fields — computed into a live
    // to-hit/damage display by the shared helpers in damageTypes.ts whenever
    // equipKind is "weapon", whether this Feature is showing in Gear, in the
    // Martial tab (inMartial/martialOnly), or both — it's the same record.
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
  // "equipment" is DEPRECATED (pre Gear/Martial merge) — migrateEquipmentItems()
  // remaps any surviving "equipment" favorite to "feature" on load, so
  // nothing should ever create a new one.
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
  carryCapacityBonus?: number // stacks on top of computed carry capacity, same semantics as
                               // CharacterData.carryCapacityBonus (and note a Strength override
                               // above already scales capacity too — the two stack)
}

export interface CharacterForm {
  id: string
  name: string
  notes?: string
  overrides?: FormStatOverrides
  notification?: string        // banner text shown near Lv while active; blank = no banner
  grantedConditions?: string[] // names from ALL_CONDITIONS, auto-applied on activate / auto-removed on revert
  grantedResistances?: string[]     // damage type names from DAMAGE_TYPES, auto-applied on activate / auto-removed
                                     // on revert — mirrors grantedConditions, but for the ⚖ Resistances panel
  grantedVulnerabilities?: string[] // same as grantedResistances, for vulnerability instead
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
  triggerFormId?: string    // activates this Form (see CharacterForm) when triggered — same idea as
                             // SpellItem.castFormId/Feature.triggerFormId, applied before tempHp/healHp/
                             // grantConditions above so those read the post-activation state (a form's own
                             // max HP bonus, say) rather than the character's plain base stats
}

export interface ProficiencyEntry {
  id: string
  name: string
  favorite?: boolean
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
  ac?: number          // DEPRECATED manual AC — only read as a fallback for characters that predate acAbility (see computeAc)
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
  spellSaveDC?: number         // DEPRECATED manual value, superseded by computed 8 + PB + mod + spellSaveDCBonus
  spellAttackBonus?: number    // DEPRECATED manual value, superseded by computed PB + mod + spellAttackBonusBonus
  spellSaveDCBonus?: number       // extra flat bonus (magic items, feats, etc.) added on top of the computed save DC
  spellAttackBonusBonus?: number  // extra flat bonus added on top of the computed spell attack bonus
  spellcastingAbility?: string
  cantripsKnown?: number
  spellsKnown?: number
  invocationsKnown?: number   // Eldritch Invocations known (Warlock)
  maxInfusedItems?: number   // Artificer's Infusions list — how many infusions can be "in use" (Feature.infused) at once; click the counter badge on the list to edit, unlike maxAttunedItems this has no default (varies by level, only set once you're actually an Artificer)
  maxAttunedItems?: number   // Items list — how many items can be attuned at once; click the counter badge to edit, defaults to 3 (the standard 5e rule) when unset
  spellSlotDisplay?: "integrated" | "classic"   // integrated = slot sliders next to level headers; classic = standalone block at the top
  spellsDisplay?: "list" | "bubbles"            // list = one spell per row; bubbles = spells size to their content and wrap to pack multiple per line
  showKnownBadge?: boolean                      // opt-in — shows a small "K" tag on spells with alwaysPrepared set (Known — e.g. a Sorcerer/Warlock spell that's always available, not just prepared today)
  hideJumpCalculator?: boolean   // true = hide the jump distance calculator on the Combat tab
  showResistanceTracker?: boolean // opt-in (default off) — shows the Resistances/Vulnerabilities panel on the Combat tab
  resistances?: string[]         // damage type names (from DAMAGE_TYPES) this character has resistance to
  vulnerabilities?: string[]     // damage type names this character has vulnerability to
  hideSpellsSection?: boolean    // Settings — hides the Spells side of the Spells/Martial panel for a martial-only character; ignored if hideMartialSection is also on
  hideMartialSection?: boolean   // Settings — hides the Martial side for a caster-only character; ignored if hideSpellsSection is also on
  martialSaveDC?: number         // manually-set flat DC for martial abilities/maneuvers that call for one (e.g. Battle Master) — shown on the Martial panel only when set
  // Settings → "Share Link" — set/cleared as a whole (never edited directly)
  // via SettingsModal's Generate/Revoke buttons. Presence = sharing is on;
  // the actual URL is /share/<object id>/<this token>, resolved by
  // src/ShareView.tsx with no login required. Regenerating swaps this for a
  // fresh random value, which silently invalidates every link handed out
  // under the old one.
  shareToken?: string
  showMagicItemStar?: boolean    // default true — the "✨" badge on items flagged Magic Item
  magicItemStyle?: CardStyle  // default "galaxy" — sheet-wide card background applied to every item flagged Magic Item; "none" = no card decoration beyond the star badge; "galaxy"/"galaxy-light" are labeled "Animated (Dark)"/"Animated (Light)" in the UI
  magicItemColor?: string  // accent color for both magicItemStyle and magicItemSliderStyle — default DEFAULT_ACCENT_COLOR
  magicItemColorsByRarity?: boolean // Yes or no to Specific Raririty Colors
  magicItemRarityColors?: Partial<Record<"Common"|"Uncommon"|"Rare"|"Very Rare"|"Legendary"|"Artifact", string>> // A way to record each individual color
  magicItemRaritySliderColors?: Partial<Record<"Common"|"Uncommon"|"Rare"|"Very Rare"|"Legendary"|"Artifact", string>>  // this rarity tier's own "Track uses" bar color, only used when magicItemColorsByRarity is on — falls back to magicItemRarityColors when unset
  magicItemSliderStyle?: CardStyle  // default "none" — separate look for magic items' own "Track uses" bars, independent of magicItemStyle (the card background)
  notes?: string
  backgroundImage?: string
  theme?: string
  themeCustomColor?: string  // accent color for theme "custom" — see character-themes.ts THEMES
  slotTheme?: string
  slotCustomColor?: string  // accent color for slotTheme "custom" — see character-themes.ts SLOT_THEMES
  slotAnimated?: boolean    // Settings — shimmering iridescent slot bars instead of a flat color
  equipmentItems?: EquipmentItem[]  // DEPRECATED — see EquipmentItem's comment. Read once by migrateEquipmentItems() then cleared to []; nothing else should read or write this.
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
  favoriteCategoryTagColors?: Partial<Record<FavoriteCategory, string>>  // DEPRECATED — per-category tag color, superseded by the single global tagTextColor below. Kept only so old saved values don't error; nothing new writes to this.
  favoriteCategoryStyle?: Partial<Record<FavoriteCategory, CardStyle>>  // Settings — per category: "none" (default/off), "outline" (colored border), or "galaxy" (animated background in that color) — mirrors magicItemStyle
  favoriteCategorySliderStyle?: Partial<Record<FavoriteCategory, CardStyle>>  // Settings — per category: separate look for that category's own "Track uses" bars, independent of favoriteCategoryStyle (the card background) — mirrors magicItemSliderStyle
  favoriteCategorySliderColors?: Partial<Record<FavoriteCategory, string>>  // Settings — color of that category's own "Track uses" bars, independent of the card accent color above — falls back to favoriteCategoryColors when unset
  classFeatureColorsByClass?: boolean  // Settings — when true, Class Features cards are colored per-class (classFeatureColors/classFeatureSliderColors) instead of the single favoriteCategoryColors.class/favoriteCategorySliderColors accent
  classFeatureColors?: Record<string, string>  // Settings — card accent color per class key (e.g. "fighter"), only used when classFeatureColorsByClass is on — see character-class-colors.ts's matchClassKey/deriveCharacterClassNames
  classFeatureSliderColors?: Record<string, string>  // Settings — this class's own "Track uses" bar color, independent of classFeatureColors above — falls back to classFeatureColors when unset, same fallback rule favoriteCategorySliderColors has against favoriteCategoryColors
  uiScale?: 125 | 100 | 75  // Settings — "Modules and Font Size": sheet-wide zoom level, default 100
  // Settings — "Modules and Font Size": one sheet-wide switch, for a future
  // light background theme — "dark" flips essentially every white/light-gray
  // text element on the character sheet to matching-opacity black ("what if
  // someone wants a light theme"). "white" (default) is today's look,
  // unchanged. Two consumers: (1) CharacterSheet.tsx sets
  // data-sheet-text="dark" on its own root div, which index.css's bulk
  // text-white* override block (the only tractable way to reach the
  // hundreds of scattered white-text classes at once) responds to; (2) it's
  // also translated to "black"/"white" and threaded as the existing
  // tagTextColor/bodyTextColor props into FeatureEntry/SpellEntry, which
  // need finer control (also the tag badge's own background, not just its
  // text — see FeatureEntry.tsx's source-tag rendering, no longer
  // per-class-colored, this switch is now its only color source). NOTE:
  // this only recolors text — card/panel backgrounds are still always dark,
  // so "dark" text reads correctly only once a matching light background
  // theme also exists; that doesn't yet.
  textColorOverride?: "white" | "dark"
  carryCapacityBonus?: number  // flat lb bonus added on top of the computed STR × 15 carrying capacity — set via clicking the ⚖ carry-weight badge
  conditions?: ActiveCondition[]
  forms?: CharacterForm[]           // Automation — reusable alternate-form/buff presets, see CharacterForm
  activeFormId?: string | null      // id of the currently-active form; null/unset = Base Form
  // Multi-form mode — opt-in per character (Automation → Forms → "Allow
  // multiple Forms active at once"), off by default since most characters
  // only ever have one form active at a time. When on, this fully replaces
  // activeFormId: any number of forms can be simultaneously active (e.g. a
  // shapeshifted form stacked with a buff/mutagen form), each contributing
  // its own overrides/conditions/notification. Whichever active form has
  // formMaxHp set (if any) still owns the one HP pool/portrait — you can't
  // have two bodies at once.
  multiFormMode?: boolean
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
  // Proficiencies — entry lists per category (DEPRECATED characters may still have
  // these as a single free-text string; components normalize on read).
  weaponProfs?: ProficiencyEntry[] | string
  armorProfs?: ProficiencyEntry[] | string
  toolProfs?: ProficiencyEntry[] | string
  languageProfs?: ProficiencyEntry[] | string
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
