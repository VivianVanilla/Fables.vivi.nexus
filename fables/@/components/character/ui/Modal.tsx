// ════════════════════════════════════════════════════════════════════════════
// Modal.tsx — shared full-screen overlay wrapper
// ════════════════════════════════════════════════════════════════════════════

import React from "react"

export function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()}>{children}</div>
    </div>
  )
}
