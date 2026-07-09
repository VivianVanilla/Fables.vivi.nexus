// ════════════════════════════════════════════════════════════════════════════
// NavigationContext.tsx — lets a `[[Note Name]]` link deep inside a note's
// Markdown (character sheet, standalone note view, note web viewer) jump to
// another object without threading a callback through every layer between
// it and Dashboard, which owns the actual "what's currently open" state.
// ════════════════════════════════════════════════════════════════════════════

import { createContext, useContext } from "react"

interface NavigationContextType {
  openObjectId: (id: string) => void
}

const NavigationContext = createContext<NavigationContextType | null>(null)

export function NavigationProvider({ openObjectId, children }: { openObjectId: (id: string) => void; children: React.ReactNode }) {
  return <NavigationContext.Provider value={{ openObjectId }}>{children}</NavigationContext.Provider>
}

export function useNavigation() {
  const context = useContext(NavigationContext)
  if (!context) throw new Error("useNavigation must be used within NavigationProvider")
  return context
}
