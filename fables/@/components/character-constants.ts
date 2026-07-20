// Static lookup tables for ability scores and saving throws

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
  "Blinded", "Charmed", "Concentrating", "Deafened", "Exhaustion",
  "Frightened", "Grappled", "Incapacitated", "Invisible", "Paralyzed",
  "Petrified", "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious",
]

export const CONDITION_EFFECTS: Record<string, string> = {
  Blinded:       "Disadvantage on attack rolls; attacks against you have advantage.",
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

// ── Favorites accent colors ──────────────────────────────────────────────────
// Configured once per category in Settings (CharacterData.favoriteCategoryColors)
// and applied automatically to every favorited card of that category — see
// FavoritesPanel.tsx. "feature" refType favorites are further split by which
// list they came from (race/class/feat/item/invocation); the other refTypes
// (spell/equipment/familiar) are each their own category.

export const FAVORITE_ACCENT_COLORS = [
  { name: "Violet", value: "#8b5cf6" },
  { name: "Blue",   value: "#3b82f6" },
  { name: "Green",  value: "#22c55e" },
  { name: "Amber",  value: "#f59e0b" },
  { name: "Red",    value: "#ef4444" },
  { name: "Pink",   value: "#ec4899" },
] as const

export type FavoriteCategory = "race" | "class" | "feat" | "item" | "invocation" | "spell" | "equipment" | "familiar"

export const FAVORITE_CATEGORY_LABELS: Record<FavoriteCategory, string> = {
  race:       "Racial Traits",
  class:      "Class Features",
  feat:       "Feats",
  item:       "Items",
  invocation: "Invocations",
  spell:      "Spells",
  equipment:  "Martial",
  familiar:   "Familiars",
}

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
