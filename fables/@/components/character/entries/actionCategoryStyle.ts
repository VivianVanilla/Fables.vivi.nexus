// Shared color scheme for MonsterAction categories — split out of
// ActionEntry.tsx so that file can export only the component (fast-refresh
// wants files to export components only, not a component plus a constant).

import type { ActionCategory } from "../../monster-types"

export const CATEGORY_STYLE: Record<ActionCategory, { border: string; text: string; badge: string; ring: string }> = {
  trait:       { border: "border-emerald-500/30", text: "text-emerald-300", badge: "bg-emerald-500/15 text-emerald-300", ring: "focus:ring-emerald-400/40" },
  action:      { border: "border-sky-500/30",    text: "text-sky-300",    badge: "bg-sky-500/15 text-sky-300",    ring: "focus:ring-sky-400/40" },
  bonusAction: { border: "border-amber-500/30",   text: "text-amber-300", badge: "bg-amber-500/15 text-amber-300", ring: "focus:ring-amber-400/40" },
  reaction:    { border: "border-violet-500/30",  text: "text-violet-300",badge: "bg-violet-500/15 text-violet-300", ring: "focus:ring-violet-400/40" },
  legendary:   { border: "border-yellow-400/30",  text: "text-yellow-300",badge: "bg-yellow-500/15 text-yellow-300", ring: "focus:ring-yellow-400/40" },
  lair:        { border: "border-orange-500/30",  text: "text-orange-300",badge: "bg-orange-500/15 text-orange-300", ring: "focus:ring-orange-400/40" },
}
