// ════════════════════════════════════════════════════════════════════════════
// PinButton.tsx — shared pin toggle button (mirrors FavoriteStar.tsx)
//
// Same pushpin glyph in both states — pinned stands upright, unpinned tilts
// back 45°, the common "loose vs. stuck" pin convention — rather than
// swapping to a different glyph, since there's no reliable outline-pushpin
// emoji to pair with 🖈.
// ════════════════════════════════════════════════════════════════════════════

import { motion } from "motion/react"

interface PinButtonProps {
  isPinned: boolean
  onToggle: () => void
  label?: string   // optional visible text (e.g. "Pinned") — omit for icon-only
  className?: string
}

export function PinButton({ isPinned, onToggle, label, className = "" }: PinButtonProps) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.78 }}
      onClick={e => { e.stopPropagation(); onToggle() }}
      title={isPinned ? "Unpin" : "Pin to top"}
      className={`flex items-center gap-1 shrink-0 transition-colors overflow-hidden ${
        label ? "px-2.5 py-1 rounded-full text-xs font-semibold" : "size-7 justify-center rounded-lg hover:bg-white/10 text-base"
      } ${isPinned ? "text-sky-400" : "text-white/25 hover:text-sky-400"} ${
        label ? (isPinned ? "bg-sky-400/15" : "bg-white/10 hover:bg-white/15") : ""
      } ${className}`}
    >
      <motion.span
        animate={{ rotate: isPinned ? 0 : -45 }}
        transition={{ type: "spring", stiffness: 500, damping: 15 }}
        className="inline-block leading-none"
      >
        🖈
      </motion.span>
      {label && <span>{label}</span>}
    </motion.button>
  )
}
