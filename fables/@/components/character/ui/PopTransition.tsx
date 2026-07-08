// ════════════════════════════════════════════════════════════════════════════
// PopTransition.tsx — smooth enter/exit for conditionally-rendered UI
//
// Drop-in replacement for `{show && <div>...</div>}` wherever a toggle causes
// a field/checkbox/tag to instantly appear or disappear.
// ════════════════════════════════════════════════════════════════════════════

import { AnimatePresence, motion } from "motion/react"

export function PopTransition({ show, children, className }: { show: boolean; children: React.ReactNode; className?: string }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          className={className}
          initial={{ opacity: 0, scale: 0.97, height: 0 }}
          animate={{ opacity: 1, scale: 1, height: "auto" }}
          exit={{ opacity: 0, scale: 0.97, height: 0 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          style={{ overflow: "hidden" }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
