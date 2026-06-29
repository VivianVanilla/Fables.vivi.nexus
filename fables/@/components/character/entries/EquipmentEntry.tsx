// ════════════════════════════════════════════════════════════════════════════
// EquipmentEntry.tsx — compact equipment row + modal edit form
// ════════════════════════════════════════════════════════════════════════════

import { useState } from "react"
import type { EquipmentItem } from "../../character-types"
import type { Theme } from "../../character-themes"
import { Modal } from "../ui/Modal"

// ── Types ─────────────────────────────────────────────────────────────────────

interface EquipmentEntryProps {
  item: EquipmentItem
  onChange: (patch: Partial<EquipmentItem>) => void
  onRemove: () => void
  theme: Theme
  readOnly?: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EquipmentEntry({ item, onChange, onRemove, theme, readOnly = false }: EquipmentEntryProps) {
  const [editing, setEditing] = useState(false)

  // ── Drag source ─────────────────────────────────────────────────────────

  const dragAttrs = readOnly ? {} : {
    draggable: true as const,
    onDragStart(e: React.DragEvent) {
      e.dataTransfer.setData("x-fable-ref", JSON.stringify({
        refId:   item.id,
        refType: "equipment",
        label:   item.name || "Item",
      }))
      e.dataTransfer.effectAllowed = "copy"
    },
  }

  return (
    <>
      {/* ── Modal edit form ─────────────────────────────────────────────── */}
      {editing && (
        <Modal onClose={() => setEditing(false)}>
          <div className="bg-zinc-900 border border-white/15 rounded-2xl shadow-2xl w-80 flex flex-col overflow-hidden">

            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
              <input
                value={item.name}
                onChange={e => onChange({ name: e.target.value })}
                autoFocus
                placeholder="Item name"
                className="flex-1 bg-transparent outline-none text-base font-bold text-white placeholder:text-white/30 mr-3"
              />
              <button type="button" onClick={() => setEditing(false)}
                className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white shrink-0">✕</button>
            </div>

            {/* Modal body */}
            <div className="p-5 flex flex-col gap-4">

              {/* Field grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-white/40 uppercase tracking-wider">Type</span>
                  <select value={item.type ?? "melee"} onChange={e => onChange({ type: e.target.value })}
                    className="bg-white/10 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30 text-sm">
                    <option value="melee">Melee</option>
                    <option value="ranged">Ranged</option>
                    <option value="armor">Armor</option>
                    <option value="misc">Misc</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-white/40 uppercase tracking-wider">Magic Bonus</span>
                  <input value={item.magicBonus ?? ""} onChange={e => onChange({ magicBonus: e.target.value })} placeholder="+1"
                    className="bg-white/10 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-white/40 uppercase tracking-wider">To Hit</span>
                  <input value={item.toHit ?? ""} onChange={e => onChange({ toHit: e.target.value })} placeholder="+5"
                    className="bg-white/10 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-white/40 uppercase tracking-wider">Damage</span>
                  <input value={item.damage ?? ""} onChange={e => onChange({ damage: e.target.value })} placeholder="1d8"
                    className="bg-white/10 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-white/40 uppercase tracking-wider">Dmg Type</span>
                  <input value={item.damageType ?? ""} onChange={e => onChange({ damageType: e.target.value })} placeholder="Slashing"
                    className="bg-white/10 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20" />
                </label>
                <label className="flex flex-col gap-1 col-span-2">
                  <span className="text-xs text-white/40 uppercase tracking-wider">Properties</span>
                  <input value={item.properties ?? ""} onChange={e => onChange({ properties: e.target.value })} placeholder="Versatile, Finesse…"
                    className="bg-white/10 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20" />
                </label>
                <label className="flex items-center gap-2 col-span-2 cursor-pointer select-none">
                  <input type="checkbox" checked={item.proficient ?? false} onChange={e => onChange({ proficient: e.target.checked })}
                    className="accent-primary size-4 rounded" />
                  <span className="text-sm text-white/70">Proficient with this weapon</span>
                </label>
              </div>

              {/* Notes */}
              <label className="flex flex-col gap-1">
                <span className="text-xs text-white/40 uppercase tracking-wider">Notes</span>
                <input value={item.notes ?? ""} onChange={e => onChange({ notes: e.target.value })} placeholder="Notes…"
                  className="bg-white/10 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20 text-sm" />
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

        {/* Proficiency dot */}
        <span className={`size-2 rounded-full shrink-0 ${item.proficient ? "bg-primary" : "bg-white/15"}`}
          title={item.proficient ? "Proficient" : "Not proficient"} />

        {/* Name + tags */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            {item.name || <span className="text-white/30 italic">Unnamed</span>}
          </p>
          <div className="flex gap-1 mt-0.5 flex-wrap">
            {item.type && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 text-white/60 capitalize">{item.type}</span>
            )}
            {item.magicBonus && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold">{item.magicBonus}</span>
            )}
            {item.toHit && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 text-white/60">{item.toHit} hit</span>
            )}
            {item.damage && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-300/80">
                {item.damage}{item.damageType ? ` ${item.damageType}` : ""}
              </span>
            )}
            {item.properties && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 text-white/45 italic">{item.properties}</span>
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
