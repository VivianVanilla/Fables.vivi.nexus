// ════════════════════════════════════════════════════════════════════════════
// VisionCard.tsx — optional panel (Settings' "Add vision tracker") for special
// senses: Darkvision/Blindsight/Tremorsense/Truesight, each a range in feet.
// Same compact-chips + "✎" popover pattern as ResistanceTracker.tsx, but
// each entry carries a number instead of cycling through a fixed RES/VUL/none
// state — closer to SkillModal's "Extra Bonus" input than to a chip toggle.
// ════════════════════════════════════════════════════════════════════════════

import { useRef, useState } from "react"
import { createPortal } from "react-dom"
import { VISION_TYPES } from "@/components/shared/constants"
import { usePopoverPosition, useClickOutside } from "@/components/shared/usePortalMenu"

interface Props {
  card: string
  visionTypes: Record<string, number>
  effectiveVision: Record<string, number>
  readOnly?: boolean
  onUpdate: (patch: { visionTypes?: Record<string, number> }) => void
}

export function VisionCard({ card, visionTypes, effectiveVision, readOnly, onUpdate }: Props) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const pos = usePopoverPosition(open, triggerRef, contentRef)
  useClickOutside(open, () => setOpen(false), triggerRef, contentRef)

  function setRange(type: string, range: number) {
    const next = { ...visionTypes }
    if (range > 0) next[type] = range; else delete next[type]
    onUpdate({ visionTypes: next })
  }

  const active = VISION_TYPES
    .map(type => ({ type, range: effectiveVision[type] ?? 0, boosted: (effectiveVision[type] ?? 0) > (visionTypes[type] ?? 0) }))
    .filter(v => v.range > 0)

  return (
    <div className={`${card} p-3 flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-white/45 font-semibold">Vision</span>
        {!readOnly && (
          <button type="button" ref={triggerRef} onClick={() => setOpen(v => !v)}
            className="text-xs px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white/50 hover:text-white transition-colors">
            ✎
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {active.length === 0 && (
          <p className="text-[10px] text-white/25 italic">None set{readOnly ? "." : " — tap Edit to add some."}</p>
        )}
        {active.map(v => (
          <span key={v.type} title={v.boosted ? "Boosted by an active Form" : undefined}
            className={`text-[10px] px-2 py-1 rounded-full border font-semibold ${
              v.boosted ? "bg-sky-500/25 text-sky-200 border-sky-500/40" : "bg-white/10 text-white/60 border-white/15"
            }`}>
            {v.type} {v.range} ft
          </span>
        ))}
      </div>

      {open && pos && createPortal(
        <div ref={contentRef} style={{ position: "fixed", top: pos.top, right: pos.right }}
          className="z-50 w-56 bg-zinc-900 border border-white/15 rounded-lg shadow-xl p-3 flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-150">
          {VISION_TYPES.map(type => (
            <label key={type} className="flex items-center justify-between gap-2 text-xs text-white/70">
              {type}
              <input type="number" min={0} value={visionTypes[type] ?? ""} placeholder="0"
                onChange={e => setRange(type, e.target.value === "" ? 0 : parseInt(e.target.value) || 0)}
                className="w-16 bg-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none focus:ring-1 focus:ring-white/30 text-right" />
            </label>
          ))}
          <p className="text-[9px] text-white/30 mt-0.5">Range in feet.</p>
        </div>,
        document.body
      )}
    </div>
  )
}
