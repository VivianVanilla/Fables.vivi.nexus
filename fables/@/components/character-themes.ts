// Class-based visual themes for the character sheet.

export interface Theme {
  label: string
  body: string       // dark mode outer background
  box: string        // dark mode card background
  lightBody: string  // light mode outer background
  lightBox: string   // light mode card background
  ring: string
  header: string
  color: string
  accent: string     // hex for spell slot bars and UI accents
}

export const THEMES: Record<string, Theme> = {
  dark: {
    label: "Dark",
    body: "bg-zinc-950",     box: "bg-zinc-900",     lightBody: "bg-zinc-800",     lightBox: "bg-zinc-700",
    ring: "ring-zinc-700",   header: "bg-zinc-950",  color: "text-white",          accent: "#64748B",
  },
  midnight: {
    label: "Midnight",
    body: "bg-slate-900",    box: "bg-slate-800",    lightBody: "bg-slate-700",    lightBox: "bg-slate-600",
    ring: "ring-slate-700",  header: "bg-slate-900", color: "text-white",          accent: "#94A3B8",
  },
  ash: {
    label: "Ash",
    body: "bg-zinc-800",     box: "bg-zinc-700",     lightBody: "bg-zinc-600",     lightBox: "bg-zinc-500",
    ring: "ring-zinc-600",   header: "bg-zinc-800",  color: "text-white",          accent: "#A1A1AA",
  },
  wizard: {
    label: "Wizard",
    body: "bg-slate-950",    box: "bg-blue-950",     lightBody: "bg-blue-900",     lightBox: "bg-blue-800",
    ring: "ring-blue-900",   header: "bg-slate-950", color: "text-white",          accent: "#3B82F6",
  },
  warlock: {
    label: "Warlock",
    body: "bg-violet-950",   box: "bg-violet-900",   lightBody: "bg-violet-800",   lightBox: "bg-violet-700",
    ring: "ring-violet-800", header: "bg-violet-950",color: "text-white",          accent: "#8B5CF6",
  },
  sorcerer: {
    label: "Sorcerer",
    body: "bg-red-950",      box: "bg-red-900",      lightBody: "bg-red-800",      lightBox: "bg-red-700",
    ring: "ring-red-800",    header: "bg-red-950",   color: "text-white",          accent: "#EF4444",
  },
  druid: {
    label: "Druid",
    body: "bg-emerald-950",  box: "bg-emerald-900",  lightBody: "bg-emerald-800",  lightBox: "bg-emerald-700",
    ring: "ring-emerald-800",header: "bg-emerald-950",color: "text-white",         accent: "#4ADE80",
  },
  cleric: {
    label: "Cleric",
    body: "bg-stone-900",    box: "bg-stone-800",    lightBody: "bg-stone-700",    lightBox: "bg-stone-600",
    ring: "ring-stone-700",  header: "bg-stone-900", color: "text-white",          accent: "#D4AF37",
  },
  bard: {
    label: "Bard",
    body: "bg-fuchsia-950",  box: "bg-fuchsia-900",  lightBody: "bg-fuchsia-800",  lightBox: "bg-fuchsia-700",
    ring: "ring-fuchsia-800",header: "bg-fuchsia-950",color: "text-white",         accent: "#E879F9",
  },
  ranger: {
    label: "Ranger",
    body: "bg-green-950",    box: "bg-green-900",    lightBody: "bg-green-800",    lightBox: "bg-green-700",
    ring: "ring-green-800",  header: "bg-green-950", color: "text-white",          accent: "#22C55E",
  },
  artificer: {
    label: "Artificer",
    body: "bg-amber-950",    box: "bg-stone-900",    lightBody: "bg-amber-800",    lightBox: "bg-stone-700",
    ring: "ring-stone-700",  header: "bg-amber-950", color: "text-white",          accent: "#F59E0B",
  },
  paladin: {
    label: "Paladin",
    body: "bg-amber-950",    box: "bg-amber-900",    lightBody: "bg-amber-800",    lightBox: "bg-amber-700",
    ring: "ring-amber-800",  header: "bg-amber-950", color: "text-white",          accent: "#EAB308",
  },
  witch: {
    label: "Witch",
    body: "bg-teal-950",     box: "bg-teal-900",     lightBody: "bg-teal-800",     lightBox: "bg-teal-700",
    ring: "ring-teal-800",   header: "bg-teal-950",  color: "text-white",          accent: "#14B8A6",
  },
}

export const DEFAULT_THEME = "dark"

// ── Background overrides (body only, independent of card style) ───────────────

export const BG_OPTIONS: Record<string, { label: string; body: string }> = {
  default:  { label: "Theme",   body: "" },
  black:    { label: "Black",   body: "bg-black" },
  zinc950:  { label: "Steel",   body: "bg-zinc-950" },
  zinc900:  { label: "Ash",     body: "bg-zinc-900" },
  slate950: { label: "Night",   body: "bg-slate-950" },
  stone950: { label: "Stone",   body: "bg-stone-950" },
  neutral:  { label: "Warm",    body: "bg-neutral-900" },
}

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
 */
export function slotLevelColor(accent: string, level: number): string {
  if (!accent || !accent.startsWith("#")) return accent ?? "#6B7280"
  const [r, g, b] = hexToRgb(accent)
  const hue = rgbToHue(r, g, b)
  const t   = (level - 1) / 8
  const l   = 68 - t * 53
  return hslToHex(hue, 85, l)
}
