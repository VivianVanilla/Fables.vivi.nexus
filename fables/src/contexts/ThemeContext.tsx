// ════════════════════════════════════════════════════════════════════════════
// ThemeContext.tsx — global app theme (sidebar, notes, documentation, and
// everything else outside the character sheet, which already has its own
// per-class theming — see @/components/character-themes.ts).
//
// Applies a `data-app-theme` attribute on <html>; the actual color values
// live in src/index.css as overrides of the same shadcn CSS variables
// (--background, --sidebar, --card, --border, etc.) the app already uses,
// so anything already styled with the semantic bg-background/bg-sidebar/
// bg-card classes re-themes for free.
//
// Persisted twice: localStorage for an instant, offline-friendly first paint,
// and Supabase auth's user_metadata (via supabase.auth.updateUser) so the
// choice follows you across devices — no new table/RLS needed, it rides
// along on the same auth user object supabase.auth.getUser() already returns.
// ════════════════════════════════════════════════════════════════════════════

import React, { createContext, useContext, useEffect, useState } from "react"
import { supabase } from "../supabase"

export type AppTheme =
  | "abyss" | "midnight" | "light" | "rainbow" | "trippy" | "vaporwave" | "synthwave" | "gold" | "toxic"
  | "eightbit" | "flashlight" | "disco" | "matrix" | "bubblegum"

// Free themes are always selectable. Everything past "rainbow" is locked
// behind gamVIVIling (see @/components/gambling) — gating happens in
// profile-settings-modal.tsx, not here.
export const FREE_THEMES: AppTheme[] = ["abyss", "midnight", "light", "rainbow"]

export const APP_THEMES: { id: AppTheme; label: string; swatch: string }[] = [
  { id: "abyss",      label: "Abyss",        swatch: "#000000" },
  { id: "midnight",   label: "Dark Blue",    swatch: "#0b1220" },
  { id: "light",      label: "Light",        swatch: "#f8fafc" },
  { id: "rainbow",    label: "Rainbow",      swatch: "linear-gradient(90deg, #ff0000, #ff9900, #33cc33, #0066ff, #9900cc)" },
  { id: "trippy",     label: "Trippy",       swatch: "linear-gradient(90deg, #ff00cc, #00ffea, #fffb00, #ff00cc)" },
  { id: "vaporwave",  label: "Vaporwave",    swatch: "linear-gradient(90deg, #ff71ce, #b967ff, #01cdfe)" },
  { id: "synthwave",  label: "Synthwave",    swatch: "linear-gradient(90deg, #ff2079, #ff8c42, #7b2ff7)" },
  { id: "gold",       label: "High Roller",  swatch: "linear-gradient(90deg, #1a1400, #d4af37, #1a1400)" },
  { id: "toxic",      label: "Toxic",        swatch: "linear-gradient(90deg, #0a1a00, #aaff00, #0a1a00)" },
  { id: "eightbit",   label: "8-Bit",        swatch: "linear-gradient(90deg, #0f0f1a, #38b764, #0f0f1a)" },
  { id: "flashlight", label: "Flashlight",   swatch: "radial-gradient(circle, #ffffff 0%, #000000 75%)" },
  { id: "disco",      label: "Disco",        swatch: "linear-gradient(90deg, #ff2ec4, #ffd23f, #2ec4ff, #ff2ec4)" },
  { id: "matrix",     label: "Matrix",       swatch: "linear-gradient(90deg, #000000, #00ff41, #000000)" },
  { id: "bubblegum",  label: "Bubblegum",    swatch: "linear-gradient(90deg, #ff9ecd, #a0e7ff, #ff9ecd)" },
]

const STORAGE_KEY = "fables-app-theme"
const DEFAULT_THEME: AppTheme = "midnight"

interface ThemeContextType {
  theme: AppTheme
  setTheme: (t: AppTheme) => void
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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>(readStoredTheme)

  useEffect(() => {
    document.documentElement.setAttribute("data-app-theme", theme)
  }, [theme])

  // Flashlight theme blacks out the whole page except a circle around the
  // cursor (see [data-app-theme="flashlight"] in index.css, which paints
  // that circle as a radial-gradient hole centered on these two CSS vars).
  // Only tracks the mouse while the theme is actually active.
  useEffect(() => {
    if (theme !== "flashlight") return
    function onMove(e: MouseEvent) {
      document.documentElement.style.setProperty("--flashlight-x", `${e.clientX}px`)
      document.documentElement.style.setProperty("--flashlight-y", `${e.clientY}px`)
    }
    window.addEventListener("mousemove", onMove)
    return () => window.removeEventListener("mousemove", onMove)
  }, [theme])

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
    }).catch(() => { /* not logged in yet / offline — local theme stands */ })
  }, [])

  function setTheme(t: AppTheme) {
    setThemeState(t)
    try { localStorage.setItem(STORAGE_KEY, t) } catch { /* ignore */ }
    supabase.auth.updateUser({ data: { app_theme: t } })
      .catch(e => console.error("Failed to sync theme to account:", e))
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}

export function useAppTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error("useAppTheme must be used within ThemeProvider")
  return context
}
