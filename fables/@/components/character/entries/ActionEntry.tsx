// ════════════════════════════════════════════════════════════════════════════
// ActionEntry.tsx — read-only monster action/trait card, color-coded by category
//
// Always shows: Name  [+5 atk] [2d6+3 fire] [DC 14 Dex]              [⟳5-6]
//               full description text underneath (no expand/collapse — the
//               point is you can read a whole stat block without clicking
//               through every entry one at a time).
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

import type { MonsterAction, ActionCategory } from "../../monster-types"
import { Markdown } from "../../ui/Markdown"
import { DamagePills } from "../ui/DamageFields"
import { computeDamageSegments } from "../../character-damage-types"
import { CATEGORY_STYLE } from "./actionCategoryStyle"

interface ActionEntryProps {
  action: MonsterAction
  category: ActionCategory
  onChange: (patch: Partial<MonsterAction>) => void
  readOnly?: boolean
}

export function ActionEntry({ action, category, onChange, readOnly = false }: ActionEntryProps) {
  const style = CATEGORY_STYLE[category]
  const segments = computeDamageSegments(action)

  function rollRecharge() {
    if (readOnly || !action.recharge) return
    const roll = 1 + Math.floor(Math.random() * 6)
    if (roll >= action.recharge) onChange({ rechargeUsed: false })
  }

  return (
    <div className={`rounded-xl bg-black/10 border ${style.border} px-3 py-2 flex flex-col gap-1`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
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
          <button type="button" onClick={rollRecharge} disabled={readOnly}
            title={action.rechargeUsed ? "Click to roll for recharge" : "Available"}
            className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full transition-colors ${
              action.rechargeUsed ? "bg-white/10 text-white/30" : style.badge
            }`}>
            ⟳ {action.recharge >= 6 ? "6" : `${action.recharge}-6`}
          </button>
        )}
      </div>

      {action.description && <Markdown text={action.description} tone="dark" />}
    </div>
  )
}
