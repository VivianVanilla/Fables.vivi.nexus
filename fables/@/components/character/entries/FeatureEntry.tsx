// ════════════════════════════════════════════════════════════════════════════
// FeatureEntry.tsx — Adventurer's Codex-style collapsible feature card
//
// View:  ▶ Feature Name   [Source]  ●●○ LR  [✎]
//        ▼ Feature Name   [Source]  ●●○ LR  [✎]
//             Description text...
//
// Edit:  Name, Source, Description, Track uses (max + resets on)
// ════════════════════════════════════════════════════════════════════════════

import { useState } from "react"
import type { Feature } from "../../character-types"
import type { Theme } from "../../character-themes"

// ── Types ─────────────────────────────────────────────────────────────────────

interface FeatureEntryProps {
  feature: Feature
  onChange: (patch: Partial<Feature>) => void
  onRemove: () => void
  theme: Theme
  readOnly?: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resetLabel(r?: Feature["resetsOn"]): string {
  if (r === "short") return "SR"
  if (r === "dawn")  return "Dawn"
  return "LR"
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FeatureEntry({ feature, onChange, onRemove, theme, readOnly = false }: FeatureEntryProps) {
  const [expanded, setExpanded] = useState(false)
  const [editing,  setEditing]  = useState(false)

  const maxUses      = feature.maxUses  ?? 0
  const usesUsed     = feature.usesUsed ?? 0
  const usesRemaining = Math.max(0, maxUses - usesUsed)
  const hasUses      = !!(feature.trackable && maxUses > 0)

  // ── Drag source (header only) ────────────────────────────────────────────

  const dragAttrs = readOnly ? {} : {
    draggable: true as const,
    onDragStart(e: React.DragEvent) {
      e.dataTransfer.setData("x-fable-ref", JSON.stringify({
        refId:   feature.id,
        refType: "feature",
        label:   feature.name || "Feature",
      }))
      e.dataTransfer.effectAllowed = "copy"
    },
  }

  // ── Edit mode ────────────────────────────────────────────────────────────

  if (editing) {
    return (
      <div className={`rounded-lg ${theme.box} border border-white/20 p-2.5 flex flex-col gap-1.5`}>

        {/* Name */}
        <input
          value={feature.name}
          onChange={e => onChange({ name: e.target.value })}
          autoFocus
          placeholder="Feature name"
          className={`bg-transparent outline-none text-xs font-semibold ${theme.color} placeholder:text-white/30 border-b border-white/10 pb-1`}
        />

        {/* Source */}
        <input
          value={feature.source ?? ""}
          onChange={e => onChange({ source: e.target.value })}
          placeholder="Source (e.g. Fighter 1, Variant Human…)"
          className="bg-transparent outline-none text-[10px] text-white/50 placeholder:text-white/20"
        />

        {/* Description */}
        <textarea
          value={feature.description ?? ""}
          onChange={e => onChange({ description: e.target.value })}
          placeholder="Description…"
          rows={4}
          className="bg-transparent outline-none text-[10px] text-white/60 placeholder:text-white/20 resize-none leading-relaxed border-t border-white/10 pt-1.5"
        />

        {/* Use tracking toggle */}
        <div className="border-t border-white/10 pt-1.5 flex flex-col gap-1.5">
          <label className="flex items-center gap-2 text-[10px] text-white/60 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={feature.trackable ?? false}
              onChange={e => onChange({ trackable: e.target.checked })}
            />
            Track uses
          </label>

          {feature.trackable && (
            <div className="flex items-center gap-3 text-[10px]">
              <label className="flex items-center gap-1 text-white/50">
                Max
                <input
                  type="number"
                  value={feature.maxUses ?? ""}
                  onChange={e => onChange({ maxUses: parseInt(e.target.value) || 0 })}
                  className="w-10 bg-white/10 rounded px-1 text-center text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </label>
              <label className="flex items-center gap-1 text-white/50">
                Resets on
                <select
                  value={feature.resetsOn ?? "long"}
                  onChange={e => onChange({ resetsOn: e.target.value as Feature["resetsOn"] })}
                  className="bg-white/10 rounded px-1 py-0.5 text-white outline-none text-[10px]"
                >
                  <option value="short">Short Rest</option>
                  <option value="long">Long Rest</option>
                  <option value="dawn">Dawn</option>
                </select>
              </label>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-white/10 pt-1.5">
          <button type="button" onClick={onRemove} className="text-[9px] text-red-400/60 hover:text-red-400 px-1 transition-colors">
            Delete
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-[9px] px-2.5 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors">
            Done
          </button>
        </div>
      </div>
    )
  }

  // ── View mode ────────────────────────────────────────────────────────────

  return (
    <div className={`rounded-lg ${theme.box} border border-white/10 overflow-hidden`}>

      {/* Header row — drag handle + expand + pips + edit */}
      <div
        {...dragAttrs}
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors select-none"
        onClick={() => setExpanded(v => !v)}
      >
        {/* Expand caret */}
        <span className="text-[8px] text-white/30 shrink-0 w-3">{expanded ? "▼" : "▶"}</span>

        {/* Feature name */}
        <span className="text-xs font-semibold text-white flex-1 truncate min-w-0">
          {feature.name || <span className="text-white/30 italic">Unnamed</span>}
        </span>

        {/* Source badge */}
        {feature.source && (
          <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/40 shrink-0 max-w-20 truncate">
            {feature.source}
          </span>
        )}

        {/* Use pips — filled = available, empty = spent */}
        {hasUses && (
          <div className="flex items-center gap-0.5 shrink-0">
            {Array.from({ length: maxUses }).map((_, i) => {
              const available = i < usesRemaining
              return (
                <button
                  key={i}
                  type="button"
                  disabled={readOnly}
                  onClick={e => {
                    e.stopPropagation()
                    if (available) onChange({ usesUsed: usesUsed + 1 })
                    else           onChange({ usesUsed: Math.max(0, usesUsed - 1) })
                  }}
                  title={available ? "Click to use" : "Click to recover"}
                  className={`size-2.5 rounded-full border transition-colors disabled:pointer-events-none ${
                    available
                      ? "bg-primary/70 border-primary/60 hover:bg-red-500/60 hover:border-red-400/50"
                      : "bg-transparent border-white/20 hover:bg-green-900/40 hover:border-green-400/30"
                  }`}
                />
              )
            })}
            <span className="text-[8px] text-white/30 ml-1">{resetLabel(feature.resetsOn)}</span>
          </div>
        )}

        {/* Edit button */}
        {!readOnly && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setEditing(true) }}
            className="size-5 flex items-center justify-center rounded hover:bg-white/10 text-white/20 hover:text-white/60 text-[10px] shrink-0 transition-colors"
          >
            ✎
          </button>
        )}
      </div>

      {/* Expanded: description */}
      {expanded && feature.description && (
        <div className="px-7 pb-3 border-t border-white/5">
          <p className="text-[10px] text-white/50 leading-relaxed mt-2 whitespace-pre-wrap">
            {feature.description}
          </p>
        </div>
      )}

      {/* Expanded: empty state */}
      {expanded && !feature.description && (
        <div className="px-7 pb-2 border-t border-white/5">
          <p className="text-[9px] text-white/20 italic mt-1.5">No description — click ✎ to add one.</p>
        </div>
      )}
    </div>
  )
}
