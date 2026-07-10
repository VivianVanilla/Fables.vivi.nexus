// Small helper functions used throughout the character sheet

/** Returns the ability modifier as a signed string, e.g. "+2" or "-1" */
export function abilityMod(score: number): string {
  const mod = Math.floor((score - 10) / 2)
  return mod >= 0 ? `+${mod}` : `${mod}`
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
