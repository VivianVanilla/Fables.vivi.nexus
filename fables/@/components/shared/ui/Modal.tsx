// ════════════════════════════════════════════════════════════════════════════
// Modal.tsx — shared full-screen overlay wrapper
// ════════════════════════════════════════════════════════════════════════════

import React from "react"

export function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
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
