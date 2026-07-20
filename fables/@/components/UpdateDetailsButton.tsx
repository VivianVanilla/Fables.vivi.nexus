// ════════════════════════════════════════════════════════════════════════════
// UpdateDetailsButton.tsx — small "i" info button next to the sidebar toggle
// that shows recent app updates (see changelog.ts). Same portaled-dropdown
// pattern as MarkdownExportMenu in monster.tsx — escapes the header's own
// overflow ancestor instead of getting clipped.
// ════════════════════════════════════════════════════════════════════════════

import { useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Info } from "lucide-react"
import { CHANGELOG } from "@/components/changelog"
import { usePopoverPosition, useClickOutside } from "@/components/collab/usePortalMenu"

export function UpdateDetailsButton() {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const pos = usePopoverPosition(open, triggerRef)
  useClickOutside(open, () => setOpen(false), triggerRef, contentRef)

  return (
    <>
      <button type="button" ref={triggerRef} onClick={() => setOpen(v => !v)} title="What's new"
        className="size-7 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0">
        <Info className="size-4" />
      </button>
      {open && pos && createPortal(
        <div ref={contentRef} style={{ position: "fixed", top: pos.top, right: pos.right }}
          className="z-50 bg-popover border border-border rounded-lg shadow-xl overflow-hidden w-80 max-h-[70vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3.5 py-2.5 border-b border-border sticky top-0 bg-popover">
            <span className="text-sm font-semibold text-foreground">What's New</span>
          </div>
          <div className="flex flex-col divide-y divide-border">
            {CHANGELOG.map((entry, i) => (
              <div key={i} className="px-3.5 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-foreground">{entry.title}</span>
                  <span className="text-[10px] text-muted-foreground/60 shrink-0">{entry.date}</span>
                </div>
                <p className="text-xs text-muted-foreground/80 mt-1">{entry.description}</p>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
