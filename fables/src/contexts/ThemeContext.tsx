// ════════════════════════════════════════════════════════════════════════════
// ThemeContext.tsx — global app theme (sidebar, notes, documentation, and
// everything else outside the character sheet, which already has its own
// per-class theming — see @/components/character-themes.ts).
//
// Applies a `data-app-theme` attribute on <html>; the actual color values
// live in src/index.css as overrides of the same shadcn CSS variables
// (--background, --sidebar, --card, --border, etc.) the app already uses,
// so anything already styled with the semantic bg-background/bg-sidebar/
// bg-card classes re-themes for free. The "custom" theme is the one
// exception — its CSS reads a single `--app-custom-color` variable (set here
// from the color wheel picker) via color-mix(), instead of fixed hex values.
//
// Persisted twice: localStorage for an instant, offline-friendly first paint,
// and Supabase auth's user_metadata (via supabase.auth.updateUser) so the
// choice follows you across devices — no new table/RLS needed, it rides
// along on the same auth user object supabase.auth.getUser() already returns.
// ════════════════════════════════════════════════════════════════════════════

import React, { createContext, useContext, useEffect, useState } from "react"
import { supabase } from "../supabase"

export type AppTheme =
  | "abyss" | "midnight" | "light" | "trippy" | "vaporwave" | "synthwave" | "gold"
  | "eightbit" | "bubblegum" | "custom"

export const APP_THEMES: { id: AppTheme; label: string; swatch: string }[] = [
  { id: "abyss",      label: "Abyss",        swatch: "#000000" },
  { id: "midnight",   label: "Dark Blue",    swatch: "#0b1220" },
  { id: "light",      label: "Light",        swatch: "#f8fafc" },
  { id: "trippy",     label: "Trippy",       swatch: "linear-gradient(90deg, #ff00cc, #00ffea, #fffb00, #ff00cc)" },
  { id: "vaporwave",  label: "Vaporwave",    swatch: "linear-gradient(90deg, #ff71ce, #b967ff, #01cdfe)" },
  { id: "synthwave",  label: "Synthwave",    swatch: "linear-gradient(90deg, #ff2079, #ff8c42, #7b2ff7)" },
  { id: "gold",       label: "High Roller",  swatch: "linear-gradient(90deg, #1a1400, #d4af37, #1a1400)" },
  { id: "eightbit",   label: "8-Bit",        swatch: "linear-gradient(90deg, #0f0f1a, #38b764, #0f0f1a)" },
  { id: "bubblegum",  label: "Bubblegum",    swatch: "linear-gradient(90deg, #ff9ecd, #a0e7ff, #ff9ecd)" },
  { id: "custom",     label: "Custom",       swatch: "conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)" },
]

const STORAGE_KEY        = "fables-app-theme"
const CUSTOM_COLOR_KEY   = "fables-app-theme-custom-color"
const DEFAULT_THEME: AppTheme = "midnight"
const DEFAULT_CUSTOM_COLOR = "#8b5cf6"

interface ThemeContextType {
  theme: AppTheme
  setTheme: (t: AppTheme) => void
  customColor: string
  setCustomColor: (c: string) => void
}

const ThemeContext = createContext<ThemeContextType | null>(null)

function isAppTheme(v: unknown): v is AppTheme {
  return APP_THEMES.some(t => t.id === v)
}

function readStoredTheme(): AppTheme {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (isAppTheme(raw)) return raw
  } catch { /* ignore */ }
  return DEFAULT_THEME
}

function readStoredCustomColor(): string {
  try {
    const raw = localStorage.getItem(CUSTOM_COLOR_KEY)
    if (raw && /^#[0-9a-fA-F]{6}$/.test(raw)) return raw
  } catch { /* ignore */ }
  return DEFAULT_CUSTOM_COLOR
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>(readStoredTheme)
  const [customColor, setCustomColorState] = useState<string>(readStoredCustomColor)

  useEffect(() => {
    document.documentElement.setAttribute("data-app-theme", theme)
  }, [theme])

  // Drives the custom theme's whole palette via color-mix() in index.css —
  // see [data-app-theme="custom"]. Kept set at all times (not just while the
  // custom theme is active) so switching to it never shows a stale color.
  useEffect(() => {
    document.documentElement.style.setProperty("--app-custom-color", customColor)
  }, [customColor])

  // Once we know who's logged in, prefer the theme saved on their account —
  // this is what actually makes it follow you across devices instead of
  // being stuck per-browser in localStorage.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const remote = data.user?.user_metadata?.app_theme
      if (isAppTheme(remote)) {
        setThemeState(remote)
        try { localStorage.setItem(STORAGE_KEY, remote) } catch { /* ignore */ }
      }
      const remoteColor = data.user?.user_metadata?.app_theme_custom_color
      if (typeof remoteColor === "string" && /^#[0-9a-fA-F]{6}$/.test(remoteColor)) {
        setCustomColorState(remoteColor)
        try { localStorage.setItem(CUSTOM_COLOR_KEY, remoteColor) } catch { /* ignore */ }
      }
    }).catch(() => { /* not logged in yet / offline — local theme stands */ })
  }, [])

  function setTheme(t: AppTheme) {
    setThemeState(t)
    try { localStorage.setItem(STORAGE_KEY, t) } catch { /* ignore */ }
    supabase.auth.updateUser({ data: { app_theme: t } })
      .catch(e => console.error("Failed to sync theme to account:", e))
  }

  function setCustomColor(c: string) {
    setCustomColorState(c)
    try { localStorage.setItem(CUSTOM_COLOR_KEY, c) } catch { /* ignore */ }
    supabase.auth.updateUser({ data: { app_theme_custom_color: c } })
      .catch(e => console.error("Failed to sync custom theme color to account:", e))
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, customColor, setCustomColor }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useAppTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error("useAppTheme must be used within ThemeProvider")
  return context
}
