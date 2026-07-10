// Shared color mapping for D&D classes — used anywhere a class badge is
// rendered (feature "source" tags, etc.) so the same class always reads as
// the same color across the app.

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

/**
 * Returns "bg-* text-*" classes for a class name found inside a (often
 * free-text) source string — e.g. "Fighter (Champion)" or "Variant Human,
 * Wizard" both match. Falls back to a neutral badge when no known class
 * name appears in the source.
 */
export function classColorClasses(source?: string): string {
  const key = source?.toLowerCase() ?? ""
  const match = Object.keys(CLASS_COLORS).find(cls => new RegExp(`\\b${cls}\\b`).test(key))
  const color = match ? CLASS_COLORS[match] : DEFAULT_COLOR
  return `${color.bg} ${color.text}`
}
