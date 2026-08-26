// ════════════════════════════════════════════════════════════════════════════
// ActionEntry.tsx — read-only monster action/trait card, color-coded by category
//
// Always shows: Name  [+5 atk] [2d6+3 fire] [DC 14 Dex]              [⟳5-6]
//               full description text underneath — unless the monster has
//               "Collapsible abilities" on (Edit Stat Block → Display), in
//               which case the description starts hidden and clicking the
//               name row toggles it, for a denser read on a big stat block.
//
// Adding, editing, and deleting entries all happen in Edit Stat Block
// instead (see ActionEntryEditor.tsx, used there) — this component has no
// edit affordance at all, the recharge badge is the only interactive bit,
// and it's a real gameplay action (rolling to recover the ability), not content editing.
//
// Traits (category "trait") are passive features, not attacks — they skip the
// attack bonus/damage/save/recharge/cost fields entirely and are just a name
// + description.
// ════════════════════════════════════════════════════════════════════════════

import { useState } from "react"
import type { MonsterAction, ActionCategory } from "@/components/shared/monster/monster-types"
import { Markdown } from "../../ui/Markdown"
import { DamagePills } from "../ui/DamageFields"
import { computeDamageSegments } from "@/components/shared/damageTypes"
import { CATEGORY_STYLE, CATEGORY_HEX } from "./actionCategoryStyle"
import { TracingSlider } from "../../ui/tracing-slider"

interface ActionEntryProps {
  action: MonsterAction
  category: ActionCategory
  onChange: (patch: Partial<MonsterAction>) => void
  readOnly?: boolean
  collapsible?: boolean
}

export function ActionEntry({ action, category, onChange, readOnly = false, collapsible = false }: ActionEntryProps) {
  const style = CATEGORY_STYLE[category]
  const segments = computeDamageSegments(action)
  const [expanded, setExpanded] = useState(false)
  const showDescription = !!action.description && (!collapsible || expanded)

  const effectiveMax  = action.maxUses ?? 0
  const usesUsed      = action.usesUsed ?? 0
  const usesRemaining = Math.max(0, effectiveMax - usesUsed)
  const hasUses       = !!(action.trackable && effectiveMax > 0)

  function rollRecharge() {
    if (readOnly || !action.recharge) return
    const roll = 1 + Math.floor(Math.random() * 6)
    if (roll >= action.recharge) onChange({ rechargeUsed: false })
  }

  return (
    <div className={`rounded-xl bg-black/10 border ${style.border} px-3 py-2 flex flex-col gap-1`}>
      <div
        className={`flex items-start justify-between gap-2 ${collapsible && action.description ? "cursor-pointer" : ""}`}
        onClick={collapsible && action.description ? () => setExpanded(v => !v) : undefined}
      >
        <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
          {collapsible && action.description && (
            <span className={`text-[10px] text-white/30 transition-transform shrink-0 ${expanded ? "rotate-90" : ""}`}>▸</span>
          )}
          <span className={`text-sm font-semibold ${style.text}`}>
            {action.name || <span className="text-white/30 italic">Unnamed</span>}
          </span>
          {category === "legendary" && (action.legendaryCost ?? 1) > 1 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/50">Costs {action.legendaryCost}</span>
          )}
          {action.attackBonus && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/60">{action.attackBonus} to hit</span>
          )}
          <DamagePills segments={segments} size="xs" />
          {(action.saveAbility || action.saveDC != null) && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-300/80">
              {action.saveAbility ?? ""} {action.saveDC != null ? `DC ${action.saveDC}` : ""}
            </span>
          )}
        </div>

        {action.recharge != null && (
          <button type="button" onClick={e => { e.stopPropagation(); rollRecharge() }} disabled={readOnly}
            title={action.rechargeUsed ? "Click to roll for recharge" : "Available"}
            className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full transition-colors ${
              action.rechargeUsed ? "bg-white/10 text-white/30" : style.badge
            }`}>
            ⟳ {action.recharge >= 6 ? "6" : `${action.recharge}-6`}
          </button>
        )}
      </div>

      {hasUses && (
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {action.trackerLabel && <span className="text-[10px] text-white/40 shrink-0 max-w-20 truncate">{action.trackerLabel}</span>}
          <TracingSlider
            value={usesRemaining} max={effectiveMax}
            disabled={readOnly}
            color={CATEGORY_HEX[category]}
            showButtons buttonSize="sm" className="flex-1 min-w-0"
            onChange={val => onChange({ usesUsed: effectiveMax - val })}
          />
          <span className="text-xs text-white/50 shrink-0 tabular-nums w-8 text-right">
            {usesRemaining}/{effectiveMax}
          </span>
        </div>
      )}

      {showDescription && <Markdown text={action.description!} tone="dark" />}
    </div>
  )
}
