// ════════════════════════════════════════════════════════════════════════════
// FavoriteStar.tsx — shared favorite toggle button
//
// Swaps between a filled ★ (favorited) and an outline ☆ (not) with a springy
// pop so the state change reads clearly, instead of just a subtle color swap.
// ════════════════════════════════════════════════════════════════════════════

import { motion, AnimatePresence } from "motion/react"

interface FavoriteStarProps {
  isFavorite: boolean
  onToggle: () => void
  label?: string   // optional visible text (e.g. "Favorite") — omit for icon-only
  className?: string
}

export function FavoriteStar({ isFavorite, onToggle, label, className = "" }: FavoriteStarProps) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.78 }}
      onClick={e => { e.stopPropagation(); onToggle() }}
      title={isFavorite ? "Remove from favorites" : "Add to favorites"}
      className={`flex items-center gap-1 shrink-0 transition-colors overflow-hidden ${
        label ? "px-2.5 py-1 rounded-full text-xs font-semibold" : "size-7 justify-center rounded-lg hover:bg-white/10 text-base"
      } ${isFavorite ? "text-yellow-400" : "text-white/25 hover:text-yellow-400"} ${
        label ? (isFavorite ? "bg-yellow-400/15" : "bg-white/10 hover:bg-white/15") : ""
      } ${className}`}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={isFavorite ? "on" : "off"}
          initial={{ scale: 0.3, rotate: -55, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          exit={{ scale: 0.3, rotate: 55, opacity: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 15 }}
          className="inline-block leading-none"
        >
          {isFavorite ? "★" : "☆"}
        </motion.span>
      </AnimatePresence>
      {label && <span>{label}</span>}
    </motion.button>
  )
}
