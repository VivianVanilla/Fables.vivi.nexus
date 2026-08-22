// ════════════════════════════════════════════════════════════════════════════
// ResistanceTracker.tsx — compact summary of active resistances/vulnerabilities
// (just the ones actually set, each tagged RES/VUL alongside its color so the
// state doesn't rely on color alone) with an "Edit" button that pops open the
// full damage-type picker on demand — same trigger/popover pattern as
// FormSwitcher/AutomationModal's HelpButton — instead of always spending
// space on all 13 damage types whether or not any are set.
// ════════════════════════════════════════════════════════════════════════════

import { useRef, useState } from "react"
import { createPortal } from "react-dom"
import { DAMAGE_TYPES } from "@/components/shared/damageTypes"
import { usePopoverPosition, useClickOutside } from "@/components/shared/usePortalMenu"

interface Props {
  card: string
  resistances: string[]
  vulnerabilities: string[]
  readOnly?: boolean
  onUpdate: (patch: { resistances?: string[]; vulnerabilities?: string[] }) => void
}

// Each damage type cycles None → Resistant → Vulnerable → None on click —
// a type can't be both at once, same as the 5e rule that resistance and
// vulnerability to the same damage type just cancel out.
export function ResistanceTracker({ card, resistances, vulnerabilities, readOnly, onUpdate }: Props) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const pos = usePopoverPosition(open, triggerRef, contentRef)
  useClickOutside(open, () => setOpen(false), triggerRef, contentRef)

  function cycle(type: string) {
    if (readOnly) return
    if (resistances.includes(type)) {
      onUpdate({ resistances: resistances.filter(t => t !== type), vulnerabilities: [...vulnerabilities, type] })
    } else if (vulnerabilities.includes(type)) {
      onUpdate({ vulnerabilities: vulnerabilities.filter(t => t !== type) })
    } else {
      onUpdate({ resistances: [...resistances, type] })
    }
  }

  const active = [
    ...resistances.map(type => ({ type, kind: "RES" as const })),
    ...vulnerabilities.map(type => ({ type, kind: "VUL" as const })),
  ].sort((a, b) => a.type.localeCompare(b.type))

  return (
    <div className={`${card} p-3 flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-white/45 font-semibold">Resistances &amp; Vulnerabilities</span>
        {!readOnly && (
          <button type="button" ref={triggerRef} onClick={() => setOpen(v => !v)}
            className="text-xs px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white/50 hover:text-white transition-colors">
            Edit
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {active.length === 0 && (
          <p className="text-[10px] text-white/25 italic">None set{readOnly ? "." : " — tap Edit to add some."}</p>
        )}
        {active.map(a => (
          <span key={a.type}
            className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border font-semibold ${
              a.kind === "RES" ? "bg-emerald-500/25 text-emerald-200 border-emerald-500/40" : "bg-red-500/25 text-red-200 border-red-500/40"
            }`}>
            {a.type}
            <span className="opacity-70 text-[9px] tracking-wide">{a.kind}</span>
          </span>
        ))}
      </div>

      {open && pos && createPortal(
        <div ref={contentRef} style={{ position: "fixed", top: pos.top, right: pos.right }}
          className="z-50 w-72 bg-zinc-900 border border-white/15 rounded-lg shadow-xl p-3 animate-in fade-in zoom-in-95 duration-150">
          <p className="text-[9px] uppercase tracking-wider text-white/30 font-semibold mb-2">Tap to cycle: None → Resistant → Vulnerable</p>
          <div className="flex flex-wrap gap-1">
            {DAMAGE_TYPES.map(type => {
              const resistant  = resistances.includes(type)
              const vulnerable = vulnerabilities.includes(type)
              const stateClass =
                resistant  ? "bg-emerald-500/25 text-emerald-200 border-emerald-500/40" :
                vulnerable ? "bg-red-500/25 text-red-200 border-red-500/40" :
                             "bg-white/8 text-white/45 border-white/10 hover:bg-white/15 hover:text-white/70"
              return (
                <button key={type} type="button" onClick={() => cycle(type)}
                  title={resistant ? "Resistant — click for Vulnerable" : vulnerable ? "Vulnerable — click to clear" : "Click to mark Resistant"}
                  className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border font-semibold transition-colors ${stateClass}`}>
                  {type}
                  {(resistant || vulnerable) && <span className="opacity-70 text-[9px] tracking-wide">{resistant ? "RES" : "VUL"}</span>}
                </button>
              )
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
