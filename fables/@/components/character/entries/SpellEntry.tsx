// ════════════════════════════════════════════════════════════════════════════
// SpellEntry.tsx — compact spell row + modal edit form + detail view
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { SpellItem } from "../../character-types"
import type { Theme } from "../../character-themes"
import { Modal } from "../ui/Modal"
import { getSpells } from "../../../../src/spells/spellCache"
import type { Spell } from "../../../../src/spells/types"

// ── Types ─────────────────────────────────────────────────────────────────────

interface SpellEntryProps {
  spell: SpellItem
  onChange: (patch: Partial<SpellItem>) => void
  onRemove: () => void
  theme: Theme
  readOnly?: boolean
}

// ── Spell name input with autofill ────────────────────────────────────────────

function SpellNameInput({
  value,
  onChange,
  onFill,
}: {
  value: string
  onChange: (v: string) => void
  onFill: (spell: Spell) => void
}) {
  const [allSpells, setAllSpells] = useState<Spell[]>([])
  const [suggestions, setSuggestions] = useState<Spell[]>([])
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const loaded = useRef(false)
  function ensureLoaded() {
    if (loaded.current) return
    loaded.current = true
    getSpells().then(setAllSpells)
  }

  useEffect(() => {
    if (!value.trim() || allSpells.length === 0) { setSuggestions([]); setOpen(false); return }
    const q = value.toLowerCase()
    const matches = allSpells
      .filter((s) => s.name.toLowerCase().startsWith(q))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 8)
    setSuggestions(matches)
    setOpen(matches.length > 0)
  }, [value, allSpells])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  return (
    <div ref={containerRef} className="relative flex-1 mr-3">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={ensureLoaded}
        autoFocus
        placeholder="Spell name"
        className="w-full bg-transparent outline-none text-base font-bold text-white placeholder:text-white/30"
      />
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 w-72 bg-zinc-900 border border-white/15 rounded-xl shadow-2xl overflow-hidden">
          {suggestions.map((s) => (
            <button
              key={s.index}
              type="button"
              onMouseDown={() => { onFill(s); setOpen(false) }}
              className="w-full text-left px-3 py-2.5 hover:bg-white/10 transition-colors flex items-center justify-between gap-3"
            >
              <span className="text-sm text-white truncate">{s.name}</span>
              <span className="text-[10px] text-white/40 shrink-0">
                {s.level === 0 ? "Cantrip" : `Lv ${s.level}`} · {s.school?.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Stat pill ─────────────────────────────────────────────────────────────────

function Pill({ label, value, color = "bg-white/10 text-white/60" }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-widest text-white/35 font-semibold">{label}</span>
      <span className={`text-sm px-2.5 py-1 rounded-lg font-medium ${color}`}>{value}</span>
    </div>
  )
}

// ── Spell detail modal (shows SpellItem's own stored data) ────────────────────

function SpellDetailModal({ spell, onClose }: { spell: SpellItem; onClose: () => void }) {
  const prepState = getPrepState(spell)

  return (
    <Modal onClose={onClose}>
      <div className="bg-zinc-900 border border-white/15 rounded-2xl shadow-2xl w-[min(560px,calc(100vw-2rem))] max-h-[85vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-white leading-tight">{spell.name || "Unnamed Spell"}</h2>
              <p className="text-sm text-white/45 mt-0.5 italic">
                {spell.level === 0
                  ? `${spell.school ?? "Cantrip"} cantrip`
                  : `Level ${spell.level}${spell.school ? ` ${spell.school}` : ""}`}
                {spell.ritual ? " · Ritual" : ""}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 mt-0.5">
              {prepState === "always" && (
                <span className="text-[10px] border border-amber-400/50 text-amber-400 rounded-full px-2 py-0.5 font-semibold tracking-wide">Always Known</span>
              )}
              {prepState === "prepared" && (
                <span className="text-[10px] border border-primary/50 text-primary rounded-full px-2 py-0.5 font-semibold tracking-wide">Prepared</span>
              )}
              <button type="button" onClick={onClose}
                className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors">✕</button>
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="px-6 py-4 border-b border-white/10 shrink-0">
          <div className="flex flex-wrap gap-3">
            {spell.castTime  && <Pill label="Cast Time" value={spell.castTime} />}
            {spell.range     && <Pill label="Range"     value={spell.range} />}
            {spell.duration  && <Pill label="Duration"  value={spell.duration} />}
            {spell.toHit     && <Pill label="Attack"    value={spell.toHit} color="bg-blue-500/15 text-blue-300" />}
            {spell.saveAttr  && <Pill label="Save"      value={spell.saveAttr} color="bg-yellow-500/15 text-yellow-300" />}
            {spell.damage    && (
              <Pill
                label="Damage"
                value={`${spell.damage}${spell.damageType ? ` ${spell.damageType}` : ""}`}
                color="bg-red-500/15 text-red-300"
              />
            )}
          </div>
          {spell.components && (
            <p className="text-xs text-white/40 mt-3">
              <span className="font-semibold text-white/50">Components:</span> {spell.components}
              {spell.materialComponents ? ` (${spell.materialComponents})` : ""}
            </p>
          )}
        </div>

        {/* Description */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {spell.notes
            ? (
              <div className="prose prose-sm prose-invert max-w-none text-white/70 prose-p:leading-relaxed prose-table:text-xs prose-th:text-white/50 prose-td:text-white/60">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{spell.notes}</ReactMarkdown>
              </div>
            )
            : <p className="text-sm text-white/25 italic">No description saved.</p>
          }
        </div>
      </div>
    </Modal>
  )
}

// ── Prep state helpers ────────────────────────────────────────────────────────

type PrepState = "none" | "prepared" | "always"

function getPrepState(spell: SpellItem): PrepState {
  if (spell.alwaysPrepared) return "always"
  if (spell.prepared)       return "prepared"
  return "none"
}

function nextPrepState(current: PrepState): PrepState {
  if (current === "none")     return "prepared"
  if (current === "prepared") return "always"
  return "none"
}

function prepStateToFields(state: PrepState): Partial<SpellItem> {
  if (state === "prepared") return { prepared: true,  alwaysPrepared: false }
  if (state === "always")   return { prepared: false, alwaysPrepared: true  }
  return                           { prepared: false, alwaysPrepared: false }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SpellEntry({ spell, onChange, onRemove, theme, readOnly = false }: SpellEntryProps) {
  const [editing, setEditing] = useState(false)
  const [showDetail, setShowDetail] = useState(false)

  // Fill all spell fields from the database spell record (autofill only)
  function fillFromSpell(s: Spell) {
    onChange({
      name: s.name,
      level: s.level,
      school: s.school?.name ?? "",
      castTime: s.casting_time ?? "",
      range: s.range ?? "",
      duration: s.duration ?? "",
      components: s.components?.join(", ") ?? "",
      materialComponents: s.materialComponents ? (s.materials ?? "") : "",
      ritual: s.ritual ?? false,
      damageType: s.damageType !== "None" ? s.damageType : "",
      notes: Array.isArray(s.desc) ? s.desc.join("\n\n") : (s.desc ?? ""),
    })
  }

  // Cycle prep state
  function cyclePrep(e: React.MouseEvent) {
    e.stopPropagation()
    if (readOnly) return
    const next = nextPrepState(getPrepState(spell))
    onChange(prepStateToFields(next))
  }

  const prepState = getPrepState(spell)

  // ── Drag source ─────────────────────────────────────────────────────────

  const dragAttrs = readOnly ? {} : {
    draggable: true as const,
    onDragStart(e: React.DragEvent) {
      e.dataTransfer.setData("x-fable-ref", JSON.stringify({
        refId:   spell.id,
        refType: "spell",
        label:   spell.name || "Spell",
      }))
      e.dataTransfer.effectAllowed = "copy"
    },
  }

  return (
    <>
      {/* ── Detail modal (shows this spell's own stored data) ──────────── */}
      {showDetail && (
        <SpellDetailModal spell={spell} onClose={() => setShowDetail(false)} />
      )}

      {/* ── Edit form modal ─────────────────────────────────────────────── */}
      {editing && (
        <Modal onClose={() => setEditing(false)}>
          <div className="bg-zinc-900 border border-white/15 rounded-2xl shadow-2xl w-[min(560px,calc(100vw-2rem))] max-h-[85vh] flex flex-col overflow-hidden">

            {/* Modal header — spell name with autofill */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
              <SpellNameInput
                value={spell.name}
                onChange={(v) => onChange({ name: v })}
                onFill={fillFromSpell}
              />
              <button type="button" onClick={() => setEditing(false)}
                className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white shrink-0">✕</button>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-white/40 uppercase tracking-wider">Level</span>
                  <input type="number" value={spell.level ?? ""} onChange={e => onChange({ level: parseInt(e.target.value) || 0 })} placeholder="0"
                    className="bg-white/10 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-white/40 uppercase tracking-wider">School</span>
                  <input value={spell.school ?? ""} onChange={e => onChange({ school: e.target.value })} placeholder="Evocation"
                    className="bg-white/10 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-white/40 uppercase tracking-wider">Attack</span>
                  <input value={spell.toHit ?? ""} onChange={e => onChange({ toHit: e.target.value })} placeholder="+5"
                    className="bg-white/10 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-white/40 uppercase tracking-wider">Save</span>
                  <input value={spell.saveAttr ?? ""} onChange={e => onChange({ saveAttr: e.target.value })} placeholder="DEX"
                    className="bg-white/10 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-white/40 uppercase tracking-wider">Damage</span>
                  <input value={spell.damage ?? ""} onChange={e => onChange({ damage: e.target.value })} placeholder="8d6"
                    className="bg-white/10 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-white/40 uppercase tracking-wider">Dmg Type</span>
                  <input value={spell.damageType ?? ""} onChange={e => onChange({ damageType: e.target.value })} placeholder="Fire"
                    className="bg-white/10 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-white/40 uppercase tracking-wider">Cast Time</span>
                  <input value={spell.castTime ?? ""} onChange={e => onChange({ castTime: e.target.value })} placeholder="1 action"
                    className="bg-white/10 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-white/40 uppercase tracking-wider">Range</span>
                  <input value={spell.range ?? ""} onChange={e => onChange({ range: e.target.value })} placeholder="60ft"
                    className="bg-white/10 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-white/40 uppercase tracking-wider">Duration</span>
                  <input value={spell.duration ?? ""} onChange={e => onChange({ duration: e.target.value })} placeholder="Instantaneous"
                    className="bg-white/10 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-white/40 uppercase tracking-wider">Components</span>
                  <input value={spell.components ?? ""} onChange={e => onChange({ components: e.target.value })} placeholder="V, S, M"
                    className="bg-white/10 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20" />
                </label>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-xs text-white/40 uppercase tracking-wider">Material Components</span>
                <input value={spell.materialComponents ?? ""} onChange={e => onChange({ materialComponents: e.target.value })} placeholder="A pinch of sulfur…"
                  className="bg-white/10 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20 text-sm" />
              </label>

              <div className="flex items-center gap-4 text-sm text-white/60">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={spell.prepared ?? false} onChange={e => onChange({ prepared: e.target.checked })} className="accent-primary" />
                  Prepared
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={spell.alwaysPrepared ?? false} onChange={e => onChange({ alwaysPrepared: e.target.checked })} className="accent-primary" />
                  Always / Known
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={spell.ritual ?? false} onChange={e => onChange({ ritual: e.target.checked })} className="accent-primary" />
                  Ritual
                </label>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-xs text-white/40 uppercase tracking-wider">Description / Notes</span>
                <textarea value={spell.notes ?? ""} onChange={e => onChange({ notes: e.target.value })} placeholder="Spell description…" rows={4}
                  className="bg-white/10 rounded-lg px-3 py-2 text-sm text-white/70 outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20 resize-none" />
              </label>
            </div>

            <div className="flex items-center justify-between px-5 py-3 border-t border-white/10 shrink-0">
              <button type="button" onClick={onRemove} className="text-sm text-red-400/60 hover:text-red-400 transition-colors">Delete</button>
              <button type="button" onClick={() => setEditing(false)}
                className="text-sm px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white font-semibold transition-colors">Done</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Compact row ─────────────────────────────────────────────────── */}
      <div
        {...dragAttrs}
        onClick={() => setShowDetail(true)}
        className={`rounded-lg ${theme.box} border border-white/10 px-3 py-2.5 flex items-center gap-2 min-h-11 cursor-pointer hover:border-white/20 transition-colors`}
      >
        {/* Prep indicator — 3 states */}
        <button
          type="button"
          disabled={readOnly}
          onClick={cyclePrep}
          title={
            prepState === "always"   ? "Always/Known — click to clear" :
            prepState === "prepared" ? "Prepared — click for Always/Known" :
                                       "Unprepared — click to prepare"
          }
          className={`size-5 rounded shrink-0 transition-all text-[9px] font-bold flex items-center justify-center border ${
            prepState === "always"
              ? "bg-amber-500/30 border-amber-400/70 text-amber-300 text-[11px]"
              : prepState === "prepared"
              ? "bg-primary border-primary text-white"
              : "border-white/20 bg-transparent text-white/20 hover:border-white/40 hover:text-white/40"
          }`}
        >
          {prepState === "always" ? "∞" : "P"}
        </button>

        {/* Name + tags */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-white truncate">
              {spell.name || <span className="text-white/30 italic">Unnamed</span>}
            </p>
            {spell.ritual && (
              <span className="text-[9px] border border-amber-400/40 text-amber-400/80 rounded px-0.5 leading-tight shrink-0">R</span>
            )}
            {prepState === "always" && (
              <span className="text-[9px] border border-amber-400/40 text-amber-400/70 rounded px-0.5 leading-tight shrink-0">Known</span>
            )}
          </div>
          <div className="flex gap-1 mt-0.5 flex-wrap">
            {spell.level !== undefined && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 text-white/60">Lv {spell.level}</span>
            )}
            {spell.school && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 text-white/45 italic">{spell.school}</span>
            )}
            {(spell.saveAttr || spell.saveType) && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-300/80">
                Save {spell.saveAttr || spell.saveType}
              </span>
            )}
            {spell.toHit && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 text-white/60">{spell.toHit} atk</span>
            )}
            {spell.damage && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-300/80">
                {spell.damage}{spell.damageType ? ` ${spell.damageType}` : ""}
              </span>
            )}
            {spell.castTime && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 text-white/45">{spell.castTime}</span>
            )}
          </div>
        </div>

        {/* Edit button */}
        {!readOnly && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setEditing(true) }}
            className="size-7 flex items-center justify-center rounded-md hover:bg-white/10 text-white/25 hover:text-white/70 text-sm shrink-0 transition-colors"
          >
            ✎
          </button>
        )}
      </div>
    </>
  )
}
