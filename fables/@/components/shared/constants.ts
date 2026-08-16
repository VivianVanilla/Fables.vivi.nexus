// Static lookup tables for ability scores and saving throws

// The Hjolland interactive map is a one-off feature scoped to a single,
// hardcoded campaign rather than a general per-party tool — used both to
// gate the Map button itself (party/PartyServer.tsx) and to gate map-only
// NPC Tracker fields like "last seen at" (npcTracker/NpcTrackerOverlay.tsx),
// which reference map pins that don't exist for any other party.
export const MAP_PARTY_CODE = "KOQK21"

export const ABILITY_KEYS = [
  "strength", "dexterity", "constitution",
  "intelligence", "wisdom", "charisma",
] as const

export const ABILITY_ABBR: Record<string, string> = {
  strength: "STR",
  dexterity: "DEX",
  constitution: "CON",
  intelligence: "INT",
  wisdom: "WIS",
  charisma: "CHA",
}

export const SAVE_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const

export const SAVE_TO_ABILITY: Record<string, string> = {
  str: "strength",
  dex: "dexterity",
  con: "constitution",
  int: "intelligence",
  wis: "wisdom",
  cha: "charisma",
}

export const SUPABASE_BUCKET = "fableimages"

// ── Condition mechanical effects ────────────────────────────────────────────
// Short reminders of what an active condition actually does, shown as
// persistent notices next to the character's name. Not exhaustive — only
// conditions with a clear, general-purpose combat effect are covered.

export const ALL_CONDITIONS = [
  "Blinded", "Charmed", "Concentrating", "Deafened", "Deathward", "Exhaustion",
  "Frightened", "Grappled", "Incapacitated", "Invisible", "Paralyzed",
  "Petrified", "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious",
]

export const CONDITION_EFFECTS: Record<string, string> = {
  Blinded:       "Disadvantage on attack rolls; attacks against you have advantage.",
  Deathward:     "The next time you'd drop to 0 HP, you drop to 1 instead — then this condition is removed.",
  Charmed:       "Can't attack the charmer or target them with harmful abilities.",
  Deafened:      "Automatically fails ability checks that require hearing.",
  Frightened:    "Disadvantage on attack rolls and ability checks while the source is in sight.",
  Grappled:      "Speed is 0 and can't benefit from any bonus to speed.",
  Incapacitated: "Can't take actions or reactions.",
  Invisible:     "Attacks against you have disadvantage; your attacks have advantage.",
  Paralyzed:     "Auto-fails STR/DEX saves; attacks against you have advantage and auto-crit within 5 ft.",
  Petrified:     "Incapacitated, can't move or speak, and unaware of your surroundings.",
  Poisoned:      "Disadvantage on attack rolls and ability checks.",
  Prone:         "Disadvantage on attack rolls; melee attacks against you have advantage.",
  Restrained:    "Speed is 0; disadvantage on attack rolls and DEX saves; attacks against you have advantage.",
  Stunned:       "Auto-fails STR/DEX saves; attacks against you have advantage.",
  Unconscious:   "Incapacitated, can't move or speak, unaware of your surroundings; attacks against you have advantage and auto-crit within 5 ft.",
}

// Conditions that force speed to 0 per RAW, until removed
export const SPEED_ZERO_CONDITIONS = ["Grappled", "Restrained"]

export const ITEM_RARITIES = ["Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact", "Wondrous"] as const

export const RARITY_COLORS: Record<string, string> = {
  "Common":    "bg-white/10 text-white/50",
  "Uncommon":  "bg-green-500/15 text-green-300",
  "Rare":      "bg-blue-500/15 text-blue-300",
  "Very Rare": "bg-purple-500/15 text-purple-300",
  "Legendary": "bg-orange-500/15 text-orange-300",
  "Artifact":  "bg-red-500/15 text-red-300",
  "Wondrous":  "bg-teal-500/15 text-teal-300",
}

// ── Feature Stylings (category accent colors) ────────────────────────────────
// Configured once per category in Settings (CharacterData.favoriteCategoryColors
// + favoriteCategoryStyle) and applied automatically to every card of that
// category everywhere it's rendered, not just when favorited — see
// FeatureEntry.tsx's categoryAccentStyle/coloredNebulaBg and their callers.
// "feature" refType favorites are further split by which list they came from
// (race/class/feat/item/invocation); the other refTypes (spell/equipment/
// familiar) are each their own category.

// Same 3-state shape as the Magic Item card style, reused here so a category
// accent renders with the exact same options: no treatment, just a colored
// border, or the full animated nebula background (in the category's color
// instead of the fixed magic-item purple).
export type CardStyle = "none" | "outline" | "galaxy"

export type FavoriteCategory = "race" | "class" | "feat" | "item" | "invocation" | "infusion" | "spell" | "equipment" | "familiar"

export const FAVORITE_CATEGORY_LABELS: Record<FavoriteCategory, string> = {
  race:       "Racial Traits",
  class:      "Class Features",
  feat:       "Feats",
  item:       "Items",
  invocation: "Invocations",
  infusion:   "Infusions",
  spell:      "Spells",
  equipment:  "Martial",
  familiar:   "Familiars",
}

// Rendered in Settings — "item" is deliberately excluded: it's the Items tab,
// which already has its own dedicated Magic Item styling section right above
// this one, so a second color-by-category control for the same list would
// just be two competing ways to style the same cards. "invocation"/"infusion"
// rows are further hidden unless the character's class spread actually
// includes Warlock/Artificer — see SettingsModal.tsx.
export const STYLING_CATEGORIES: FavoriteCategory[] = ["race", "class", "feat", "invocation", "infusion", "spell", "equipment", "familiar"]

export const DEFAULT_ACCENT_COLOR = "#8b5cf6"

// Settings — "Modules and Font Size": sheet-wide zoom level. 100% is the
// current/default size; 75%/50% shrink everything (fonts, padding, cards) to
// fit more on screen at once.
export const UI_SCALES = [100, 75, 50] as const

export const SKILLS = [
  { name: "Acrobatics",       ability: "dex" },
  { name: "Animal Handling",  ability: "wis" },
  { name: "Arcana",           ability: "int" },
  { name: "Athletics",        ability: "str" },
  { name: "Deception",        ability: "cha" },
  { name: "History",          ability: "int" },
  { name: "Insight",          ability: "wis" },
  { name: "Intimidation",     ability: "cha" },
  { name: "Investigation",    ability: "int" },
  { name: "Medicine",         ability: "wis" },
  { name: "Nature",           ability: "int" },
  { name: "Perception",       ability: "wis" },
  { name: "Performance",      ability: "cha" },
  { name: "Persuasion",       ability: "cha" },
  { name: "Religion",         ability: "int" },
  { name: "Sleight of Hand",  ability: "dex" },
  { name: "Stealth",          ability: "dex" },
  { name: "Survival",         ability: "wis" },
] as const
