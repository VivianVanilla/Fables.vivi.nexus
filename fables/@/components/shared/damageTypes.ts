// Shared color mapping for D&D damage types — used anywhere a damage type
// badge/pill is rendered (spells, weapons, monster actions) so the same type
// always reads as the same color.

interface DamageColor {
  text: string  // Tailwind text-* class
  bg: string    // Tailwind bg-*/opacity class
}

const DAMAGE_TYPE_COLORS: Record<string, DamageColor> = {
  acid:        { text: "text-lime-300",    bg: "bg-lime-500/15" },
  bludgeoning: { text: "text-stone-300",   bg: "bg-stone-500/20" },
  cold:        { text: "text-sky-300",     bg: "bg-sky-500/15" },
  fire:        { text: "text-orange-300",  bg: "bg-orange-500/15" },
  force:       { text: "text-violet-300",  bg: "bg-violet-500/15" },
  lightning:   { text: "text-yellow-300",  bg: "bg-yellow-500/15" },
  necrotic:    { text: "text-purple-300",  bg: "bg-purple-900/30" },
  piercing:    { text: "text-zinc-300",    bg: "bg-zinc-500/20" },
  poison:      { text: "text-green-300",   bg: "bg-green-500/15" },
  psychic:     { text: "text-fuchsia-300", bg: "bg-fuchsia-500/15" },
  radiant:     { text: "text-amber-300",   bg: "bg-amber-400/20" },
  slashing:    { text: "text-red-300",     bg: "bg-red-500/15" },
  thunder:     { text: "text-blue-300",    bg: "bg-blue-500/15" },
}

const DEFAULT_COLOR: DamageColor = { text: "text-red-300/80", bg: "bg-red-500/15" }

/** Returns "text-* bg-*" classes for a damage type, matching regardless of case/whitespace. */
export function damageTypeClasses(damageType?: string): string {
  const key = damageType?.trim().toLowerCase() ?? ""
  const color = DAMAGE_TYPE_COLORS[key] ?? DEFAULT_COLOR
  return `${color.bg} ${color.text}`
}

// The 13 standard D&D damage types — used to populate "Dmg Type" dropdowns
// instead of free text (also acts as the canonical casing for damageTypeClasses).
export const DAMAGE_TYPES = [
  "Acid", "Bludgeoning", "Cold", "Fire", "Force", "Lightning", "Necrotic",
  "Piercing", "Poison", "Psychic", "Radiant", "Slashing", "Thunder",
] as const

// ── Multi-damage-type support (weapons, monster actions, items) ─────────────
//
// Most things deal one instance of damage — `damage`/`damageType` — but some
// (a flaming sword, a monster's breath-and-claw attack) deal several at once.
// `multiDamage` toggles between that single pair and the repeatable `damages`
// list. Lives here (not in the DamageFields.tsx editor component) so a plain
// TS import of the math doesn't drag a component file's Fast Refresh boundary
// along with it.

export interface DamageEntryLike {
  damage: string
  damageType?: string
}

export interface MultiDamageFields {
  damage?: string
  damageType?: string
  multiDamage?: boolean
  damages?: DamageEntryLike[]
}

export interface DamageSegment {
  text: string
  damageType?: string
}

// Flattens the primary damage/damageType pair + any extra `damages` rows into
// one ordered list of segments to render/join. `modifier` (already-summed
// to-hit-style bonus, e.g. from a weapon's stat mod + magic bonus) is folded
// into only the FIRST segment, matching how a bonus weapon die (like a
// flaming sword's fire damage) never gets your STR mod added.
export function computeDamageSegments(fields: MultiDamageFields, modifier = 0): DamageSegment[] {
  const entries: DamageEntryLike[] = fields.multiDamage && fields.damages?.length
    ? fields.damages
    : (fields.damage ? [{ damage: fields.damage, damageType: fields.damageType }] : [])

  return entries.map((e, i) => ({
    text: i === 0 && modifier !== 0 ? `${e.damage}${modifier > 0 ? "+" : ""}${modifier}` : e.damage,
    damageType: e.damageType,
  }))
}
