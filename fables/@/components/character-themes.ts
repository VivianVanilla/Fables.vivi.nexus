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
  boxHex: string      // hex equivalent of `box` — lets cosmetic gradients (e.g. FeatureEntry's
  lightBoxHex: string  // "Animated Background" nebula) blend into the real card color instead
                        // of crushing to a fixed near-black, in both dark and light/"Bright" mode
}

export const THEMES: Record<string, Theme> = {
  dark: {
    label: "Dark",
    body: "bg-zinc-950",     box: "bg-zinc-900",     lightBody: "bg-zinc-800",     lightBox: "bg-zinc-700",
    ring: "ring-zinc-700",   header: "bg-zinc-950",  color: "text-white",          accent: "#64748B",
    boxHex: "#18181b",       lightBoxHex: "#3f3f46",
  },
  midnight: {
    label: "Midnight",
    body: "bg-slate-900",    box: "bg-slate-800",    lightBody: "bg-slate-700",    lightBox: "bg-slate-600",
    ring: "ring-slate-700",  header: "bg-slate-900", color: "text-white",          accent: "#94A3B8",
    boxHex: "#1e293b",       lightBoxHex: "#475569",
  },
  ash: {
    label: "Ash",
    body: "bg-zinc-800",     box: "bg-zinc-700",     lightBody: "bg-zinc-600",     lightBox: "bg-zinc-500",
    ring: "ring-zinc-600",   header: "bg-zinc-800",  color: "text-white",          accent: "#A1A1AA",
    boxHex: "#3f3f46",       lightBoxHex: "#71717a",
  },
  wizard: {
    label: "Wizard",
    body: "bg-slate-950",    box: "bg-blue-950",     lightBody: "bg-blue-900",     lightBox: "bg-blue-800",
    ring: "ring-blue-900",   header: "bg-slate-950", color: "text-white",          accent: "#3B82F6",
    boxHex: "#172554",       lightBoxHex: "#1e40af",
  },
  warlock: {
    label: "Warlock",
    body: "bg-violet-950",   box: "bg-violet-900",   lightBody: "bg-violet-800",   lightBox: "bg-violet-700",
    ring: "ring-violet-800", header: "bg-violet-950",color: "text-white",          accent: "#8B5CF6",
    boxHex: "#4c1d95",       lightBoxHex: "#6d28d9",
  },
  sorcerer: {
    label: "Sorcerer",
    body: "bg-red-950",      box: "bg-red-900",      lightBody: "bg-red-800",      lightBox: "bg-red-700",
    ring: "ring-red-800",    header: "bg-red-950",   color: "text-white",          accent: "#EF4444",
    boxHex: "#7f1d1d",       lightBoxHex: "#b91c1c",
  },
  druid: {
    label: "Druid",
    body: "bg-emerald-950",  box: "bg-emerald-900",  lightBody: "bg-emerald-800",  lightBox: "bg-emerald-700",
    ring: "ring-emerald-800",header: "bg-emerald-950",color: "text-white",         accent: "#4ADE80",
    boxHex: "#064e3b",       lightBoxHex: "#047857",
  },
  cleric: {
    label: "Cleric",
    body: "bg-stone-900",    box: "bg-stone-800",    lightBody: "bg-stone-700",    lightBox: "bg-stone-600",
    ring: "ring-stone-700",  header: "bg-stone-900", color: "text-white",          accent: "#D4AF37",
    boxHex: "#292524",       lightBoxHex: "#57534e",
  },
  bard: {
    label: "Bard",
    body: "bg-fuchsia-950",  box: "bg-fuchsia-900",  lightBody: "bg-fuchsia-800",  lightBox: "bg-fuchsia-700",
    ring: "ring-fuchsia-800",header: "bg-fuchsia-950",color: "text-white",         accent: "#E879F9",
    boxHex: "#701a75",       lightBoxHex: "#a21caf",
  },
  ranger: {
    label: "Ranger",
    body: "bg-green-950",    box: "bg-green-900",    lightBody: "bg-green-800",    lightBox: "bg-green-700",
    ring: "ring-green-800",  header: "bg-green-950", color: "text-white",          accent: "#22C55E",
    boxHex: "#14532d",       lightBoxHex: "#15803d",
  },
  artificer: {
    label: "Artificer",
    body: "bg-amber-950",    box: "bg-stone-900",    lightBody: "bg-amber-800",    lightBox: "bg-stone-700",
    ring: "ring-stone-700",  header: "bg-amber-950", color: "text-white",          accent: "#F59E0B",
    boxHex: "#1c1917",       lightBoxHex: "#44403c",
  },
  paladin: {
    label: "Paladin",
    body: "bg-amber-950",    box: "bg-amber-900",    lightBody: "bg-amber-800",    lightBox: "bg-amber-700",
    ring: "ring-amber-800",  header: "bg-amber-950", color: "text-white",          accent: "#EAB308",
    boxHex: "#78350f",       lightBoxHex: "#b45309",
  },
  witch: {
    label: "Witch",
    body: "bg-teal-950",     box: "bg-teal-900",     lightBody: "bg-teal-800",     lightBox: "bg-teal-700",
    ring: "ring-teal-800",   header: "bg-teal-950",  color: "text-white",          accent: "#14B8A6",
    boxHex: "#134e4a",       lightBoxHex: "#0f766e",
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

// "grayscale" desaturates across levels instead of sweeping hue (keeps
// Skapari genuinely black & white); "range" is how far (in degrees) the hue
// sweeps from level 1 to level 9 — narrow for the named presets so Mercury
// stays warm and Stygia stays cool, wide (the ~260° legacy default) for a
// hand-picked Custom color so all 9 levels still read as visually distinct.
export type SlotMode = "hue" | "grayscale"
export interface SlotTheme { label: string; accent: string; mode?: SlotMode; range?: number }

export const SLOT_THEMES: Record<string, SlotTheme> = {
  skapari: { label: "Skapari B&W",  accent: "#CBD5E1", mode: "grayscale" },
  mercury: { label: "Mercury Warm", accent: "#E8A85C", range: 50 },
  stygia:  { label: "Stygia Cool",  accent: "#4FB8D9", range: 50 },
}

export const DEFAULT_SLOT_THEME = "skapari"
export const CUSTOM_SLOT_THEME_KEY = "custom"

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

// Accepts either a plain hex string (legacy — treated as a "hue" theme with
// the full 260° sweep) or a full SlotTheme-shaped object, so existing callers
// that only ever had one fixed accent color don't need to change.
export type SlotAccentInput = string | { accent: string; mode?: SlotMode; range?: number }

function normalizeSlotInput(input: SlotAccentInput): { accent: string; mode?: SlotMode; range?: number } {
  return typeof input === "string" ? { accent: input } : input
}

/**
 * Compute the slot bar color for a given spell level (1–9).
 * Level 1 starts at the theme's exact accent hue, then each higher level
 * sweeps further around the color wheel (`range` degrees total, default 260)
 * so levels read as genuinely different colors rather than just lighter/
 * darker shades of one hue. "grayscale" themes desaturate instead of
 * sweeping hue at all. Lightness only tapers slightly (62% → 50%, or
 * 82% → 22% for grayscale) to keep every level readable.
 */
export function slotLevelColor(input: SlotAccentInput, level: number): string {
  const { accent, mode, range = 260 } = normalizeSlotInput(input)
  if (!accent || !accent.startsWith("#")) return accent ?? "#6B7280"
  const [r, g, b] = hexToRgb(accent)
  const hue = rgbToHue(r, g, b)
  const t   = (level - 1) / 8
  if (mode === "grayscale") return hslToHex(hue, 0, 82 - t * 60)
  const l   = 62 - t * 12
  return hslToHex((hue + t * range) % 360, 80, l)
}

/**
 * Shimmering variant of a single flat accent color — used for "Track uses"
 * bars (FeatureEntry.tsx) once their category's Feature Styling is set to
 * Animated. Unlike slotLevelGradient there's no level to sweep across, so
 * this just cycles lightness around the same hue for a subtle metallic-sheen
 * effect rather than a full rainbow.
 */
export function accentShimmerGradient(hex: string): string {
  if (!hex || !hex.startsWith("#")) return `linear-gradient(90deg, ${hex}, ${hex})`
  const [r, g, b] = hexToRgb(hex)
  const hue = rgbToHue(r, g, b)
  const stops = [38, 52, 68, 52, 38].map(l => hslToHex(hue, 75, l))
  return `linear-gradient(90deg, ${stops.join(", ")})`
}

/**
 * Iridescent variant of slotLevelColor for the "Animated" slot-color tag —
 * a multi-stop gradient centered on the same hue/lightness that level would
 * otherwise render as, so the shimmering CSS animation (see .fables-slot-
 * shimmer in index.css) has something to sweep across.
 */
export function slotLevelGradient(input: SlotAccentInput, level: number): string {
  const { accent, mode, range = 260 } = normalizeSlotInput(input)
  if (!accent || !accent.startsWith("#")) return `linear-gradient(90deg, ${accent}, ${accent})`
  const [r, g, b] = hexToRgb(accent)
  const hue = rgbToHue(r, g, b)
  const t   = (level - 1) / 8
  if (mode === "grayscale") {
    const base = 82 - t * 60
    const stops = [-30, -15, 0, 15, 30].map(o => hslToHex(hue, 0, Math.max(8, Math.min(92, base + o))))
    return `linear-gradient(90deg, ${stops.join(", ")})`
  }
  const l = 62 - t * 12
  const baseHue = hue + t * range
  const stops = [-40, -20, 0, 20, 40].map(o => hslToHex((baseHue + o + 360) % 360, 85, l))
  return `linear-gradient(90deg, ${stops.join(", ")})`
}
