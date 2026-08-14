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
  return key.charAt(0).toUpperCase() + key.slice(1)
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

// Which classes to show a color swatch for in Settings' "Separate color per
// class" grid — prefers the character's actual class(es) (single-class or
// multiclass), falls back to whatever class names appear in their Class
// Features list, and finally lists every known class so the control is never
// empty on a freshly-created sheet.
export function deriveCharacterClassNames(data: Pick<CharacterData, "class" | "classes" | "classFeatures">): string[] {
  const picked = data.classes && data.classes.length > 0
    ? data.classes.map(c => c.cls)
    : data.class ? data.class.split("/").map(s => s.trim()) : []
  const matched = picked.map(matchClassKey).filter((k): k is string => !!k)
  if (matched.length > 0) return [...new Set(matched)]

  const fromFeatures = (data.classFeatures ?? []).map(f => matchClassKey(f.source)).filter((k): k is string => !!k)
  if (fromFeatures.length > 0) return [...new Set(fromFeatures)]

  return CLASS_NAMES
}
