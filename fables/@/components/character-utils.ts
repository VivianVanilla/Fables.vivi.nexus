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
