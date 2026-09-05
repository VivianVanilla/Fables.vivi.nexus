// ════════════════════════════════════════════════════════════════════════════
// ColorSwatchInput.tsx — every custom-color picker in the app renders through
// this one component instead of a bare <input type="color">, so it's visually
// obvious at a glance that a swatch is a real, tap-to-customize color picker
// (an eyedropper icon) rather than just a colored dot/decoration — the icon
// itself is tinted to the current value, and a real <input type="color">
// sits invisibly on top so it still opens the native OS picker on click/tap;
// this is purely a visual re-skin, the interaction is unchanged.
//
// Right-click copies this swatch's hex to the clipboard; shift-click pastes
// a hex from the clipboard into it — lets a color be carried from one swatch
// straight to another (e.g. matching a class's card color onto its slider
// color) without re-opening the native picker and re-entering it by hand.
// Both are silently no-ops if the Clipboard API isn't available/permitted —
// the plain click-to-open-native-picker behavior is unaffected either way.
// ════════════════════════════════════════════════════════════════════════════

import { useState } from "react"
import { Pipette } from "lucide-react"

interface ColorSwatchInputProps {
  value: string
  onChange: (value: string) => void
  title?: string
  size?: "size-5" | "size-6"
  className?: string
}

const HEX_RE = /^#[0-9a-f]{6}$/i

export function ColorSwatchInput({ value, onChange, title, size = "size-5", className = "" }: ColorSwatchInputProps) {
  const [copied, setCopied] = useState(false)

  async function copyHex() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 900)
    } catch { /* clipboard unavailable/denied — native picker still works */ }
  }

  async function pasteHex() {
    try {
      const text = (await navigator.clipboard.readText()).trim()
      if (HEX_RE.test(text)) onChange(text)
    } catch { /* clipboard unavailable/denied/empty — silently ignore */ }
  }

  const hint = `${title ? title + " — " : ""}right-click to copy, shift-click to paste`

  return (
    <span className={`relative inline-flex items-center justify-center ${size} shrink-0 cursor-pointer ${className}`} title={hint}
      onContextMenu={e => { e.preventDefault(); copyHex() }}>
      <Pipette size={14} color={value} strokeWidth={2.25} className="pointer-events-none" />
      {copied && <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-green-400 pointer-events-none" />}
      <input
        type="color"
        value={value}
        title={hint}
        onClick={e => { if (e.shiftKey) { e.preventDefault(); pasteHex() } }}
        onChange={e => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer border-0 bg-transparent p-0"
      />
    </span>
  )
}
