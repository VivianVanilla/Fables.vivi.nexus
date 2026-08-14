// ════════════════════════════════════════════════════════════════════════════
// Modal.tsx — shared full-screen overlay wrapper
// ════════════════════════════════════════════════════════════════════════════

import React from "react"

export function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()} className="animate-in fade-in zoom-in-95 duration-200">{children}</div>
    </div>
  )
}
