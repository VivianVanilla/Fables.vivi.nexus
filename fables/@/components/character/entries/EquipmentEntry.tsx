// ════════════════════════════════════════════════════════════════════════════
// EquipmentEntry.tsx — compact equipment row + modal edit form + detail expand
// ════════════════════════════════════════════════════════════════════════════

import { useState } from "react"
import type { EquipmentItem } from "../../character-types"
import type { Theme } from "../../character-themes"
import { Modal } from "../ui/Modal"
import { Markdown } from "../../ui/Markdown"
import { damageTypeClasses, DAMAGE_TYPES } from "../../character-damage-types"
import { PopTransition } from "../ui/PopTransition"
import { FavoriteStar } from "../ui/FavoriteStar"
import { getSuggestions, type Suggestion } from "./FeatureEntry"

// ── Types ─────────────────────────────────────────────────────────────────────

interface EquipmentEntryProps {
  item: EquipmentItem
  onChange: (patch: Partial<EquipmentItem>) => void
  onRemove: () => void
  theme: Theme
  readOnly?: boolean
  statMods?: Record<string, number>
  pb?: number
  userId?: string | null
  isFavorite?: boolean
  onToggleFavorite?: () => void  // omit to hide the star
}

const STAT_OPTIONS = [
  { value: "",    label: "None" },
  { value: "str", label: "STR" },
  { value: "dex", label: "DEX" },
  { value: "con", label: "CON" },
  { value: "int", label: "INT" },
  { value: "wis", label: "WIS" },
  { value: "cha", label: "CHA" },
] as const

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseMagic(s?: string): number {
  if (!s) return 0
  return parseInt(s.replace(/\+/, ""), 10) || 0
}

function computeToHit(
  item: EquipmentItem,
  statMods: Record<string, number>,
  pb: number,
): string | null {
  if (!item.attackStat) return item.toHit ?? null
  const mod   = statMods[item.attackStat] ?? 0
  const magic = parseMagic(item.magicBonus)
  const extra = item.extraToHit ?? 0
  const prof  = item.proficient ? pb : 0
  const total = mod + magic + extra + prof
  return total >= 0 ? `+${total}` : `${total}`
}

function computeDamage(
  item: EquipmentItem,
  statMods: Record<string, number>,
): string | null {
  if (!item.damage) return null
  if (!item.attackStat) {
    return `${item.damage}${item.damageType ? ` ${item.damageType}` : ""}`
  }
  const mod      = statMods[item.attackStat] ?? 0
  const magic    = parseMagic(item.magicBonus)
  const extra    = item.extraDamage ?? 0
  const totalMod = mod + magic + extra
  const dmgStr   = totalMod !== 0
    ? `${item.damage}${totalMod > 0 ? "+" : ""}${totalMod}`
    : item.damage
  return `${dmgStr}${item.damageType ? ` ${item.damageType}` : ""}`
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EquipmentEntry({
  item, onChange, onRemove, theme, readOnly = false,
  statMods = {}, pb = 2, userId, isFavorite, onToggleFavorite,
}: EquipmentEntryProps) {
  const [editing,    setEditing]    = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showSuggest, setShowSuggest] = useState(false)

  const toHit  = computeToHit(item, statMods, pb)
  const damage = computeDamage(item, statMods)
  const isWeapon = item.type === "melee" || item.type === "ranged" || !item.type

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

  // ── To-hit breakdown label (shown in detail) ─────────────────────────────

  function toHitBreakdown(): string {
    if (!item.attackStat) return toHit ?? ""
    const parts: string[] = []
    const mod = statMods[item.attackStat] ?? 0
    parts.push(`(${item.attackStat.toUpperCase()}) ${mod}`)
    if (item.proficient) parts.push(`(Proficiency) ${pb} `)
    const magic = parseMagic(item.magicBonus)
    if (magic) parts.push(`Magic +${magic}`)
    if (item.extraToHit) parts.push(`(Extra) ${item.extraToHit}`)
    return parts.join(" + ").replace(/\+ -/g, "− ")
  }

  return (
    <>
      {/* ── Modal edit form ─────────────────────────────────────────────── */}
      {editing && (
        <Modal onClose={() => setEditing(false)}>
          <div className="bg-zinc-900 border border-white/15 rounded-2xl shadow-2xl w-[min(560px,calc(100vw-2rem))] flex flex-col overflow-hidden max-h-[85vh]">

            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
              <div className="relative flex-1 mr-3">
                <input
                  value={item.name}
                  onChange={async e => {
                    const q = e.target.value
                    onChange({ name: q })
                    if (q.length >= 2) {
                      const all = await getSuggestions("item", userId)
                      const ql = q.toLowerCase()
                      const matches = all
                        .filter(s => s.meta?.item_type === "weapon" && s.name.toLowerCase().includes(ql))
                        .slice(0, 8)
                      setSuggestions(matches)
                      setShowSuggest(matches.length > 0)
                    } else {
                      setShowSuggest(false)
                    }
                  }}
                  onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
                  autoFocus
                  placeholder="Item name"
                  className="w-full bg-transparent outline-none text-base font-bold text-white placeholder:text-white/30"
                />
                {showSuggest && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-zinc-900 border border-white/15 rounded-lg shadow-xl overflow-hidden">
                    {suggestions.map(s => (
                      <button
                        key={s.name}
                        type="button"
                        onMouseDown={e => {
                          e.preventDefault()
                          onChange({
                            name: s.name,
                            notes: s.description || item.notes,
                            damage: s.meta?.damage || item.damage,
                            damageType: s.meta?.damage_type || item.damageType,
                            properties: s.meta?.properties || item.properties,
                          })
                          setShowSuggest(false)
                        }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-white/10 transition-colors border-b border-white/5 last:border-0"
                      >
                        <span className="text-white font-medium">{s.name}</span>
                        {s.meta?.damage && (
                          <span className="text-white/35 ml-2">{s.meta.damage}{s.meta.damage_type ? ` ${s.meta.damage_type}` : ""}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button type="button" onClick={() => setEditing(false)}
                className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white shrink-0">✕</button>
            </div>

            {/* Modal body */}
            <div className="p-5 flex flex-col gap-4 overflow-y-auto flex-1">

              {/* Type + Attack Stat */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-white/40 uppercase tracking-wider">Type</span>
                  <select value={item.type ?? "melee"} onChange={e => onChange({ type: e.target.value })}
                    className="bg-zinc-800 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30 text-sm">
                    <option value="melee" className="bg-zinc-800 text-white">Melee</option>
                    <option value="ranged" className="bg-zinc-800 text-white">Ranged</option>
                    <option value="misc" className="bg-zinc-800 text-white">Misc</option>
                  </select>
                </label>

                {isWeapon && (
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-white/40 uppercase tracking-wider">Attack Stat</span>
                    <select
                      value={item.attackStat ?? ""}
                      onChange={e => onChange({ attackStat: (e.target.value as EquipmentItem["attackStat"]) || undefined })}
                      className="bg-zinc-800 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30 text-sm"
                    >
                      {STAT_OPTIONS.map(o => (
                        <option key={o.value} value={o.value} className="bg-zinc-800 text-white">{o.label}</option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="flex flex-col gap-1">
                  <span className="text-xs text-white/40 uppercase tracking-wider">Magic Bonus</span>
                  <input value={item.magicBonus ?? ""} onChange={e => onChange({ magicBonus: e.target.value })} placeholder="+1"
                    className="bg-white/10 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20" />
                </label>

                {/* Manual to-hit only when no attackStat */}
                {!item.attackStat && isWeapon && (
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-white/40 uppercase tracking-wider">To Hit</span>
                    <input value={item.toHit ?? ""} onChange={e => onChange({ toHit: e.target.value })} placeholder="+5"
                      className="bg-white/10 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20" />
                  </label>
                )}

                {/* Extra to-hit when attackStat is set */}
                {item.attackStat && isWeapon && (
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-white/40 uppercase tracking-wider">Extra To Hit</span>
                    <input
                      type="number"
                      value={item.extraToHit ?? ""}
                      onChange={e => onChange({ extraToHit: parseInt(e.target.value) || 0 })}
                      placeholder="0"
                      className="bg-white/10 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                  </label>
                )}

                {isWeapon && (
                  <>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-white/40 uppercase tracking-wider">Damage</span>
                      <input value={item.damage ?? ""} onChange={e => onChange({ damage: e.target.value })} placeholder="1d8"
                        className="bg-white/10 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20" />
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-white/40 uppercase tracking-wider">Extra Damage</span>
                      <input
                        type="number"
                        value={item.extraDamage ?? ""}
                        onChange={e => onChange({ extraDamage: parseInt(e.target.value) || 0 })}
                        placeholder="0"
                        className="bg-white/10 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-white/40 uppercase tracking-wider">Dmg Type</span>
                      <select value={item.damageType ?? ""} onChange={e => onChange({ damageType: e.target.value || undefined })}
                        className="bg-zinc-800 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30">
                        <option value="" className="bg-zinc-800 text-white">—</option>
                        {DAMAGE_TYPES.map(t => <option key={t} value={t} className="bg-zinc-800 text-white">{t}</option>)}
                      </select>
                    </label>
                  </>
                )}

                <label className="flex flex-col gap-1 col-span-2">
                  <span className="text-xs text-white/40 uppercase tracking-wider">Properties</span>
                  <input value={item.properties ?? ""} onChange={e => onChange({ properties: e.target.value })} placeholder="Versatile, Finesse…"
                    className="bg-white/10 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20" />
                </label>

                <PopTransition show={item.type === "melee"} className="col-span-2">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <label className="flex flex-col gap-1 flex-1">
                      <span className="text-xs text-white/40 uppercase tracking-wider">Melee Range</span>
                      <input value={item.meleeRange ?? ""} onChange={e => onChange({ meleeRange: e.target.value })} placeholder="5 ft."
                        className="bg-white/10 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20" />
                    </label>
                    <label className="flex flex-col gap-1 flex-1">
                      <span className="text-xs text-white/40 uppercase tracking-wider">Throw Range</span>
                      <input value={item.throwRange ?? ""} onChange={e => onChange({ throwRange: e.target.value })} placeholder="20/60 ft."
                        className="bg-white/10 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20" />
                    </label>
                  </div>
                </PopTransition>

                <PopTransition show={item.type === "ranged"} className="col-span-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-white/40 uppercase tracking-wider">Range</span>
                    <input value={item.range ?? ""} onChange={e => onChange({ range: e.target.value })} placeholder="80/320 ft."
                      className="bg-white/10 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20" />
                  </label>
                </PopTransition>

                <label className="flex flex-col gap-1">
                  <span className="text-xs text-white/40 uppercase tracking-wider">Weight (lb)</span>
                  <input type="number" min={0} step="0.1" value={item.weight ?? ""} onChange={e => onChange({ weight: e.target.value ? parseFloat(e.target.value) || 0 : undefined })} placeholder="0"
                    className="bg-white/10 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                </label>

                <label className="flex items-center gap-2 col-span-2 cursor-pointer select-none">
                  <input type="checkbox" checked={item.proficient ?? false} onChange={e => onChange({ proficient: e.target.checked })}
                    className="accent-primary size-4 rounded" />
                  <span className="text-sm text-white/70">Proficient with this weapon</span>
                </label>
              </div>

              {/* Computed preview */}
              {item.attackStat && isWeapon && (
                <div className="flex gap-3 flex-wrap">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] uppercase tracking-widest text-white/35 font-semibold">To Hit</span>
                    <span className="text-sm px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-300 font-medium">{toHit}</span>
                  </div>
                  {damage && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] uppercase tracking-widest text-white/35 font-semibold">Damage</span>
                      <span className={`text-sm px-2.5 py-1 rounded-lg font-medium ${damageTypeClasses(item.damageType)}`}>{damage}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              <label className="flex flex-col gap-1">
                <span className="text-xs text-white/40 uppercase tracking-wider">Description / Notes</span>
                <textarea value={item.notes ?? ""} onChange={e => onChange({ notes: e.target.value })} placeholder="Notes…" rows={4}
                  className="bg-white/10 rounded-lg px-3 py-2 text-sm text-white/70 outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20 resize-none" />
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

      {/* ── Row + expandable detail ──────────────────────────────────────── */}
      <div
        {...dragAttrs}
        className={`rounded-xl ${theme.box} border transition-all overflow-hidden ${isExpanded ? "border-white/20" : "border-white/10"}`}
      >
        {/* Compact row */}
        <div
          className="px-2.5 py-1.5 flex items-center gap-2 min-h-9 cursor-pointer hover:bg-white/5 transition-colors select-none"
          onClick={() => setIsExpanded(e => !e)}
        >
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
              {toHit && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 text-white/60">{toHit} to hit</span>
              )}
              {damage && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${damageTypeClasses(item.damageType)}`}>{damage}</span>
              )}
              {item.meleeRange && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 text-white/60">↔ {item.meleeRange}</span>
              )}
              {item.throwRange && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 text-white/60">⇒ {item.throwRange}</span>
              )}
              {item.range && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 text-white/60">⇒ {item.range}</span>
              )}
              {item.properties && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 text-white/45 italic">{item.properties}</span>
              )}
              {!!item.weight && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 text-white/40">{item.weight} lb</span>
              )}
            </div>
          </div>
        </div>

        {/* Expanded detail */}
        {isExpanded && (
          <div className="px-3 pb-2 pt-1.5 border-t border-white/5 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              {item.attackStat && toHit && (
                <p className="text-xs text-white/40">{toHitBreakdown()} = <span className="text-white/70 font-semibold">{toHit}</span></p>
              )}
              <div className="flex items-center gap-1 ml-auto">
                {onToggleFavorite && (
                  <FavoriteStar isFavorite={!!isFavorite} onToggle={onToggleFavorite} />
                )}
                {!readOnly && (
                  <button type="button" onClick={() => setEditing(true)}
                    className="size-7 flex items-center justify-center rounded-md hover:bg-white/10 text-white/70 hover:text-white text-sm shrink-0 transition-colors">
                    ✎
                  </button>
                )}
              </div>
            </div>
            {/* Notes */}
            {item.notes
              ? <Markdown text={item.notes} tone="dark" size="xs" />
              : <p className="text-xs text-white/25 italic">No description.</p>
            }
          </div>
        )}
      </div>
    </>
  )
}
