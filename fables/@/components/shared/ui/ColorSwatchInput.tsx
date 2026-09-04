// ════════════════════════════════════════════════════════════════════════════
// ColorSwatchInput.tsx — every custom-color picker in the app renders through
// this one component instead of a bare <input type="color">, so it's visually
// obvious at a glance that a swatch is a real, tap-to-customize color picker
// (an eyedropper icon) rather than just a colored dot/decoration — the icon
// itself is tinted to the current value, and a real <input type="color">
// sits invisibly on top so it still opens the native OS picker on click/tap;
// this is purely a visual re-skin, the interaction is unchanged.
// ════════════════════════════════════════════════════════════════════════════

import { Pipette } from "lucide-react"

interface ColorSwatchInputProps {
  value: string
  onChange: (value: string) => void
  title?: string
  size?: "size-5" | "size-6"
  className?: string
}

export function ColorSwatchInput({ value, onChange, title, size = "size-5", className = "" }: ColorSwatchInputProps) {
  return (
    <span className={`relative inline-flex items-center justify-center ${size} shrink-0 cursor-pointer ${className}`} title={title}>
      <Pipette size={14} color={value} strokeWidth={2.25} className="pointer-events-none" />
      <input
        type="color"
        value={value}
        title={title}
        onChange={e => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer border-0 bg-transparent p-0"
      />
    </span>
  )
}
