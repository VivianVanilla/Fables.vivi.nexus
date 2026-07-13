// ════════════════════════════════════════════════════════════════════════════
// DamageFields.tsx — shared "multiple damage types" editor + read-only pills,
// used anywhere something deals damage (monster actions, weapons, items).
//
// Most things deal one instance of damage, so the default is the classic single
// damage/damageType pair. Toggling "Multiple Damage Types" on switches to a
// repeatable list (`damages`) — e.g. a flaming sword is "1d8 Slashing" (the
// primary pair) plus a "1d6 Fire" row. Toggling back off folds the first row
// back into the single pair so nothing already typed is lost either way.
// ════════════════════════════════════════════════════════════════════════════

import type { DamageEntry } from "../../character-types"
import { damageTypeClasses, DAMAGE_TYPES, type DamageSegment } from "../../character-damage-types"
import { nanoid } from "../../character-utils"

export interface MultiDamageFields {
  damage?: string
  damageType?: string
  multiDamage?: boolean
  damages?: DamageEntry[]
}

// Read-only colored pills — one per damage instance. Returns a Fragment of
// sibling <span>s so it drops straight into an existing flex-wrap tag row.
export function DamagePills({ segments, size = "sm" }: { segments: DamageSegment[]; size?: "xs" | "sm" | "lg" }) {
  const sizeCls = size === "xs" ? "text-[10px] px-1.5 py-0.5" : size === "lg" ? "text-sm px-3 py-1.5 font-medium" : "text-xs px-1.5 py-0.5"
  return (
    <>
      {segments.map((s, i) => (
        <span key={i} className={`${sizeCls} rounded-full ${damageTypeClasses(s.damageType)}`}>
          {s.text}{s.damageType ? ` ${s.damageType}` : ""}
        </span>
      ))}
    </>
  )
}

const FIELD_LABEL = "text-white/40 uppercase tracking-wider text-xs"
const FIELD_INPUT = "bg-white/10 rounded-lg px-2.5 py-1.5 text-white outline-none placeholder:text-white/20 text-sm"
const FIELD_SELECT = "bg-zinc-800 rounded-lg px-2.5 py-1.5 text-white outline-none text-sm"

export function DamageEditor({ value, onChange, damagePlaceholder = "2d6" }: {
  value: MultiDamageFields
  onChange: (patch: Partial<MultiDamageFields>) => void
  damagePlaceholder?: string
}) {
  const rows = value.damages ?? []

  function enableMulti() {
    const seeded = rows.length > 0 ? rows : [{ id: nanoid(), damage: value.damage ?? "", damageType: value.damageType }]
    onChange({ multiDamage: true, damages: seeded })
  }
  function disableMulti() {
    const first = rows[0]
    onChange({ multiDamage: false, damage: first?.damage ?? value.damage ?? "", damageType: first?.damageType ?? value.damageType })
  }
  function addRow() {
    onChange({ damages: [...rows, { id: nanoid(), damage: "", damageType: undefined }] })
  }
  function changeRow(id: string, patch: Partial<DamageEntry>) {
    onChange({ damages: rows.map(r => r.id === id ? { ...r, ...patch } : r) })
  }
  function removeRow(id: string) {
    onChange({ damages: rows.filter(r => r.id !== id) })
  }

  return (
    <div className="flex flex-col gap-2">
      {!value.multiDamage ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className={FIELD_LABEL}>Damage</span>
            <input value={value.damage ?? ""} placeholder={damagePlaceholder} onChange={e => onChange({ damage: e.target.value })}
              className={FIELD_INPUT} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={FIELD_LABEL}>Damage Type</span>
            <select value={value.damageType ?? ""} onChange={e => onChange({ damageType: e.target.value || undefined })}
              className={FIELD_SELECT}>
              <option value="" className="bg-zinc-800 text-white">—</option>
              {DAMAGE_TYPES.map(t => <option key={t} value={t} className="bg-zinc-800 text-white">{t}</option>)}
            </select>
          </label>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {rows.map(r => (
            <div key={r.id} className="flex items-center gap-1.5">
              <input value={r.damage} placeholder={damagePlaceholder} onChange={e => changeRow(r.id, { damage: e.target.value })}
                className={`flex-1 min-w-0 ${FIELD_INPUT}`} />
              <select value={r.damageType ?? ""} onChange={e => changeRow(r.id, { damageType: e.target.value || undefined })}
                className={`shrink-0 ${FIELD_SELECT}`}>
                <option value="" className="bg-zinc-800 text-white">—</option>
                {DAMAGE_TYPES.map(t => <option key={t} value={t} className="bg-zinc-800 text-white">{t}</option>)}
              </select>
              <button type="button" onClick={() => removeRow(r.id)} disabled={rows.length <= 1}
                className="shrink-0 text-white/30 hover:text-red-400 disabled:opacity-20 disabled:hover:text-white/30 transition-colors px-1" title="Remove">✕</button>
            </div>
          ))}
          <button type="button" onClick={addRow}
            className="self-start text-xs text-white/40 hover:text-white transition-colors">+ Add Damage</button>
        </div>
      )}
      <label className="flex items-center gap-1.5 text-xs text-white/50 cursor-pointer select-none">
        <input type="checkbox" checked={value.multiDamage ?? false} onChange={e => e.target.checked ? enableMulti() : disableMulti()} />
        Multiple Damage Types
      </label>
    </div>
  )
}
