// Class-based visual themes for the character sheet.
// Backgrounds are kept near-neutral dark so the sheet is easy on the eyes;
// the accent hex color provides class identity through spell slot bars and borders.

export interface Theme {
  label: string
  body: string     // outer body background
  box: string      // individual card/box background
  ring: string     // card border ring color
  header: string   // header strip background
  color: string    // text color
  accent: string   // hex color for spell slot bars and UI accents
}

export const THEMES: Record<string, Theme> = {
  dark: {
    label: "Dark",
    body: "bg-zinc-950", box: "bg-zinc-900", ring: "ring-zinc-700",
    header: "bg-zinc-950", color: "text-white", accent: "#64748B",
  },
  wizard: {
    label: "Wizard",
    body: "bg-zinc-950", box: "bg-blue-950", ring: "ring-blue-900",
    header: "bg-zinc-950", color: "text-white", accent: "#3B82F6",
  },
  warlock: {
    label: "Warlock",
    body: "bg-zinc-950", box: "bg-violet-950", ring: "ring-violet-900",
    header: "bg-zinc-950", color: "text-white", accent: "#8B5CF6",
  },
  sorcerer: {
    label: "Sorcerer",
    body: "bg-zinc-950", box: "bg-red-950", ring: "ring-red-900",
    header: "bg-zinc-950", color: "text-white", accent: "#EF4444",
  },
  druid: {
    label: "Druid",
    body: "bg-zinc-950", box: "bg-emerald-950", ring: "ring-emerald-900",
    header: "bg-zinc-950", color: "text-white", accent: "#4ADE80",
  },
  cleric: {
    label: "Cleric",
    body: "bg-zinc-950", box: "bg-neutral-900", ring: "ring-neutral-700",
    header: "bg-zinc-950", color: "text-white", accent: "#D4AF37",
  },
  bard: {
    label: "Bard",
    body: "bg-zinc-950", box: "bg-fuchsia-950", ring: "ring-fuchsia-900",
    header: "bg-zinc-950", color: "text-white", accent: "#E879F9",
  },
  ranger: {
    label: "Ranger",
    body: "bg-zinc-950", box: "bg-green-950", ring: "ring-green-900",
    header: "bg-zinc-950", color: "text-white", accent: "#22C55E",
  },
  artificer: {
    label: "Artificer",
    body: "bg-zinc-950", box: "bg-stone-900", ring: "ring-stone-700",
    header: "bg-zinc-950", color: "text-white", accent: "#F59E0B",
  },
  paladin: {
    label: "Paladin",
    body: "bg-zinc-950", box: "bg-amber-950", ring: "ring-amber-900",
    header: "bg-zinc-950", color: "text-white", accent: "#EAB308",
  },
  witch: {
    label: "Witch",
    body: "bg-zinc-950", box: "bg-teal-950", ring: "ring-teal-900",
    header: "bg-zinc-950", color: "text-white", accent: "#14B8A6",
  },
}

export const DEFAULT_THEME = "dark"

// ── Slot bar color palette (independent of background theme) ──────────────────

export interface SlotTheme { label: string; accent: string }

export const SLOT_THEMES: Record<string, SlotTheme> = {
  wizard:    { label: "Wizard",    accent: "#3B82F6" },
  warlock:   { label: "Warlock",   accent: "#8B5CF6" },
  sorcerer:  { label: "Sorcerer",  accent: "#EF4444" },
  druid:     { label: "Druid",     accent: "#4ADE80" },
  cleric:    { label: "Cleric",    accent: "#D4AF37" },
  bard:      { label: "Bard",      accent: "#E879F9" },
  ranger:    { label: "Ranger",    accent: "#22C55E" },
  artificer: { label: "Artificer", accent: "#F59E0B" },
  paladin:   { label: "Paladin",   accent: "#EAB308" },
  witch:     { label: "Witch",     accent: "#14B8A6" },
  neutral:   { label: "Neutral",   accent: "#64748B" },
}

export const DEFAULT_SLOT_THEME = "neutral"

// ── Color utilities ────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "")
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)]
}

function rgbToHue(r: number, g: number, b: number): number {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min
  if (d === 0) return 0
  let h = 0
  switch (max) {
    case r: h = ((g-b)/d + (g < b ? 6 : 0)) / 6; break
    case g: h = ((b-r)/d + 2) / 6; break
    case b: h = ((r-g)/d + 4) / 6; break
  }
  return h * 360
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return Math.round(255 * (l - a * Math.max(Math.min(k-3, 9-k, 1), -1))).toString(16).padStart(2,"0")
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/**
 * Compute the slot bar color for a given spell level (1–9).
 * Keeps the accent hue exact, fixes saturation at 85%, and sweeps lightness
 * from 68% (level 1, bright & vivid) down to 15% (level 9, deep & rich).
 * Each step is ~6.6 L points — very noticeable between adjacent levels.
 */
export function slotLevelColor(accent: string, level: number): string {
  if (!accent || !accent.startsWith("#")) return accent ?? "#6B7280"
  const [r, g, b] = hexToRgb(accent)
  const hue = rgbToHue(r, g, b)
  const t   = (level - 1) / 8            // 0 at level 1 → 1 at level 9
  const l   = 68 - t * 53               // 68% → 15%
  return hslToHex(hue, 85, l)
}
