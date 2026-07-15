// ════════════════════════════════════════════════════════════════════════════
// ActionEntryEditor.tsx — full edit form for one trait/action, used inside
// Edit Stat Block (see EntryListEditor in monster.tsx). Always-expanded form,
// no view/edit toggle — the modal itself is the editing context, so there's
// nothing to switch into. This is the extracted former "editing" state of
// ActionEntry.tsx, which is now display-only.
// ════════════════════════════════════════════════════════════════════════════

import type { MonsterAction, ActionCategory } from "../../monster-types"
import { MarkdownTextarea } from "../../ui/MarkdownTextarea"
import { DamageEditor } from "../ui/DamageFields"
import { NumInput } from "../ui/NumInput"
import { CATEGORY_STYLE } from "./actionCategoryStyle"

interface ActionEntryEditorProps {
  action: MonsterAction
  category: ActionCategory
  onChange: (patch: Partial<MonsterAction>) => void
  onRemove: () => void
}

export function ActionEntryEditor({ action, category, onChange, onRemove }: ActionEntryEditorProps) {
  const style = CATEGORY_STYLE[category]
  const isTrait = category === "trait"

  return (
    <div className={`rounded-xl bg-black/20 border ${style.border} p-3 flex flex-col gap-2`}>
      <div className="flex items-center gap-2">
        <input
          value={action.name}
          placeholder={isTrait ? "Trait name" : "Action name"}
          onChange={e => onChange({ name: e.target.value })}
          className={`flex-1 min-w-0 bg-transparent outline-none text-sm font-semibold ${style.text} placeholder:text-white/30 border-b border-white/10 pb-1.5`}
        />
        <button type="button" onClick={onRemove}
          className="text-xs text-red-400/60 hover:text-red-400 px-1 py-1 transition-colors shrink-0">
          Delete
        </button>
      </div>

      {!isTrait && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="flex flex-col gap-1">
            <span className="text-white/40 uppercase tracking-wider">Attack Bonus</span>
            <input value={action.attackBonus ?? ""} placeholder="+5" onChange={e => onChange({ attackBonus: e.target.value })}
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
          <div className="col-span-2">
            <DamageEditor value={action} onChange={onChange} damagePlaceholder="2d6+3" />
          </div>
        </div>
      )}

      {!isTrait && (
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
                className="bg-zinc-800 rounded px-2 py-1 text-white outline-none text-xs">
                <option value={4} className="bg-zinc-800 text-white">4-6</option>
                <option value={5} className="bg-zinc-800 text-white">5-6</option>
                <option value={6} className="bg-zinc-800 text-white">6</option>
              </select>
            </label>
          )}
          {category === "legendary" && (
            <label className="flex items-center gap-1.5 text-white/50">
              Cost
              <NumInput min={1} value={action.legendaryCost ?? 1}
                onChange={e => onChange({ legendaryCost: Math.max(1, parseInt(e.target.value) || 1) })}
                className="w-12 bg-white/10 rounded px-1.5 py-1 text-center text-white outline-none" />
            </label>
          )}
        </div>
      )}

      <MarkdownTextarea
        value={action.description ?? ""}
        onChange={v => onChange({ description: v })}
        placeholder="Description…"
        rows={3}
        className={`bg-transparent outline-none text-xs text-white/70 placeholder:text-white/20 resize-none leading-relaxed w-full ${isTrait ? "" : "border-t border-white/10 pt-2"}`}
        variant="light"
      />
    </div>
  )
}
