// ════════════════════════════════════════════════════════════════════════════
// EquipmentEntry.tsx — equipment card with inline edit form
// ════════════════════════════════════════════════════════════════════════════

import { useState } from "react"
import type { EquipmentItem } from "../../character-types"
import type { Theme } from "../../character-themes"

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
        refId: item.id,
        refType: "equipment",
        label: item.name || "Item",
      }))
      e.dataTransfer.effectAllowed = "copy"
    },
  }

  // ── View mode ────────────────────────────────────────────────────────────

  if (!editing) {
    return (
      <div {...dragAttrs} className={`rounded-lg ${theme.box} border border-white/10 px-3 py-2 flex items-center gap-2`}>

        {/* Name + tags */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white truncate">
            {item.name || <span className="text-white/30 italic">Unnamed</span>}
          </p>
          <div className="flex gap-1 mt-0.5 flex-wrap">
            {item.type && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/60 capitalize">{item.type}</span>
            )}
            {item.magicBonus && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold">{item.magicBonus}</span>
            )}
            {item.toHit && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/60">{item.toHit} hit</span>
            )}
            {item.damage && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-300/80">
                {item.damage}{item.damageType ? ` ${item.damageType}` : ""}
              </span>
            )}
            {item.properties && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/45 italic">{item.properties}</span>
            )}
          </div>
        </div>

        {/* Edit button */}
        {!readOnly && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="size-6 flex items-center justify-center rounded-md hover:bg-white/10 text-white/25 hover:text-white/70 text-[11px] shrink-0 transition-colors"
          >
            ✎
          </button>
        )}
      </div>
    )
  }

  // ── Edit mode ────────────────────────────────────────────────────────────

  return (
    <div className={`rounded-lg ${theme.box} border border-white/20 p-2.5 flex flex-col gap-1.5`}>

      {/* Name */}
      <input
        value={item.name}
        onChange={e => onChange({ name: e.target.value })}
        autoFocus
        placeholder="Item name"
        className={`bg-transparent outline-none text-xs font-semibold ${theme.color} placeholder:text-white/40 border-b border-white/10 pb-1`}
      />

      {/* Field grid */}
      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
        <label className="flex items-center gap-1">
          <span className="text-white/50 shrink-0">Type</span>
          <select value={item.type ?? "melee"} onChange={e => onChange({ type: e.target.value })}
            className="flex-1 bg-white/10 rounded px-1 py-0.5 text-white outline-none text-[10px]">
            <option value="melee">Melee</option>
            <option value="ranged">Ranged</option>
            <option value="armor">Armor</option>
            <option value="misc">Misc</option>
          </select>
        </label>
        <label className="flex items-center gap-1">
          <span className="text-white/50 shrink-0">Magic</span>
          <input value={item.magicBonus ?? ""} onChange={e => onChange({ magicBonus: e.target.value })} placeholder="+1"
            className="w-10 bg-white/10 rounded px-1 text-center text-white outline-none" />
        </label>
        <label className="flex items-center gap-1">
          <span className="text-white/50 shrink-0">+Hit</span>
          <input value={item.toHit ?? ""} onChange={e => onChange({ toHit: e.target.value })} placeholder="+5"
            className="w-10 bg-white/10 rounded px-1 text-center text-white outline-none" />
        </label>
        <label className="flex items-center gap-1">
          <span className="text-white/50 shrink-0">Dmg</span>
          <input value={item.damage ?? ""} onChange={e => onChange({ damage: e.target.value })} placeholder="1d8"
            className="w-12 bg-white/10 rounded px-1 text-center text-white outline-none" />
        </label>
        <label className="flex items-center gap-1">
          <span className="text-white/50 shrink-0">DmgType</span>
          <input value={item.damageType ?? ""} onChange={e => onChange({ damageType: e.target.value })} placeholder="slsh"
            className="w-10 bg-white/10 rounded px-1 text-center text-white outline-none" />
        </label>
        <label className="flex items-center gap-1 col-span-2">
          <span className="text-white/50 shrink-0 w-8">Props</span>
          <input value={item.properties ?? ""} onChange={e => onChange({ properties: e.target.value })} placeholder="Versatile, Finesse…"
            className="flex-1 bg-white/10 rounded px-1 text-white outline-none" />
        </label>
      </div>

      {/* Notes */}
      <input
        value={item.notes ?? ""}
        onChange={e => onChange({ notes: e.target.value })}
        placeholder="Notes…"
        className="bg-transparent outline-none text-[10px] text-white/50 placeholder:text-white/20 border-t border-white/10 pt-1"
      />

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-white/10 pt-1.5">
        <button type="button" onClick={onRemove} className="text-[9px] text-red-400/60 hover:text-red-400 px-1 transition-colors">Delete</button>
        <button type="button" onClick={() => setEditing(false)} className="text-[9px] px-2.5 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors">Done</button>
      </div>
    </div>
  )
}
