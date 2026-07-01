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
