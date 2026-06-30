// ════════════════════════════════════════════════════════════════════════════
// FeatureEntry.tsx — Adventurer's Codex-style collapsible feature card
//
// Collapsed: ▶ Feature Name  [Source]  2/3 LR  [✎]
// Expanded:  ▼ Feature Name  [Source]       [✎]
//                Description text...
//                [────────────────] slider  2/3 · LR
// Edit mode: name, source, description, track uses, max, resets
// ════════════════════════════════════════════════════════════════════════════

import { useState } from "react"
import type { Feature } from "../../character-types"
import type { Theme } from "../../character-themes"
import { TracingSlider } from "../../ui/tracing-slider"

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

  const maxUses       = feature.maxUses  ?? 0
  const usesUsed      = feature.usesUsed ?? 0
  const usesRemaining = Math.max(0, maxUses - usesUsed)
  const hasUses       = !!(feature.trackable && maxUses > 0)

  // ── Drag source ──────────────────────────────────────────────────────────

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
      <div className={`rounded-xl ${theme.box} border border-white/20 p-3 flex flex-col gap-2`}>

        <input
          value={feature.name}
          onChange={e => onChange({ name: e.target.value })}
          autoFocus
          placeholder="Feature name"
          className={`bg-transparent outline-none text-sm font-semibold ${theme.color} placeholder:text-white/30 border-b border-white/10 pb-1.5`}
        />
        <input
          value={feature.source ?? ""}
          onChange={e => onChange({ source: e.target.value })}
          placeholder="Source (e.g. Fighter 1, Variant Human…)"
          className="bg-transparent outline-none text-xs text-white/60 placeholder:text-white/20"
        />
        <textarea
          value={feature.description ?? ""}
          onChange={e => onChange({ description: e.target.value })}
          placeholder="Description…"
          rows={5}
          className="bg-transparent outline-none text-xs text-white/70 placeholder:text-white/20 resize-none leading-relaxed border-t border-white/10 pt-2"
        />

        {/* Use tracking */}
        <div className="border-t border-white/10 pt-2 flex flex-col gap-2">
          <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={feature.trackable ?? false}
              onChange={e => onChange({ trackable: e.target.checked })}
            />
            Track uses
          </label>
          {feature.trackable && (
            <div className="flex items-center gap-3 text-xs flex-wrap">
              <label className="flex items-center gap-1.5 text-white/50">
                Max
                <input
                  type="number"
                  value={feature.maxUses ?? ""}
                  onChange={e => onChange({ maxUses: parseInt(e.target.value) || 0 })}
                  className="w-12 bg-white/10 rounded px-2 py-1 text-center text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </label>
              <label className="flex items-center gap-1.5 text-white/50">
                Resets on
                <select
                  value={feature.resetsOn ?? "long"}
                  onChange={e => onChange({ resetsOn: e.target.value as Feature["resetsOn"] })}
                  className="bg-white/10 rounded px-2 py-1 text-white outline-none text-xs"
                >
                  <option value="short">Short Rest</option>
                  <option value="long">Long Rest</option>
                  <option value="dawn">Dawn</option>
                  <option value="manual">Manual</option>
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-white/50 cursor-pointer">
                Bar color
                <input
                  type="color"
                  value={feature.sliderColor ?? "#6366f1"}
                  onChange={e => onChange({ sliderColor: e.target.value })}
                  className="size-4 cursor-pointer rounded border-0 bg-transparent p-0"
                />
              </label>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-white/10 pt-2">
          <button type="button" onClick={onRemove} className="text-xs text-red-400/60 hover:text-red-400 px-1 py-1 transition-colors">Delete</button>
          <button type="button" onClick={() => setEditing(false)} className="text-xs px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors">Done</button>
        </div>
      </div>
    )
  }

  // ── View mode ────────────────────────────────────────────────────────────

  return (
    <div className={`rounded-xl ${theme.box} border border-white/10 overflow-hidden`}>

      {/* Header row */}
      <div
        {...dragAttrs}
        className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-white/5 transition-colors select-none min-h-11"
        onClick={() => setExpanded(v => !v)}
      >
        <span className="text-[10px] text-white/30 shrink-0 w-3">{expanded ? "▼" : "▶"}</span>

        <span className="text-sm font-semibold text-white flex-1 truncate min-w-0">
          {feature.name || <span className="text-white/30 italic">Unnamed</span>}
        </span>

        {/* Source badge */}
        {feature.source && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/50 shrink-0 max-w-24 truncate">
            {feature.source}
          </span>
        )}

        {/* Compact use count when collapsed */}
        {hasUses && !expanded && (
          <span className="text-xs text-white/50 shrink-0 tabular-nums">
            {usesRemaining}/{maxUses} <span className="text-white/30">{resetLabel(feature.resetsOn)}</span>
          </span>
        )}

        {/* Edit button */}
        {!readOnly && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setEditing(true) }}
            className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/70 hover:text-white text-sm shrink-0 transition-colors"
          >
            ✎
          </button>
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-3 border-t border-white/5 flex flex-col gap-3">

          {/* Description */}
          {feature.description ? (
            <p className="text-sm text-white/60 leading-relaxed mt-2 whitespace-pre-wrap">
              {feature.description}
            </p>
          ) : !readOnly ? (
            <p className="text-xs text-white/20 italic mt-2">No description — click ✎ to add one.</p>
          ) : null}

          {/* Tracking slider */}
          {hasUses && (
            <TracingSlider
              value={usesRemaining}
              max={maxUses}
              disabled={readOnly}
              color={feature.sliderColor}
              showButtons
              showLabel
              label={`${usesRemaining} / ${maxUses} uses remaining`}
              labelRight={resetLabel(feature.resetsOn)}
              onChange={val => onChange({ usesUsed: maxUses - val })}
            />
          )}
        </div>
      )}
    </div>
  )
}
