// ════════════════════════════════════════════════════════════════════════════
// FormSwitcher.tsx — small header button (next to Lv) for manually swapping
// between Base Form and any Automation-defined Form. Same trigger/position/
// click-outside popover pattern as AutomationModal.tsx's HelpButton and
// InfoTab.tsx's LinkMenu.
//
// multiForm (gated per-character in CharacterSheet.tsx — see
// multiFormEnabled) swaps the exclusive single-select above for a checklist:
// any number of forms can be checked on at once instead of picking exactly
// one. Ordinary characters never see this — same trigger/popover shell either way.
// ════════════════════════════════════════════════════════════════════════════

import { useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { CharacterForm } from "@/components/shared/types"
import { usePopoverPosition, useClickOutside } from "@/components/shared/usePortalMenu"

export function FormSwitcher({
  forms, activeFormId, onActivate, readOnly, multiForm, activeFormIds, onToggle,
}: {
  forms: CharacterForm[]
  activeFormId: string | null
  onActivate: (id: string | null) => void
  readOnly?: boolean
  multiForm?: boolean
  activeFormIds?: string[]
  onToggle?: (id: string) => void
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
  const activeMulti = multiForm ? forms.filter(f => (activeFormIds ?? []).includes(f.id)) : []
  const anyActive = multiForm ? activeMulti.length > 0 : !!activeForm
  const label = multiForm
    ? (activeMulti.length === 0 ? "Base Form" : activeMulti.length === 1 ? activeMulti[0].name : `${activeMulti.length} Forms Active`)
    : (activeForm ? activeForm.name : "Base Form")

  if (readOnly) {
    if (!anyActive) return null
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-200 border border-purple-400/30 shrink-0">
        {label}
      </span>
    )
  }

  return (
    <div className="relative shrink-0">
      <button type="button" ref={triggerRef} onClick={() => setOpen(v => !v)}
        title={multiForm ? "Toggle active forms" : "Switch form"}
        className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
          anyActive
            ? "bg-purple-500/20 text-purple-200 border-purple-400/30 hover:bg-purple-500/30"
            : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/70"
        }`}>
        {label}
      </button>
      {open && pos && createPortal(
        <div ref={contentRef} style={{ position: "fixed", top: pos.top, right: pos.right }}
          className="z-50 w-48 bg-zinc-900 border border-white/15 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {multiForm ? (
            <>
              <p className="px-3 pt-2 pb-1 text-[9px] uppercase tracking-wider text-white/30 font-semibold">Active Forms</p>
              {forms.map(f => {
                const on = (activeFormIds ?? []).includes(f.id)
                return (
                  <button key={f.id} type="button" onClick={() => onToggle?.(f.id)}
                    className="w-full flex items-center gap-2 text-left px-3 py-2 text-xs truncate transition-colors text-white/70 hover:bg-white/10">
                    <span className={`size-3.5 rounded shrink-0 border flex items-center justify-center ${on ? "bg-purple-500 border-purple-400" : "border-white/25"}`}>
                      {on && <span className="text-white text-[9px] leading-none">✓</span>}
                    </span>
                    <span className={on ? "text-purple-200" : ""}>{f.name}</span>
                  </button>
                )
              })}
            </>
          ) : (
            <>
              <button type="button" onClick={() => { onActivate(null); setOpen(false) }}
                className={`w-full text-left px-3 py-2 text-xs transition-colors ${!activeFormId ? "bg-purple-500/20 text-purple-200" : "text-white/70 hover:bg-white/10"}`}>
                Base Form
              </button>
              {forms.map(f => (
                <button key={f.id} type="button" onClick={() => { onActivate(f.id); setOpen(false) }}
                  className={`w-full text-left px-3 py-2 text-xs truncate transition-colors ${f.id === activeFormId ? "bg-purple-500/20 text-purple-200" : "text-white/70 hover:bg-white/10"}`}>
                  {f.name}
                </button>
              ))}
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
