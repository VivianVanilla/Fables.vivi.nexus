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
        // No `height` in the animated properties — animating to/from
        // height: "auto" needs Framer Motion to actually run a measurement
        // pass, and AnimatePresence's initial={false} (skip the enter
        // animation for content already present when this mounts) skips
        // that pass too, which left content that starts already-shown
        // (e.g. a checkbox whose dependent field should be visible from the
        // very first render) stuck at its pre-animation height: 0 — present
        // in the DOM, invisible. Opacity/scale alone don't have this
        // problem, and dropping the height animation trades a smooth
        // grow/shrink for surrounding content shifting instantly, which is
        // the safer failure mode of the two.
        <motion.div
          className={className}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
