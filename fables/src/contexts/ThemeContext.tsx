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

export type AppTheme = "abyss" | "midnight" | "light" | "rainbow"

export const APP_THEMES: { id: AppTheme; label: string; swatch: string }[] = [
  { id: "abyss",    label: "Abyss",        swatch: "#000000" },
  { id: "midnight", label: "Dark Blue",    swatch: "#0b1220" },
  { id: "light",    label: "Light",        swatch: "#f8fafc" },
  { id: "rainbow",  label: "Rainbow",      swatch: "linear-gradient(90deg, #ff0000, #ff9900, #33cc33, #0066ff, #9900cc)" },
]

const STORAGE_KEY = "fables-app-theme"
const DEFAULT_THEME: AppTheme = "midnight"

interface ThemeContextType {
  theme: AppTheme
  setTheme: (t: AppTheme) => void
}

const ThemeContext = createContext<ThemeContextType | null>(null)

function isAppTheme(v: unknown): v is AppTheme {
  return v === "abyss" || v === "midnight" || v === "light" || v === "rainbow"
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
