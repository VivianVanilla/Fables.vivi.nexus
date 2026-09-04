// Shared color mapping for D&D classes — used anywhere a class badge is
// rendered (feature "source" tags, etc.) so the same class always reads as
// the same color across the app.

import type { CharacterData } from "./types"

interface ClassColor {
  text: string  // Tailwind text-* class
  bg: string    // Tailwind bg-*/opacity class
}

const CLASS_COLORS: Record<string, ClassColor> = {
  barbarian: { text: "text-red-300",     bg: "bg-red-500/15" },
  bard:      { text: "text-pink-300",    bg: "bg-pink-500/15" },
  cleric:    { text: "text-yellow-300",  bg: "bg-yellow-500/15" },
  druid:     { text: "text-green-300",   bg: "bg-green-500/15" },
  fighter:   { text: "text-orange-300",  bg: "bg-orange-500/15" },
  monk:      { text: "text-cyan-300",    bg: "bg-cyan-500/15" },
  paladin:   { text: "text-amber-300",   bg: "bg-amber-400/20" },
  ranger:    { text: "text-emerald-300", bg: "bg-emerald-500/15" },
  rogue:     { text: "text-stone-300",   bg: "bg-stone-500/20" },
  sorcerer:  { text: "text-fuchsia-300", bg: "bg-fuchsia-500/15" },
  warlock:   { text: "text-purple-300",  bg: "bg-purple-500/15" },
  wizard:    { text: "text-blue-300",    bg: "bg-blue-500/15" },
  artificer: { text: "text-teal-300",    bg: "bg-teal-500/15" },
}

const DEFAULT_COLOR: ClassColor = { text: "text-white/50", bg: "bg-white/10" }

// Every known class key, in the fixed order above — used to populate the
// per-class swatch grid in Settings when a character has no matchable class
// of their own yet.
export const CLASS_NAMES = Object.keys(CLASS_COLORS)

export function classLabel(key: string): string {
  // \b\w capitalizes the first letter of each word even when it's preceded
  // by punctuation instead of a space — "fighter (eldritch knight)" needs
  // "Eldritch" capitalized right after the "(", which a plain split(" ")
  // scheme misses.
  return key.replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * Finds a known class key (e.g. "fighter") inside a (often free-text) source
 * string — e.g. "Fighter (Champion)" or "Variant Human, Wizard" both match.
 * Returns undefined when no known class name appears in the source.
 */
export function matchClassKey(source?: string): string | undefined {
  const key = source?.toLowerCase() ?? ""
  return Object.keys(CLASS_COLORS).find(cls => new RegExp(`\\b${cls}\\b`).test(key))
}

/**
 * Returns "bg-* text-*" classes for a class name found inside a (often
 * free-text) source string — e.g. "Fighter (Champion)" or "Variant Human,
 * Wizard" both match. Falls back to a neutral badge when no known class
 * name appears in the source.
 */
export function classColorClasses(source?: string): string {
  const match = matchClassKey(source)
  const color = match ? CLASS_COLORS[match] : DEFAULT_COLOR
  return `${color.bg} ${color.text}`
}

// Which categories to show a color swatch for in Settings' "Separate by
// Class/Subclass" grid. Each DISTINCT Source string written on a Class
// Feature is its own category — same text, same category (case/whitespace-
// insensitive); different text is automatically a new one. That's what
// makes a subclass splittable from its main class: type the subclass's
// features with a different Source (e.g. "Fighter" vs "Fighter (Eldritch
// Knight)") and it gets its own swatch here, no separate "subclass" concept
// needed anywhere else in the app. Falls back to the character's own typed
// class(es), and then to every known class name, in that order, only when
// no Class Features have been written yet, so the control is never empty on
// a freshly-created sheet.
export function deriveCharacterClassNames(data: Pick<CharacterData, "class" | "classes" | "classFeatures">): string[] {
  const fromFeatures = (data.classFeatures ?? [])
    .map(f => f.source?.trim())
    .filter((s): s is string => !!s)
    .map(s => s.toLowerCase())
  if (fromFeatures.length > 0) return [...new Set(fromFeatures)]

  const picked = data.classes && data.classes.length > 0
    ? data.classes.map(c => c.cls)
    : data.class ? data.class.split("/").map(s => s.trim()) : []
  const own = picked.map(c => c.trim().toLowerCase()).filter(Boolean)
  if (own.length > 0) return [...new Set(own)]

  return CLASS_NAMES
}

/**
 * Finds which of Settings' derived categories (see deriveCharacterClassNames
 * — same list "Separate by Class/Subclass" swatches are keyed by) a feature
 * belongs to. Tries an exact match on the feature's own Source text first —
 * this is what makes two differently-worded Sources (e.g. "Fighter" vs
 * "Fighter (Eldritch Knight)") land in two different categories. Falls back
 * to a forgiving substring/word-boundary search for plain class names (e.g.
 * matching "fighter" inside "Fighter (Champion)") — used when ownClasses is
 * still just the character's typed class list because no Class Features
 * have been written yet. Case-insensitive; returns the lowercase key
 * (matching classFeatureColors' keying) or undefined if nothing matches.
 */
export function matchOwnClassKey(source: string | undefined, ownClasses: string[]): string | undefined {
  const s = source?.trim().toLowerCase() ?? ""
  if (!s) return undefined

  const exact = ownClasses.find(cls => cls.trim().toLowerCase() === s)
  if (exact) return exact

  return ownClasses.find(cls => {
    const trimmed = cls.trim().toLowerCase()
    // Only plain alphanumeric/space class names are safe to drop into a
    // RegExp unescaped — a literal Source string (which may contain "(",
    // ")", etc.) that didn't already match exactly above never will here.
    if (!trimmed || /[^a-z0-9 ]/i.test(trimmed)) return false
    try { return new RegExp(`\\b${trimmed}\\b`).test(s) } catch { return false }
  })
}
