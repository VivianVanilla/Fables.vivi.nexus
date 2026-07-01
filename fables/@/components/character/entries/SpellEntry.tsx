// ════════════════════════════════════════════════════════════════════════════
// SpellEntry.tsx — compact spell row + modal edit form + detail view
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { SpellItem } from "../../character-types"
import type { Theme } from "../../character-themes"
import { Modal } from "../ui/Modal"
import { MarkdownTextarea } from "../../ui/MarkdownTextarea"
import { getSpells } from "../../../../src/spells/spellCache"
import type { Spell } from "../../../../src/spells/types"

// ── Types ─────────────────────────────────────────────────────────────────────

interface SpellEntryProps {
  spell: SpellItem
  onChange: (patch: Partial<SpellItem>) => void
  onRemove: () => void
  theme: Theme
  readOnly?: boolean
  showPrepToggle?: boolean
  classes?: string[]   // character's class(es) — lets a spell be tagged as known/prepared from a specific one
}

// ── Parse spell description for combat data ───────────────────────────────────

const SAVE_NAMES: Record<string, string> = {
  strength: "STR", dexterity: "DEX", constitution: "CON",
  intelligence: "INT", wisdom: "WIS", charisma: "CHA",
}

function parseSpellCombat(desc: string | string[]): { damage?: string; saveAttr?: string; attackRoll?: boolean } {
  const text = (Array.isArray(desc) ? desc.join(" ") : desc).toLowerCase()

  const attackRoll = /(?:ranged|melee)\s+spell\s+attack|spell\s+attack\s+roll/.test(text) || undefined

  let saveAttr: string | undefined
  const saveMatch = text.match(/\b(strength|dexterity|constitution|intelligence|wisdom|charisma)\s+saving\s+throw/)
  if (saveMatch) saveAttr = SAVE_NAMES[saveMatch[1]]

  let damage: string | undefined
  // Match patterns like "2d6", "10d10", "1d4 + 2d6", capturing the first dice expression near a damage type
  const dmgPattern = /(\d+d\d+(?:\s*[+]\s*\d+d\d+)?(?:\s*[+]\s*\d+)?)\s+(?:acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder|sickness)/
  const dmgMatch = (Array.isArray(desc) ? desc.join(" ") : desc).match(dmgPattern)
  if (dmgMatch) damage = dmgMatch[1].replace(/\s+/g, "")

  return { damage, saveAttr, attackRoll: attackRoll ?? undefined }
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
              className="w-full text-left px-3 py-2.5 hover:bg-black/30 transition-colors flex items-center justify-between gap-3"
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

function SpellDetailModal({ spell, onClose, onEdit, readOnly }: { spell: SpellItem; onClose: () => void; onEdit: () => void; readOnly: boolean }) {
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
                {spell.sourceClass ? ` · ${spell.sourceClass}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 mt-0.5">
              {!spell.alwaysPrepared && spell.prepared && (
                <span className="text-[10px] border border-primary/50 text-primary rounded-full px-2 py-0.5 font-semibold tracking-wide">Prepared</span>
              )}
              {!readOnly && (
                <button type="button" onClick={onEdit}
                  className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/70 hover:text-white text-sm transition-colors">✎</button>
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

// ── Component ─────────────────────────────────────────────────────────────────

export function SpellEntry({ spell, onChange, onRemove, theme, readOnly = false, showPrepToggle = true, classes = [] }: SpellEntryProps) {
  const [editing, setEditing] = useState(false)
  const [showDetail, setShowDetail] = useState(false)

  // Fill all spell fields from the database spell record (autofill only)
  function fillFromSpell(s: Spell) {
    const parsed = parseSpellCombat(s.desc ?? "")
    const dur = s.duration ?? ""
    onChange({
      name: s.name,
      level: s.level,
      school: s.school?.name ?? "",
      castTime: s.casting_time ?? "",
      range: s.range ?? "",
      duration: dur,
      components: s.components?.join(", ") ?? "",
      materialComponents: s.materialComponents ? (s.materials ?? "") : "",
      ritual: s.ritual ?? false,
      concentration: dur.toLowerCase().includes("concentration"),
      damage: s.damage ?? parsed.damage ?? "",
      damageType: s.damageType !== "None" ? s.damageType : "",
      saveAttr: s.saveAttr ?? parsed.saveAttr ?? "",
      notes: Array.isArray(s.desc) ? s.desc.join("\n\n") : (s.desc ?? ""),
    })
  }

  // Toggle prepared — a simple on/off; "known" (alwaysPrepared) spells have no toggle at all
  function togglePrepared(e: React.MouseEvent) {
    e.stopPropagation()
    if (readOnly) return
    onChange({ prepared: !spell.prepared })
  }

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
        <SpellDetailModal spell={spell} readOnly={readOnly} onClose={() => setShowDetail(false)}
          onEdit={() => { setShowDetail(false); setEditing(true) }} />
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

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/60">
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
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={spell.concentration ?? false} onChange={e => onChange({ concentration: e.target.checked })} className="accent-primary" />
                  Concentration
                </label>
        
              </div>

              {classes.length > 1 && (
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-white/40 uppercase tracking-wider">Class</span>
                  <select value={spell.sourceClass ?? ""} onChange={e => onChange({ sourceClass: e.target.value || undefined })}
                    className="bg-black/30 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white/30 text-sm">
                    <option value="">—</option>
                    {classes.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
              )}

              <div className="flex flex-col gap-1">
                <span className="text-xs text-white/40 uppercase tracking-wider">Description / Notes</span>
                <MarkdownTextarea
                  value={spell.notes ?? ""}
                  onChange={v => onChange({ notes: v })}
                  placeholder="Spell description…"
                  rows={4}
                  className="bg-white/10 rounded-lg px-3 py-2 text-sm text-white/70 outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20 resize-none"
                  variant="light"
                />
              </div>
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
        {/* Prep indicator — plain on/off; "known" (alwaysPrepared) spells have no mark at all */}
        {showPrepToggle && !spell.alwaysPrepared && (
          <button
            type="button"
            disabled={readOnly}
            onClick={togglePrepared}
            title={spell.prepared ? "Prepared — click to unprepare" : "Unprepared — click to prepare"}
            className={`size-5 rounded shrink-0 transition-all text-[9px] font-bold flex items-center justify-center border ${
              spell.prepared
                ? "bg-primary border-primary text-white"
                : "border-white/20 bg-transparent text-white/20 hover:border-white/40 hover:text-white/40"
            }`}
          >
            P
          </button>
        )}

        {/* Name + tags */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-white truncate">
              {spell.name || <span className="text-white/30 italic">Unnamed</span>}
            </p>
            {spell.sourceClass && (
              <span className="text-[9px] px-1 py-0.5 rounded bg-indigo-500/20 text-indigo-300 leading-tight shrink-0">{spell.sourceClass}</span>
            )}
            {spell.ritual && (
              <span className="text-[9px] border border-amber-400/40 text-amber-400/80 rounded px-0.5 leading-tight shrink-0">R</span>
            )}
            {spell.concentration && (
              <span className="text-[9px] border border-sky-400/40 text-sky-400/80 rounded px-1 leading-tight shrink-0">Conc.</span>
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
      </div>
    </>
  )
}
