// ════════════════════════════════════════════════════════════════════════════
// SpellEntry.tsx — compact spell row + modal edit form
// ════════════════════════════════════════════════════════════════════════════

import { useState } from "react"
import type { SpellItem } from "../../character-types"
import type { Theme } from "../../character-themes"
import { Modal } from "../ui/Modal"

// ── Types ─────────────────────────────────────────────────────────────────────

interface SpellEntryProps {
  spell: SpellItem
  onChange: (patch: Partial<SpellItem>) => void
  onRemove: () => void
  theme: Theme
  readOnly?: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SpellEntry({ spell, onChange, onRemove, theme, readOnly = false }: SpellEntryProps) {
  const [editing, setEditing] = useState(false)

  // ── Drag source ─────────────────────────────────────────────────────────

  const dragAttrs = readOnly ? {} : {
    draggable: true as const,
    onDragStart(e: React.DragEvent) {
      e.dataTransfer.setData("x-fable-ref", JSON.stringify({
        refId:   spell.id,
        refType: "spell",
        label:   spell.name || "Spell",
      }))
      e.dataTransfer.effectAllowed = "copy"
    },
  }

  return (
    <>
      {/* ── Modal edit form ─────────────────────────────────────────────── */}
      {editing && (
        <Modal onClose={() => setEditing(false)}>
          <div className="bg-zinc-900 border border-white/15 rounded-2xl shadow-2xl w-80 max-h-[85vh] flex flex-col overflow-hidden">

            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
              <input
                value={spell.name}
                onChange={e => onChange({ name: e.target.value })}
                autoFocus
                placeholder="Spell name"
                className="flex-1 bg-transparent outline-none text-base font-bold text-white placeholder:text-white/30 mr-3"
              />
              <button type="button" onClick={() => setEditing(false)}
                className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white shrink-0">✕</button>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-4">

              {/* Field grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-white/40 uppercase tracking-wider">Level</span>
                  <input type="number" value={spell.level ?? ""} onChange={e => onChange({ level: parseInt(e.target.value) || 0 })} placeholder="0"
                    className="bg-white/10 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-white/40 uppercase tracking-wider">School</span>
                  <input value={spell.school ?? ""} onChange={e => onChange({ school: e.target.value })} placeholder="Evocation"
                    className="bg-white/10 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-white/40 uppercase tracking-wider">Attack</span>
                  <input value={spell.toHit ?? ""} onChange={e => onChange({ toHit: e.target.value })} placeholder="+5"
                    className="bg-white/10 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-white/40 uppercase tracking-wider">Save</span>
                  <input value={spell.saveAttr ?? ""} onChange={e => onChange({ saveAttr: e.target.value })} placeholder="DEX"
                    className="bg-white/10 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-white/40 uppercase tracking-wider">Damage</span>
                  <input value={spell.damage ?? ""} onChange={e => onChange({ damage: e.target.value })} placeholder="8d6"
                    className="bg-white/10 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-white/40 uppercase tracking-wider">Dmg Type</span>
                  <input value={spell.damageType ?? ""} onChange={e => onChange({ damageType: e.target.value })} placeholder="Fire"
                    className="bg-white/10 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-white/40 uppercase tracking-wider">Cast Time</span>
                  <input value={spell.castTime ?? ""} onChange={e => onChange({ castTime: e.target.value })} placeholder="1 action"
                    className="bg-white/10 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-white/40 uppercase tracking-wider">Range</span>
                  <input value={spell.range ?? ""} onChange={e => onChange({ range: e.target.value })} placeholder="60ft"
                    className="bg-white/10 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-white/40 uppercase tracking-wider">Duration</span>
                  <input value={spell.duration ?? ""} onChange={e => onChange({ duration: e.target.value })} placeholder="Instantaneous"
                    className="bg-white/10 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-white/40 uppercase tracking-wider">Components</span>
                  <input value={spell.components ?? ""} onChange={e => onChange({ components: e.target.value })} placeholder="V, S, M"
                    className="bg-white/10 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20" />
                </label>
              </div>

              {/* Material components (full width) */}
              <label className="flex flex-col gap-1">
                <span className="text-xs text-white/40 uppercase tracking-wider">Material Components</span>
                <input value={spell.materialComponents ?? ""} onChange={e => onChange({ materialComponents: e.target.value })} placeholder="A pinch of sulfur…"
                  className="bg-white/10 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20 text-sm" />
              </label>

              {/* Checkboxes */}
              <div className="flex items-center gap-4 text-sm text-white/60">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={spell.prepared ?? false} onChange={e => onChange({ prepared: e.target.checked })} className="accent-primary" />
                  Prepared
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={spell.alwaysPrepared ?? false} onChange={e => onChange({ alwaysPrepared: e.target.checked })} className="accent-primary" />
                  Always
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={spell.ritual ?? false} onChange={e => onChange({ ritual: e.target.checked })} className="accent-primary" />
                  Ritual
                </label>
              </div>

              {/* Description */}
              <label className="flex flex-col gap-1">
                <span className="text-xs text-white/40 uppercase tracking-wider">Description / Notes</span>
                <textarea value={spell.notes ?? ""} onChange={e => onChange({ notes: e.target.value })} placeholder="Spell description…" rows={4}
                  className="bg-white/10 rounded-lg px-3 py-2 text-sm text-white/70 outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20 resize-none" />
              </label>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-white/10 shrink-0">
              <button type="button" onClick={onRemove} className="text-sm text-red-400/60 hover:text-red-400 transition-colors">Delete</button>
              <button type="button" onClick={() => setEditing(false)}
                className="text-sm px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white font-semibold transition-colors">Done</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Compact row (always visible) ────────────────────────────────── */}
      <div {...dragAttrs} className={`rounded-lg ${theme.box} border border-white/10 px-3 py-2.5 flex items-center gap-2 min-h-11`}>

        {/* Prepared indicator — "P" box */}
        <button type="button" disabled={readOnly}
          onClick={() => onChange({ prepared: !spell.prepared })}
          title={spell.alwaysPrepared ? "Always prepared" : spell.prepared ? "Prepared — click to unprepare" : "Unprepared — click to prepare"}
          className={`size-5 rounded shrink-0 transition-colors text-[9px] font-bold flex items-center justify-center border ${
            spell.alwaysPrepared ? "bg-primary/40 border-primary/50 text-white/80"
            : spell.prepared     ? "bg-primary border-primary text-white"
            :                      "border-white/20 bg-transparent text-white/20 hover:border-white/40 hover:text-white/40"
          }`}>
          P
        </button>

        {/* Name + tags */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-white truncate">
              {spell.name || <span className="text-white/30 italic">Unnamed</span>}
            </p>
            {spell.ritual && (
              <span className="text-[9px] border border-amber-400/40 text-amber-400/80 rounded px-0.5 leading-tight shrink-0">R</span>
            )}
          </div>
          <div className="flex gap-1 mt-0.5 flex-wrap">
            {spell.level !== undefined && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 text-white/60">Lv {spell.level}</span>
            )}
            {spell.school && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 text-white/45 italic">{spell.school}</span>
            )}
            {(spell.saveAttr || spell.saveType) && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-300/80">
                Save {spell.saveAttr || spell.saveType}
              </span>
            )}
            {spell.toHit && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 text-white/60">{spell.toHit} atk</span>
            )}
            {spell.damage && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-300/80">
                {spell.damage}{spell.damageType ? ` ${spell.damageType}` : ""}
              </span>
            )}
            {spell.castTime && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 text-white/45">{spell.castTime}</span>
            )}
          </div>
        </div>

        {/* Edit button */}
        {!readOnly && (
          <button type="button" onClick={() => setEditing(true)}
            className="size-7 flex items-center justify-center rounded-md hover:bg-white/10 text-white/25 hover:text-white/70 text-sm shrink-0 transition-colors">
            ✎
          </button>
        )}
      </div>
    </>
  )
}
