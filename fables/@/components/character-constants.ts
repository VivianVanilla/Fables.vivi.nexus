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
