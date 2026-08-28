// ════════════════════════════════════════════════════════════════════════════
// Modal.tsx — shared full-screen overlay wrapper
// ════════════════════════════════════════════════════════════════════════════

import React, { useEffect } from "react"
import { pushModalClose, popModalClose } from "@/components/shared/modalBackStack"

export function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  // Registers this modal's close on the shared back-stack (see
  // modalBackStack.ts) so Android's hardware/gesture back button closes it
  // instead of leaving the screen underneath — every modal in the app goes
  // through this one component, so this is the only place that needs to
  // know about it. No-op cost on web; nothing reads the stack there.
  useEffect(() => {
    pushModalClose(onClose)
    return () => popModalClose(onClose)
  }, [onClose])

  return (
    <div
      // backdrop-filter forces the browser to keep a full-viewport
      // compositing layer for everything behind the modal and re-blur it
      // continuously through the fade-in — cheap on a desktop GPU, one of
      // the more common causes of visible jank opening any modal on mobile.
      // -xs (not -sm) matches the lighter blur dialog.tsx/sheet.tsx already
      // use for exactly this reason — same backdrop look, smaller kernel.
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      // Gated on mousedown (not click) hitting the backdrop *itself* — not
      // just bubbling up to it — so dragging to select text inside the modal
      // (e.g. across a line in a textarea) and releasing over the backdrop
      // no longer closes the modal. A real click still needs to both start
      // and land on the backdrop, same as before.
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="animate-in fade-in zoom-in-95 duration-200">{children}</div>
    </div>
  )
}
