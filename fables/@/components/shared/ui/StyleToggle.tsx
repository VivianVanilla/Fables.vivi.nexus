// ════════════════════════════════════════════════════════════════════════════
// StyleToggle.tsx — the one None/Outline(or Flat)/Background(or Hue Shift)
// pill-group used everywhere a CardStyle gets picked: a character's own
// Settings (Card Style, Feature Styling rows) and the DM's Campaign Settings
// (Stash/Party Card Appearance) — both read through the same
// categoryAccentStyle, so the control that picks the value should look and
// behave identically wherever it shows up too. "outline" reads as "Flat" for
// a slider control since there's no border to outline there. The 3rd option
// ("galaxy" — the picked color, no darken/lighten blend toward the sheet's
// theme or toward black/white) reads as "Background" for a card, since
// that's a flat fill there — but the same value drives a hue-cycling shimmer
// on a Tracking Slider bar (accentShimmerGradient in themes.ts), not a flat
// fill, so it reads as "Hue Shift" there instead, since that's what it
// actually does.
// ════════════════════════════════════════════════════════════════════════════

import type { CardStyle } from "@/components/shared/constants"

export function StyleToggle({ label, value, onChange, slider, dark }: { label: string; value: CardStyle; onChange: (s: CardStyle) => void; slider?: boolean; dark?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 pl-2">
      <span className={`text-[10px] ${dark ? "text-black/50" : "text-white/40"} shrink-0`}>{label}</span>
      <div className="flex items-center gap-1 rounded-full bg-white/10 p-0.5">
        {(["none", "outline", "galaxy"] as CardStyle[]).map(s => (
          <button key={s} type="button"
            onClick={() => onChange(s)}
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${value === s ? "bg-purple-500/30 text-purple-200" : "text-white/40 hover:text-white/70"}`}>
            {s === "none" ? "None" : s === "outline" ? (slider ? "Flat" : "Outline") : (slider ? "Hue Shift" : "Background")}
          </button>
        ))}
      </div>
    </div>
  )
}
