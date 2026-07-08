// ════════════════════════════════════════════════════════════════════════════
// usePortalMenu.ts — shared helpers for portaled dropdown menus (ShareMenu,
// LinkMenu, ...): where to draw them, and when to close them.
//
// Closing used to rely on the trigger's onBlur plus onMouseDown{preventDefault}
// on the dropdown to stop that blur from firing when clicking a menu button.
// That preventDefault also blocks the browser's default focus-on-mousedown
// behavior, which meant a text <input> inside the dropdown could never be
// focused or typed into — exactly the "can't type a username" bug. Click-
// outside detection replaces that whole dance and has no such side effect.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useState, type RefObject } from "react"

export function usePopoverPosition(open: boolean, triggerRef: RefObject<HTMLElement | null>) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  useEffect(() => {
    if (!open || !triggerRef.current) { setPos(null); return }
    const rect = triggerRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + 4, right: Math.max(4, window.innerWidth - rect.right) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  return pos
}

export function useClickOutside(open: boolean, onClose: () => void, ...refs: RefObject<HTMLElement | null>[]) {
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      const target = e.target as Node
      if (refs.some(r => r.current?.contains(target))) return
      onClose()
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
}
