// Class-based visual themes for the character sheet.

export interface Theme {
  label: string
  body: string   // outer background
  box: string    // card background
  ring: string
  header: string
  color: string
  accent: string  // hex for spell slot bars and UI accents
  boxHex: string  // hex equivalent of `box` — lets cosmetic gradients (e.g. FeatureEntry's
                   // "Animated Background" nebula) blend into the real card color instead
                   // of crushing to a fixed near-black
}

// key of the Card Style / Background entry whose colors are picked by the
// user via <input type="color"> instead of a fixed swatch — see SettingsModal.tsx
export const CUSTOM_THEME_KEY = "custom"

export const THEMES: Record<string, Theme> = {
  dark: {
    label: "Dark",
    body: "bg-zinc-950",   box: "bg-zinc-900",
    ring: "ring-zinc-700", header: "bg-zinc-950", color: "text-white", accent: "#64748B",
    boxHex: "#18181b",
  },
  white: {
    label: "White",
    body: "bg-zinc-700",   box: "bg-zinc-600",
    ring: "ring-zinc-400", header: "bg-zinc-700", color: "text-white", accent: "#E4E4E7",
    boxHex: "#52525b",
  },
  sorcerer: {
    label: "Sorcerer Red",
    body: "bg-red-950",    box: "bg-red-900",
    ring: "ring-red-800",  header: "bg-red-950",  color: "text-white", accent: "#EF4444",
    boxHex: "#7f1d1d",
  },
  wizard: {
    label: "Wizard Blue",
    body: "bg-blue-950",   box: "bg-blue-800",
    ring: "ring-blue-600", header: "bg-blue-950", color: "text-white", accent: "#60A5FA",
    boxHex: "#1e40af",
  },
  [CUSTOM_THEME_KEY]: {
    label: "Custom",
    // resolved from CharacterData.themeCustomColor at render time (see character.tsx),
    // which sets --theme-custom-box/--theme-custom-body on the sheet's root element
    body: "bg-[var(--theme-custom-body)]", box: "bg-[var(--theme-custom-box)]",
    ring: "ring-white/20", header: "bg-[var(--theme-custom-body)]", color: "text-white", accent: "#8b5cf6",
    boxHex: "#3f3f46",
  },
}

export const DEFAULT_THEME = "dark"

// ── Background overrides (body only, independent of card style) ───────────────

export const DEFAULT_BG_THEME = "dark"

export const BG_OPTIONS: Record<string, { label: string; body: string }> = {
  dark:     { label: "Dark",         body: "bg-zinc-950" },
  white:    { label: "White",        body: "bg-zinc-700" },
  sorcerer: { label: "Sorcerer Red", body: "bg-red-950" },
  wizard:   { label: "Wizard Blue",  body: "bg-blue-950" },
  [CUSTOM_THEME_KEY]: { label: "Custom", body: "bg-[var(--bg-custom-color)]" },
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

// Darkens a hex color toward black by `amt` (0–1) — used to derive the
// Custom theme's outer background from the single color the user picks for
// the card, so it keeps the same body/box depth every fixed theme has.
export function darkenHex(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex)
  const mix = (c: number) => Math.max(0, Math.min(255, Math.round(c * (1 - amt)))).toString(16).padStart(2, "0")
  return `#${mix(r)}${mix(g)}${mix(b)}`
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
