// Small helper functions used throughout the character sheet

import type { CharacterData } from "./character-types"

/** Returns the ability modifier as a signed string, e.g. "+2" or "-1" */
export function abilityMod(score: number): string {
  const mod = Math.floor((score - 10) / 2)
  return mod >= 0 ? `+${mod}` : `${mod}`
}

const AC_ABILITY_TO_FULL: Record<string, "strength" | "dexterity" | "constitution" | "intelligence" | "wisdom" | "charisma"> = {
  str: "strength", dex: "dexterity", con: "constitution",
  int: "intelligence", wis: "wisdom", cha: "charisma",
}

/** Returns the flat ability modifier (number) for a short key ("str", "dex", ...), default score 10 if unset */
export function abilityScoreMod(data: CharacterData, key?: string): number {
  const full = key ? AC_ABILITY_TO_FULL[key] : undefined
  const score = (full ? data[full] : undefined) ?? 10
  return Math.floor((score - 10) / 2)
}

export interface AcResult {
  total: number
  base: number
  equipBonus: number      // stacked flat bonuses from equipped shields/rings/etc.
  armorName?: string      // name of the equipped "base armor" piece driving `base`, if set
}

/**
 * Computes a character's AC: 10 + the chosen ability modifier(s) (dual-stat aware),
 * overridden by any equipped "base armor" piece's own base-AC + Dex formula, plus
 * flat bonuses from equipped shields/rings/etc. Legacy characters that never opened
 * the AC picker (no acAbility set) keep their old manually-typed `ac` value as-is.
 */
export function computeAc(data: CharacterData): AcResult {
  const equippedArmor = (data.items ?? []).filter(i => i.equipped && (i.equipKind ?? "armor") === "armor")

  const baseArmor = equippedArmor
    .filter(i => i.itemMeta?.armorMode === "base" && i.itemMeta?.armorBaseAc != null)
    .map(i => {
      const dexMode = i.itemMeta?.armorDexMode ?? "full"
      const dexMod  = abilityScoreMod(data, "dex")
      const applied = dexMode === "none" ? 0 : dexMode === "half" ? Math.min(dexMod, 2) : dexMod
      return { name: i.name, value: (i.itemMeta!.armorBaseAc ?? 0) + applied }
    })
    .sort((a, b) => b.value - a.value)[0]

  const equipBonus = equippedArmor
    .filter(i => i.itemMeta?.armorMode !== "base")
    .reduce((sum, i) => sum + (i.itemMeta?.acBonus ?? 0), 0)

  let base: number
  let armorName: string | undefined
  if (baseArmor) {
    base = baseArmor.value
    armorName = baseArmor.name
  } else if (data.acAbility == null && data.acAbility2 == null && data.acBase == null && data.ac != null) {
    base = data.ac
  } else {
    base = (data.acBase ?? 10) + abilityScoreMod(data, data.acAbility ?? "dex") + (data.acAbility2 ? abilityScoreMod(data, data.acAbility2) : 0)
  }

  return { total: base + equipBonus + (data.acMiscBonus ?? 0), base, equipBonus, armorName }
}

/** Returns the proficiency bonus for a given character level */
export function profBonus(level: number): number {
  return Math.ceil(level / 4) + 1
}

/** Generates a short random ID for list items */
export function nanoid(): string {
  return Math.random().toString(36).slice(2, 10)
}

/** Parses JSON safely, returns an empty object on failure */
export function safeParseJson(value: unknown): Record<string, unknown> {
  try {
    if (!value) return {}
    if (typeof value === "string") return JSON.parse(value)
    if (typeof value === "object") return value as Record<string, unknown>
    return {}
  } catch {
    return {}
  }
}

// Avoids two notes sharing the exact same default name — appends " 2", " 3",
// etc. until the name is free, same pattern as "Untitled (2)" in most
// desktop file managers.
export function uniqueName(baseName: string, existingNames: string[]): string {
  const taken = new Set(existingNames.map(n => n.trim().toLowerCase()))
  const base = baseName.trim()
  if (!taken.has(base.toLowerCase())) return base
  let i = 2
  while (taken.has(`${base} ${i}`.toLowerCase())) i++
  return `${base} ${i}`
}

// ── Prepared-caster max spell level, by character level in that class ─────────
// (standard 5e slot progression — full/half/pact casters only; other classes
// have no innate spell list to import from)
const FULL_CASTERS = new Set(["bard", "cleric", "druid", "sorcerer", "wizard"])
const HALF_CASTERS = new Set(["paladin", "ranger"])

/** Returns the highest spell level a class can prepare/know at a given character level (0 if it's not a spellcasting class). */
export function maxSpellLevelForClass(cls: string, level: number): number {
  const c = cls.toLowerCase()
  if (FULL_CASTERS.has(c)) return Math.min(9, Math.ceil(level / 2))
  if (HALF_CASTERS.has(c)) return level < 2 ? 0 : Math.min(5, Math.floor((level - 1) / 4) + 1)
  if (c === "warlock")     return Math.min(5, Math.ceil(level / 2))
  return 0
}
