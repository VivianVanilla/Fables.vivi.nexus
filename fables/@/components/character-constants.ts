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
