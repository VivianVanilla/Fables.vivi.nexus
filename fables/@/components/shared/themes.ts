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

// ── Background image (a separate layer on top of the Background color above,
//    behind ALL sheet content — see CharacterSheet.tsx's root render and
//    Settings' "Background Image" row) ──────────────────────────────────────

export interface BgImageTheme {
  label: string
  backgroundImage: string
  backgroundSize: string
  backgroundRepeat: string
}

// Built-in presets are computed CSS patterns, not photos — no real image
// asset to host/ship. "custom" (CharacterData.bgImageCustomUrl) is where an
// actual uploaded photo comes in instead; these live side by side in
// Settings' preset grid. Every entry here is deliberately just ONE size/
// repeat VALUE (not one per background-image layer) — it cycles across
// however many layers the image has, so any of these can gain/lose layers
// later without re-counting entries to match, the mistake that broke this
// feature twice before (Window mode also forces a uniform cover/no-repeat/
// fixed over whatever's defined here anyway — see CharacterSheet.tsx).
export const BG_IMAGE_THEMES: Record<string, BgImageTheme> = {
  voidCorruption: {
    label: "Void Corruption",
    // Second pass added color but the wrong kind — toxic green reads as
    // poison/plague, not void. "Void" is emptiness/a black hole pulling
    // everything into it, so this drops green (and red) entirely for a
    // monochrome black-to-violet palette: a "singularity" glow near the
    // top (a dark event-horizon center that only gets to be violet at its
    // very edge, black at its core — an absence with a rim of light around
    // it, not a glowing ball), a couple of wispy indigo blooms lower down,
    // and the same two fracture lines recolored to match.
    backgroundImage: [
      // Film-grain texture on top of the color, via an inline SVG
      // feTurbulence/feColorMatrix filter (the classic grain-noise
      // technique) encoded as a data URI — this is what actually makes it
      // feel like something rather than a few smooth gradient blobs.
      // feColorMatrix zeroes the RGB channels and keeps only alpha driven
      // by the noise, so it's pure grain, no color of its own — it just
      // roughens whatever's layered underneath.
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.35 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      "radial-gradient(circle at 50% 38%, transparent 0%, transparent 18%, rgba(88,28,135,0.4) 30%, transparent 42%)",
      "radial-gradient(ellipse at 15% 82%, rgba(49,10,101,0.32), transparent 50%)",
      "radial-gradient(ellipse at 88% 75%, rgba(30,8,60,0.28), transparent 45%)",
      "linear-gradient(105deg, transparent 48.5%, rgba(88,28,135,0.4) 49.5%, transparent 50.5%)",
      "linear-gradient(35deg, transparent 68%, rgba(49,10,101,0.32) 69%, transparent 70%)",
      "radial-gradient(circle, #000000, #000000)",
    ].join(", "),
    backgroundSize: "cover",
    backgroundRepeat: "no-repeat",
  },
  galaxy: {
    label: "Galaxy",
    // The colorful wash that used to be Nebula Wash, now paired with a
    // hand-placed scatter of stars (fixed positions, not a repeating
    // tile — Window mode's forced "cover" sizing would just blow up a
    // small repeating tile into one giant soft blob instead of a field of
    // points, so this needed placing individually rather than tiled).
    // Solid core fading out over just the last 10% of a 1.5-2px radius
    // (tried first) reads as a hard, glaring little dot rather than a
    // twinkle — especially the one or two that happen to land somewhere
    // more central/visible than the rest. A much longer soft falloff (and
    // toned-down peak opacity) gives an actual soft glow instead.
    backgroundImage: [
      "radial-gradient(circle 1.8px at 12% 18%, rgba(255,255,255,0.75) 14%, transparent 85%)",
      "radial-gradient(circle 1.5px at 28% 42%, rgba(255,255,255,0.65) 14%, transparent 85%)",
      "radial-gradient(circle 1.8px at 55% 12%, rgba(255,255,255,0.75) 14%, transparent 85%)",
      "radial-gradient(circle 1.5px at 72% 30%, rgba(255,255,255,0.65) 14%, transparent 85%)",
      "radial-gradient(circle 1.8px at 88% 55%, rgba(255,255,255,0.75) 14%, transparent 85%)",
      "radial-gradient(circle 1.5px at 15% 68%, rgba(255,255,255,0.65) 14%, transparent 85%)",
      "radial-gradient(circle 1.8px at 42% 80%, rgba(255,255,255,0.75) 14%, transparent 85%)",
      "radial-gradient(circle 1.5px at 65% 90%, rgba(255,255,255,0.65) 14%, transparent 85%)",
      "radial-gradient(circle 1.5px at 92% 82%, rgba(255,255,255,0.65) 14%, transparent 85%)",
      "radial-gradient(circle 1.5px at 8% 92%, rgba(255,255,255,0.65) 14%, transparent 85%)",
      "radial-gradient(ellipse at 20% 20%, rgba(139,92,246,0.6), transparent 52%)",
      "radial-gradient(ellipse at 80% 70%, rgba(59,130,246,0.55), transparent 58%)",
      "radial-gradient(ellipse at 50% 100%, rgba(236,72,153,0.5), transparent 62%)",
      "radial-gradient(circle, #14121f, #14121f)",
    ].join(", "),
    backgroundSize: "cover",
    backgroundRepeat: "no-repeat",
  },
}

export const CUSTOM_BG_IMAGE_KEY = "custom"
export const DEFAULT_BG_IMAGE_OPACITY = 40

// ── Slot bar color palette (independent of background theme) ──────────────────

// "grayscale" desaturates across levels instead of sweeping hue (keeps
// Skapari genuinely black & white); "solid" is the exact same color at
// every level, full stop — the Settings override that turns any preset (or
// Custom) into one flat color instead of always sweeping something across
// levels; "range" is how far (in degrees) the hue sweeps from level 1 to
// level 9 — narrow for the named presets so Mercury stays warm and Stygia
// stays cool, wide (the ~260° legacy default) for a hand-picked Custom
// color so all 9 levels still read as visually distinct. A negative range
// sweeps the other way around the wheel (Settings' "Hue −" override).
export type SlotMode = "hue" | "grayscale" | "solid"
export interface SlotTheme { label: string; accent: string; mode?: SlotMode; range?: number }

export const SLOT_THEMES: Record<string, SlotTheme> = {
  skapari: { label: "Skapari B&W",  accent: "#CBD5E1", mode: "grayscale" },
  mercury: { label: "Mercury Warm", accent: "#E8A85C", range: 50 },
  stygia:  { label: "Stygia Cool",  accent: "#4FB8D9", range: 50 },
}

export const DEFAULT_SLOT_THEME = "skapari"
export const CUSTOM_SLOT_THEME_KEY = "custom"

// ── Color utilities ────────────────────────────────────────────────────────────

export function hexToRgb(hex: string): [number, number, number] {
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

// Full hue/saturation/lightness — unlike rgbToHue above (which slotLevelColor/
// slotLevelGradient used to rely on alone), this keeps the picked color's
// actual saturation and lightness instead of discarding them, so a
// deliberately dark or muted custom pick reads as dark/muted through the
// whole level sweep instead of always snapping to a fixed vibrant, medium-
// bright palette regardless of what was actually chosen.
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r,g,b), min = Math.min(r,g,b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l * 100]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  switch (max) {
    case r: h = ((g-b)/d + (g < b ? 6 : 0)) / 6; break
    case g: h = ((b-r)/d + 2) / 6; break
    case b: h = ((r-g)/d + 4) / 6; break
  }
  return [h * 360, s * 100, l * 100]
}

// Wraps a hue angle into [0, 360) — needed once `range` can be negative
// (Settings' "Hue −" override): JS's `%` keeps the sign of its left operand,
// so a negative sweep can otherwise hand hslToHex a negative hue, which its
// piecewise formula doesn't handle correctly.
function normHue(h: number): number {
  return ((h % 360) + 360) % 360
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
 * Level 1 starts at the theme's exact accent color — its own saturation and
 * lightness, not a forced-vibrant reinterpretation of just its hue, so a
 * deliberately dark or muted custom pick actually looks dark/muted — then
 * each higher level sweeps further around the color wheel (`range` degrees
 * total, default 260) so levels read as genuinely different colors rather
 * than just lighter/darker shades of one hue. "grayscale" themes desaturate
 * instead of sweeping hue at all. Lightness only tapers slightly across
 * levels (clamped to a legible 15–88% band either way) to keep every level
 * readable without erasing how light or dark the chosen color actually was.
 */
export function slotLevelColor(input: SlotAccentInput, level: number): string {
  const { accent, mode, range = 260 } = normalizeSlotInput(input)
  if (!accent || !accent.startsWith("#")) return accent ?? "#6B7280"
  if (mode === "solid") return accent
  const [r, g, b] = hexToRgb(accent)
  const [hue, sat, lightness] = rgbToHsl(r, g, b)
  const t = (level - 1) / 8
  const baseL = Math.max(15, Math.min(88, lightness))
  if (mode === "grayscale") return hslToHex(hue, 0, baseL - t * 45)
  return hslToHex(normHue(hue + t * range), sat, Math.max(10, baseL - t * 12))
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
  const [hue, sat, lightness] = rgbToHsl(r, g, b)
  const t = (level - 1) / 8
  const baseL = Math.max(15, Math.min(88, lightness))
  if (mode === "solid") {
    // Same hue/saturation at every level (that's the point of "solid") — the
    // shimmer instead cycles lightness only, the same metallic-sheen trick
    // accentShimmerGradient uses for a single flat color.
    const stops = [-14, -7, 0, 7, 14].map(o => hslToHex(hue, sat, Math.max(8, Math.min(92, baseL + o))))
    return `linear-gradient(90deg, ${stops.join(", ")})`
  }
  if (mode === "grayscale") {
    const base = baseL - t * 45
    const stops = [-30, -15, 0, 15, 30].map(o => hslToHex(hue, 0, Math.max(8, Math.min(92, base + o))))
    return `linear-gradient(90deg, ${stops.join(", ")})`
  }
  const l = Math.max(10, baseL - t * 12)
  const baseHue = normHue(hue + t * range)
  const stops = [-40, -20, 0, 20, 40].map(o => hslToHex(normHue(baseHue + o), sat, Math.max(8, Math.min(92, l + o))))
  return `linear-gradient(90deg, ${stops.join(", ")})`
}
