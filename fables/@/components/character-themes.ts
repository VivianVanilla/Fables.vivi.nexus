// Visual theme definitions for the character sheet.
// Each theme provides Tailwind class names for background/border areas.

export interface Theme {
  label: string
  body: string    // outer body background
  box: string     // individual card/box background
  ring: string    // card border ring color
  header: string  // header strip background
  color: string   // text color
}

export const THEMES: Record<string, Theme> = {
  dark: {
    label: "Dark",
    body: "bg-slate-900",
    box: "bg-slate-800",
    ring: "ring-slate-700",
    header: "bg-slate-900",
    color: "text-white",
  },
  green: {
    label: "Green",
    body: "bg-olive-900",
    box: "bg-olive-800",
    ring: "ring-olive-700",
    header: "bg-olive-900",
    color: "text-white",
  },
  blue: {
    label: "Blue",
    body: "bg-blue-900",
    box: "bg-blue-800",
    ring: "ring-blue-700",
    header: "bg-blue-900",
    color: "text-white",
  },
  purple: {
    label: "Purple",
    body: "bg-purple-900",
    box: "bg-purple-800",
    ring: "ring-purple-700",
    header: "bg-purple-900",
    color: "text-white",
  },
  red: {
    label: "Red",
    body: "bg-rose-950",
    box: "bg-pink-950",
    ring: "ring-pink-700",
    header: "bg-pink-900",
    color: "text-white",
  },
  black: {
    label: "Black",
    body: "bg-zinc-950",
    box: "bg-zinc-900",
    ring: "ring-zinc-800",
    header: "bg-zinc-950",
    color: "text-white",
  },
}

export const DEFAULT_THEME = "dark"
