// ════════════════════════════════════════════════════════════════════════════
// modalBackStack.ts — lets the Android hardware/gesture back button close
// whichever modal is currently on top instead of backing out of the whole
// screen (or exiting the app) underneath it.
//
// Every modal in the app renders through the one shared <Modal> component
// (@/components/shared/ui/Modal.tsx), so that's the single place this stack
// gets pushed to/popped from — no per-modal wiring needed anywhere else.
// useAndroidBackButton.ts (src/hooks) is the only reader, and only runs on
// native Android (Capacitor.isNativePlatform()); on web the browser's own
// back button already does the right thing and never touches this.
// ════════════════════════════════════════════════════════════════════════════

const stack: (() => void)[] = []

export function pushModalClose(onClose: () => void) {
  stack.push(onClose)
}

export function popModalClose(onClose: () => void) {
  // Removes this specific handler rather than always popping the tail —
  // StrictMode's mount/unmount/remount in dev, or a modal that outlives a
  // sibling opened after it, can otherwise pop the wrong entry.
  const idx = stack.lastIndexOf(onClose)
  if (idx !== -1) stack.splice(idx, 1)
}

// Closes the top-most open modal and reports whether one was found — the
// back-button handler falls through to router/back-navigation when this
// returns false (nothing left to close).
export function closeTopModal(): boolean {
  const top = stack[stack.length - 1]
  if (!top) return false
  top()
  return true
}
