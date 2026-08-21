// ════════════════════════════════════════════════════════════════════════════
// FormSwitcher.tsx — small header button (next to Lv) for manually swapping
// between Base Form and any Automation-defined Form. Same trigger/position/
// click-outside popover pattern as AutomationModal.tsx's HelpButton and
// InfoTab.tsx's LinkMenu.
// ════════════════════════════════════════════════════════════════════════════

import { useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { CharacterForm } from "@/components/shared/types"
import { usePopoverPosition, useClickOutside } from "@/components/shared/usePortalMenu"

export function FormSwitcher({ forms, activeFormId, onActivate, readOnly }: {
  forms: CharacterForm[]
  activeFormId: string | null
  onActivate: (id: string | null) => void
  readOnly?: boolean
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const pos = usePopoverPosition(open, triggerRef, contentRef)
  useClickOutside(open, () => setOpen(false), triggerRef, contentRef)

  // No forms defined at all — nothing to switch between, and an empty
  // "No Forms" pill just confuses new players who haven't touched
  // Automation yet. It reappears the moment they add their first form.
  if (forms.length === 0) return null

  const activeForm = activeFormId ? forms.find(f => f.id === activeFormId) : null

  if (readOnly) {
    return activeForm ? (
      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-200 border border-purple-400/30 shrink-0">
        {activeForm.name}
      </span>
    ) : null
  }

  return (
    <div className="relative shrink-0">
      <button type="button" ref={triggerRef} onClick={() => setOpen(v => !v)}
        title="Switch form"
        className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
          activeForm
            ? "bg-purple-500/20 text-purple-200 border-purple-400/30 hover:bg-purple-500/30"
            : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/70"
        }`}>
        {activeForm ? activeForm.name : forms.length > 0 ? "Base Form" : "No Forms"}
      </button>
      {open && pos && createPortal(
        <div ref={contentRef} style={{ position: "fixed", top: pos.top, right: pos.right }}
          className="z-50 w-48 bg-zinc-900 border border-white/15 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <button type="button" onClick={() => { onActivate(null); setOpen(false) }}
            className={`w-full text-left px-3 py-2 text-xs transition-colors ${!activeFormId ? "bg-purple-500/20 text-purple-200" : "text-white/70 hover:bg-white/10"}`}>
            Base Form
          </button>
          {forms.length === 0 ? (
            <p className="px-3 py-2 text-[11px] text-white/30 italic">No forms yet — see Automation.</p>
          ) : forms.map(f => (
            <button key={f.id} type="button" onClick={() => { onActivate(f.id); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-xs truncate transition-colors ${f.id === activeFormId ? "bg-purple-500/20 text-purple-200" : "text-white/70 hover:bg-white/10"}`}>
              {f.name}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}
