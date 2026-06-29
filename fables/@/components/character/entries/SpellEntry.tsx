// ════════════════════════════════════════════════════════════════════════════
// SpellEntry.tsx — collapsible spell card with full field edit form
// ════════════════════════════════════════════════════════════════════════════

import { useState } from "react"
import type { SpellItem } from "../../character-types"
import type { Theme } from "../../character-themes"

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
        refId: spell.id,
        refType: "spell",
        label: spell.name || "Spell",
      }))
      e.dataTransfer.effectAllowed = "copy"
    },
  }

  // ── View mode ────────────────────────────────────────────────────────────

  if (!editing) {
    return (
      <div {...dragAttrs} className={`rounded-lg ${theme.box} border border-white/10 px-3 py-2 flex items-center gap-2`}>

        {/* Prepared indicator */}
        <button
          type="button"
          disabled={readOnly}
          onClick={() => onChange({ prepared: !spell.prepared })}
          title={
            spell.alwaysPrepared ? "Always prepared"
            : spell.prepared     ? "Prepared — click to unprepare"
            :                      "Unprepared — click to prepare"
          }
          className={`size-3 rounded-full border-2 shrink-0 transition-colors ${
            spell.alwaysPrepared ? "bg-primary/50 border-primary/50"
            : spell.prepared     ? "bg-primary border-primary"
            :                      "border-white/30 bg-transparent hover:border-white/50"
          }`}
        />

        {/* Name + tags */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-xs font-semibold text-white truncate">
              {spell.name || <span className="text-white/30 italic">Unnamed</span>}
            </p>
            {spell.ritual && (
              <span className="text-[8px] border border-amber-400/40 text-amber-400/80 rounded px-0.5 leading-tight shrink-0">R</span>
            )}
          </div>
          <div className="flex gap-1 mt-0.5 flex-wrap">
            {spell.level !== undefined && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/60">Lv {spell.level}</span>
            )}
            {spell.school && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/45 italic">{spell.school}</span>
            )}
            {(spell.saveAttr || spell.saveType) && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-300/80">
                Save {spell.saveAttr || spell.saveType}
              </span>
            )}
            {spell.toHit && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/60">{spell.toHit} atk</span>
            )}
            {spell.damage && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-300/80">
                {spell.damage}{spell.damageType ? ` ${spell.damageType}` : ""}
              </span>
            )}
            {spell.castTime && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/45">{spell.castTime}</span>
            )}
            {spell.range && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/45">{spell.range}</span>
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
        value={spell.name}
        onChange={e => onChange({ name: e.target.value })}
        autoFocus
        placeholder="Spell name"
        className={`bg-transparent outline-none text-xs font-semibold ${theme.color} placeholder:text-white/40 border-b border-white/10 pb-1`}
      />

      {/* Field grid */}
      <div className="grid grid-cols-3 gap-1.5 text-[10px]">
        <label className="flex items-center gap-1">
          <span className="text-white/50 shrink-0">Lvl</span>
          <input type="number" value={spell.level ?? ""} onChange={e => onChange({ level: parseInt(e.target.value) || 0 })} placeholder="0"
            className="w-8 bg-white/10 rounded px-1 text-center text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
        </label>
        <label className="flex items-center gap-1">
          <span className="text-white/50 shrink-0">Sch</span>
          <input value={spell.school ?? ""} onChange={e => onChange({ school: e.target.value })} placeholder="Evocation"
            className="flex-1 bg-white/10 rounded px-1 text-white outline-none" />
        </label>
        <label className="flex items-center gap-1">
          <span className="text-white/50 shrink-0">Atk</span>
          <input value={spell.toHit ?? ""} onChange={e => onChange({ toHit: e.target.value })} placeholder="+5"
            className="w-10 bg-white/10 rounded px-1 text-center text-white outline-none" />
        </label>
        <label className="flex items-center gap-1">
          <span className="text-white/50 shrink-0">Save</span>
          <input value={spell.saveAttr ?? ""} onChange={e => onChange({ saveAttr: e.target.value })} placeholder="Dex"
            className="w-10 bg-white/10 rounded px-1 text-center text-white outline-none" />
        </label>
        <label className="flex items-center gap-1">
          <span className="text-white/50 shrink-0">Dmg</span>
          <input value={spell.damage ?? ""} onChange={e => onChange({ damage: e.target.value })} placeholder="8d6"
            className="w-12 bg-white/10 rounded px-1 text-white outline-none" />
        </label>
        <label className="flex items-center gap-1">
          <span className="text-white/50 shrink-0">Type</span>
          <input value={spell.damageType ?? ""} onChange={e => onChange({ damageType: e.target.value })} placeholder="Fire"
            className="flex-1 bg-white/10 rounded px-1 text-white outline-none" />
        </label>
        <label className="flex items-center gap-1">
          <span className="text-white/50 shrink-0">Cast</span>
          <input value={spell.castTime ?? ""} onChange={e => onChange({ castTime: e.target.value })} placeholder="1 action"
            className="flex-1 bg-white/10 rounded px-1 text-white outline-none" />
        </label>
        <label className="flex items-center gap-1">
          <span className="text-white/50 shrink-0">Rng</span>
          <input value={spell.range ?? ""} onChange={e => onChange({ range: e.target.value })} placeholder="60ft"
            className="flex-1 bg-white/10 rounded px-1 text-white outline-none" />
        </label>
        <label className="flex items-center gap-1">
          <span className="text-white/50 shrink-0">Dur</span>
          <input value={spell.duration ?? ""} onChange={e => onChange({ duration: e.target.value })} placeholder="Instant"
            className="flex-1 bg-white/10 rounded px-1 text-white outline-none" />
        </label>
        <label className="flex items-center gap-1 col-span-2">
          <span className="text-white/50 shrink-0 w-8">Comp</span>
          <input value={spell.components ?? ""} onChange={e => onChange({ components: e.target.value })} placeholder="V, S, M"
            className="flex-1 bg-white/10 rounded px-1 text-white outline-none" />
        </label>
        <div />
        <label className="flex items-center gap-1 col-span-3">
          <span className="text-white/50 shrink-0 w-8">Mat</span>
          <input value={spell.materialComponents ?? ""} onChange={e => onChange({ materialComponents: e.target.value })} placeholder="Material components…"
            className="flex-1 bg-white/10 rounded px-1 text-white outline-none" />
        </label>
      </div>

      {/* Checkboxes */}
      <div className="flex items-center gap-3 text-[10px] text-white/60">
        <label className="flex items-center gap-1 cursor-pointer">
          <input type="checkbox" checked={spell.prepared ?? false} onChange={e => onChange({ prepared: e.target.checked })} />
          Prepared
        </label>
        <label className="flex items-center gap-1 cursor-pointer">
          <input type="checkbox" checked={spell.alwaysPrepared ?? false} onChange={e => onChange({ alwaysPrepared: e.target.checked })} />
          Always Prepared
        </label>
        <label className="flex items-center gap-1 cursor-pointer">
          <input type="checkbox" checked={spell.ritual ?? false} onChange={e => onChange({ ritual: e.target.checked })} />
          Ritual
        </label>
      </div>

      {/* Description */}
      <textarea
        value={spell.notes ?? ""}
        onChange={e => onChange({ notes: e.target.value })}
        placeholder="Description…"
        rows={2}
        className="bg-transparent outline-none text-[10px] text-white/50 placeholder:text-white/20 border-t border-white/10 pt-1 resize-none"
      />

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-white/10 pt-1.5">
        <button type="button" onClick={onRemove} className="text-[9px] text-red-400/60 hover:text-red-400 px-1 transition-colors">Delete</button>
        <button type="button" onClick={() => setEditing(false)} className="text-[9px] px-2.5 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors">Done</button>
      </div>
    </div>
  )
}
