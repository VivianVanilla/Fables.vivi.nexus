// ════════════════════════════════════════════════════════════════════════════
// ActionEntry.tsx — collapsible monster action card, color-coded by category
//
// Collapsed: ▶ Name  [+5 atk] [2d6+3 fire] [DC 14 Dex]              [⟳5-6]
// Expanded adds description text + edit controls below the header row.
// Recharge badge is clickable (when not readOnly) — rolls 1d6, clears
// rechargeUsed on a 5-6 hit.
// ════════════════════════════════════════════════════════════════════════════

import { useState } from "react"
import type { MonsterAction, ActionCategory } from "../../monster-types"
import { MarkdownTextarea } from "../../ui/MarkdownTextarea"
import { Markdown } from "../../ui/Markdown"

const CATEGORY_STYLE: Record<ActionCategory, { border: string; text: string; badge: string; ring: string }> = {
  action:      { border: "border-sky-500/30",    text: "text-sky-300",    badge: "bg-sky-500/15 text-sky-300",    ring: "focus:ring-sky-400/40" },
  bonusAction: { border: "border-amber-500/30",   text: "text-amber-300", badge: "bg-amber-500/15 text-amber-300", ring: "focus:ring-amber-400/40" },
  reaction:    { border: "border-violet-500/30",  text: "text-violet-300",badge: "bg-violet-500/15 text-violet-300", ring: "focus:ring-violet-400/40" },
  legendary:   { border: "border-yellow-400/30",  text: "text-yellow-300",badge: "bg-yellow-500/15 text-yellow-300", ring: "focus:ring-yellow-400/40" },
}

interface ActionEntryProps {
  action: MonsterAction
  category: ActionCategory
  onChange: (patch: Partial<MonsterAction>) => void
  onRemove: () => void
  readOnly?: boolean
}

export function ActionEntry({ action, category, onChange, onRemove, readOnly = false }: ActionEntryProps) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const style = CATEGORY_STYLE[category]

  function rollRecharge(e: React.MouseEvent) {
    e.stopPropagation()
    if (readOnly || !action.recharge) return
    const roll = 1 + Math.floor(Math.random() * 6)
    if (roll >= action.recharge) onChange({ rechargeUsed: false })
  }

  // ── Edit mode ────────────────────────────────────────────────────────────

  if (editing) {
    return (
      <div className={`rounded-xl bg-black/20 border ${style.border} p-3 flex flex-col gap-2`}>
        <input
          value={action.name}
          autoFocus
          placeholder="Action name"
          onChange={e => onChange({ name: e.target.value })}
          className={`w-full bg-transparent outline-none text-sm font-semibold ${style.text} placeholder:text-white/30 border-b border-white/10 pb-1.5`}
        />

        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="flex flex-col gap-1">
            <span className="text-white/40 uppercase tracking-wider">Attack Bonus</span>
            <input value={action.attackBonus ?? ""} placeholder="+5" onChange={e => onChange({ attackBonus: e.target.value })}
              className="bg-white/10 rounded-lg px-2 py-1.5 text-white outline-none placeholder:text-white/20" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-white/40 uppercase tracking-wider">Damage</span>
            <input value={action.damage ?? ""} placeholder="2d6+3" onChange={e => onChange({ damage: e.target.value })}
              className="bg-white/10 rounded-lg px-2 py-1.5 text-white outline-none placeholder:text-white/20" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-white/40 uppercase tracking-wider">Damage Type</span>
            <input value={action.damageType ?? ""} placeholder="Fire" onChange={e => onChange({ damageType: e.target.value })}
              className="bg-white/10 rounded-lg px-2 py-1.5 text-white outline-none placeholder:text-white/20" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-white/40 uppercase tracking-wider">Save</span>
            <div className="flex gap-1">
              <input value={action.saveAbility ?? ""} placeholder="Dex" onChange={e => onChange({ saveAbility: e.target.value })}
                className="w-14 bg-white/10 rounded-lg px-2 py-1.5 text-white outline-none placeholder:text-white/20" />
              <input type="number" value={action.saveDC ?? ""} placeholder="DC" onChange={e => onChange({ saveDC: e.target.value ? parseInt(e.target.value) || 0 : undefined })}
                className="w-14 bg-white/10 rounded-lg px-2 py-1.5 text-white outline-none placeholder:text-white/20 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
            </div>
          </label>
        </div>

        <div className="flex items-center gap-3 text-xs flex-wrap border-t border-white/10 pt-2">
          <label className="flex items-center gap-1.5 text-white/50 cursor-pointer select-none">
            <input type="checkbox" checked={action.recharge != null}
              onChange={e => onChange({ recharge: e.target.checked ? 6 : undefined, rechargeUsed: e.target.checked ? false : undefined })} />
            Recharge
          </label>
          {action.recharge != null && (
            <label className="flex items-center gap-1.5 text-white/50">
              on
              <select value={action.recharge} onChange={e => onChange({ recharge: parseInt(e.target.value) })}
                className="bg-black/30 rounded px-2 py-1 text-white outline-none text-xs">
                <option value={4}>4-6</option>
                <option value={5}>5-6</option>
                <option value={6}>6</option>
              </select>
            </label>
          )}
          {category === "legendary" && (
            <label className="flex items-center gap-1.5 text-white/50">
              Cost
              <input type="number" min={1} value={action.legendaryCost ?? 1}
                onChange={e => onChange({ legendaryCost: Math.max(1, parseInt(e.target.value) || 1) })}
                className="w-12 bg-white/10 rounded px-1.5 py-1 text-center text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
            </label>
          )}
        </div>

        <MarkdownTextarea
          value={action.description ?? ""}
          onChange={v => onChange({ description: v })}
          placeholder="Description…"
          rows={4}
          className="bg-transparent outline-none text-xs text-white/70 placeholder:text-white/20 resize-none leading-relaxed border-t border-white/10 pt-2 w-full"
          variant="light"
        />

        <div className="flex items-center justify-between border-t border-white/10 pt-2">
          <button type="button" onClick={onRemove} className="text-xs text-red-400/60 hover:text-red-400 px-1 py-1 transition-colors">Delete</button>
          <button type="button" onClick={() => setEditing(false)} className="text-xs px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors">Done</button>
        </div>
      </div>
    )
  }

  // ── View mode ────────────────────────────────────────────────────────────

  return (
    <div className={`rounded-xl bg-black/10 border ${style.border} overflow-hidden`}>
      <div className="flex items-start gap-2 px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors select-none"
        onClick={() => setExpanded(v => !v)}>
        <span className="text-[10px] text-white/30 shrink-0 w-3 mt-0.5">{expanded ? "▼" : "▶"}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-sm font-semibold ${style.text}`}>
              {action.name || <span className="text-white/30 italic">Unnamed</span>}
            </span>
            {category === "legendary" && (action.legendaryCost ?? 1) > 1 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/50">Costs {action.legendaryCost}</span>
            )}
            {action.attackBonus && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/60">{action.attackBonus} to hit</span>
            )}
            {action.damage && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-300/80">
                {action.damage}{action.damageType ? ` ${action.damageType}` : ""}
              </span>
            )}
            {(action.saveAbility || action.saveDC != null) && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-300/80">
                {action.saveAbility ?? ""} {action.saveDC != null ? `DC ${action.saveDC}` : ""}
              </span>
            )}
          </div>
        </div>

        {action.recharge != null && (
          <button type="button" onClick={rollRecharge} disabled={readOnly}
            title={action.rechargeUsed ? "Click to roll for recharge" : "Available"}
            className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full transition-colors ${
              action.rechargeUsed ? "bg-white/10 text-white/30" : style.badge
            }`}>
            ⟳ {action.recharge >= 6 ? "6" : `${action.recharge}-6`}
          </button>
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-3 border-t border-white/5 flex flex-col gap-2">
          <div className="flex items-center justify-end gap-1 mt-2">
            {!readOnly && (
              <button type="button" onClick={() => setEditing(true)}
                className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/70 hover:text-white text-sm shrink-0 transition-colors">
                ✎
              </button>
            )}
          </div>
          {action.description ? (
            <Markdown text={action.description} tone="dark" />
          ) : !readOnly ? (
            <p className="text-xs text-white/20 italic">No description — click ✎ to add one.</p>
          ) : null}
        </div>
      )}
    </div>
  )
}
