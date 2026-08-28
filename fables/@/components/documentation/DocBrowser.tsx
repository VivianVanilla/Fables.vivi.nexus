// ════════════════════════════════════════════════════════════════════════════
// DocBrowser.tsx — PHB-style reference browser
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react"
import { supabase } from "../../../src/supabase"
import { Pencil, Library, Loader2, ArrowLeft, X, ExternalLink, Sparkles, Search } from "lucide-react"
import type { DocType, DocEntry, PackItem } from "./doc-types"
import { SINGULAR, TYPE_LABEL } from "./doc-types"
import { DocEntryForm } from "./DocEntryForm"
import { HomebrewBrowserModal } from "./HomebrewBrowserModal"
import { Markdown } from "../ui/Markdown"
import { invalidateSuggestionCache } from "../character/entries/FeatureEntry"
import { InvocationsSection } from "./InvocationsSection"

export interface LibraryObject {
  id: string
  name: string
  created_at: string
  data: {
    doc_id: string
    doc_type: string
    doc_owner_id: string
    description: string
    added_at: string
    [key: string]: any
  }
}

// ── Ordinal helper ─────────────────────────────────────────────────────────────

const ORDINAL: Record<number, string> = {
  1:"1st",2:"2nd",3:"3rd",4:"4th",5:"5th",6:"6th",7:"7th",8:"8th",9:"9th",
  10:"10th",11:"11th",12:"12th",13:"13th",14:"14th",15:"15th",16:"16th",
  17:"17th",18:"18th",19:"19th",20:"20th",
}

// ── PHB-style section heading ──────────────────────────────────────────────────

function RefSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 first:mt-0">
      <h3 className="text-base font-bold text-amber-400 pb-1 border-b border-amber-900/40 mb-3">
        {title}
      </h3>
      {children}
    </section>
  )
}

// "Label: Value" row — the building block of PHB stat blocks
function Prop({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-1 text-sm leading-snug mb-2 last:mb-0">
      <span className="font-semibold text-foreground shrink-0">{label}:</span>
      <span className="text-muted-foreground sm:ml-0.5">{value}</span>
    </div>
  )
}

// ── Subclass spells table helper ───────────────────────────────────────────────

interface DomainSpellRow {
  level: number
  spells: string[]
  variant?: string  // e.g. Circle of the Land's terrain choice — see DocEntryForm.tsx's DomainSpellsField
}

function SpellsTable({ rows }: { rows: DomainSpellRow[] }) {
  if (!rows?.length) return null
  return (
    <table className="w-full text-sm border-collapse mt-1">
      <thead>
        <tr>
          <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold pb-2 w-28">Level</th>
          <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold pb-2">Spells</th>
        </tr>
      </thead>
      <tbody>
        {[...rows].sort((a,b) => a.level - b.level).map((row, i) => (
          <tr key={i} className="border-t border-border/60">
            <td className="py-2 text-muted-foreground">{ORDINAL[row.level] ?? row.level}</td>
            <td className="py-2 text-foreground">{(row.spells ?? []).join(", ")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// Ungated rows (Cleric domains, Paladin oaths, Warlock patrons — one fixed
// list per level) render as a single table, same as before. Variant-gated
// rows (Circle of the Land's terrain choice — same level, different spells
// per terrain) get their own labeled table per variant instead of being
// merged into one table keyed only by level, which would either collide or
// silently mix terrains together.
function DomainSpellsDisplay({ rows }: { rows: DomainSpellRow[] }) {
  if (!rows?.length) return null
  const plain = rows.filter(r => !r.variant)
  const variants = new Map<string, DomainSpellRow[]>()
  for (const r of rows) {
    if (!r.variant) continue
    if (!variants.has(r.variant)) variants.set(r.variant, [])
    variants.get(r.variant)!.push(r)
  }
  const variantNames = [...variants.keys()].sort((a, b) => a.localeCompare(b))
  return (
    <>
      {plain.length > 0 && <SpellsTable rows={plain} />}
      {variantNames.length > 0 && (
        <div className="flex flex-col gap-4 mt-3 first:mt-0">
          {variantNames.map(name => (
            <div key={name}>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-400/80 mb-1">{name}</p>
              <SpellsTable rows={variants.get(name)!} />
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ── Subclass modal ─────────────────────────────────────────────────────────────

function SubclassModal({ sc, onClose, onEdit, canEdit }: {
  sc: DocEntry
  onClose: () => void
  onEdit?: () => void
  canEdit?: boolean
}) {
  const d = sc.data ?? {}
  const features: any[] = d.features ?? []
  const domainSpells: DomainSpellRow[] = d.domain_spells ?? []

  const byLevel = features.reduce<Record<number, any[]>>((acc, f) => {
    if (!acc[f.level]) acc[f.level] = []
    acc[f.level].push(f)
    return acc
  }, {})

  // backdrop-blur-xs, not -sm — lighter compositing/blur cost, matters most
  // on mobile GPUs; same backdrop look (see Modal.tsx's matching comment).
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-border shrink-0">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-amber-500/60 font-semibold mb-0.5">Subclass</p>
            <h2 className="text-xl font-bold text-foreground">{sc.name}</h2>
            {sc.description && <p className="text-sm text-muted-foreground mt-0.5 leading-snug italic">{sc.description}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canEdit && onEdit && (
              <button onClick={() => { onClose(); onEdit() }}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-amber-900/50 text-amber-500 hover:border-amber-700 transition-colors">
                <Pencil className="size-3" /> Edit
              </button>
            )}
            <button onClick={onClose} className="size-8 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {domainSpells.length > 0 && (
            <RefSection title="Subclass Spells">
              <DomainSpellsDisplay rows={domainSpells} />
            </RefSection>
          )}

          {features.length > 0 && (
            <RefSection title="Subclass Features">
              {Object.entries(byLevel).sort(([a],[b]) => parseInt(a)-parseInt(b)).map(([level, feats]) => (
                <div key={level} className="mb-5 last:mb-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                    Level {level}
                  </p>
                  {(feats as any[]).map((f: any) => (
                    <div key={f.id} className="mb-3 last:mb-0">
                      <p className="text-sm font-bold text-foreground mb-0.5">{f.name}</p>
                      {f.description && <Markdown text={f.description} tone="slate" />}
                    </div>
                  ))}
                </div>
              ))}
            </RefSection>
          )}

          {features.length === 0 && domainSpells.length === 0 && (
            <p className="text-sm text-muted-foreground italic mt-2">No features recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Search bar ───────────────────────────────────────────────────────────────
// Same live-filter + startsWith-suggestions-dropdown pattern as the Spells
// browser's SpellSearch (src/spells/SpellSearch.tsx) — an input that filters
// the list as you type, with up to 8 startsWith matches offered below it so
// a long name can be filled in with one click instead of typed out fully.

function DocSearchBar({ value, onChange, pool, placeholder }: {
  value: string
  onChange: (v: string) => void
  pool: { id: string; name: string }[]
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<{ id: string; name: string }[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!value.trim()) { setSuggestions([]); setOpen(false); return }
    const q = value.toLowerCase()
    const matches = pool
      .filter(e => e.name.toLowerCase().startsWith(q))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 8)
    setSuggestions(matches)
    setOpen(matches.length > 0)
  }, [value, pool])

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (!containerRef.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className="w-full bg-card border border-border rounded-xl pl-10 pr-9 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-border transition-colors"
      />
      {value && (
        <button type="button" onClick={() => onChange("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 size-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground">
          <X className="size-3.5" />
        </button>
      )}
      {open && (
        <div className="absolute z-50 top-full mt-1 w-full bg-background border border-border rounded-xl shadow-2xl overflow-hidden">
          {suggestions.map(s => (
            <button key={s.id} type="button" onMouseDown={() => { onChange(s.name); setOpen(false) }}
              className="w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors truncate">
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Pagination ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 25

function Paginator({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  if (totalPages <= 1) return null
  const btn = "text-xs px-2.5 py-1.5 rounded border border-border text-muted-foreground hover:text-amber-400 hover:border-amber-700/50 disabled:opacity-30 disabled:hover:text-muted-foreground disabled:hover:border-border disabled:cursor-default transition-colors"
  return (
    <div className="flex items-center justify-center gap-2 mt-3">
      <button type="button" onClick={() => onChange(1)} disabled={page === 1} className={btn}>« First</button>
      <button type="button" onClick={() => onChange(page - 1)} disabled={page === 1} className={btn}>‹ Prev</button>
      <span className="text-xs text-muted-foreground px-2 tabular-nums">Page {page} of {totalPages}</span>
      <button type="button" onClick={() => onChange(page + 1)} disabled={page === totalPages} className={btn}>Next ›</button>
      <button type="button" onClick={() => onChange(totalPages)} disabled={page === totalPages} className={btn}>Last »</button>
    </div>
  )
}

// ── Entry card ─────────────────────────────────────────────────────────────────

// Core/homebrew entries all render as this compact tile — name only, no
// description/details until clicked, matching the Core Rulebook grid so
// homebrew doesn't stand out as a different, more revealing style.
function DocCard({
  name, caption, canEdit, onClick, onEdit, extraAction,
}: {
  name: string
  caption?: string
  canEdit?: boolean
  onClick: () => void
  onEdit?: () => void
  extraAction?: React.ReactNode  // e.g. a "remove from library" button, shown left of edit
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex flex-col items-center justify-center gap-1.5 rounded-lg border border-border bg-card/50 p-3 hover:border-amber-900/60 hover:bg-card transition-all min-h-[80px] text-center w-full"
    >
      <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
        {extraAction}
        {canEdit && onEdit && (
          <span
            role="button"
            onClick={e => { e.stopPropagation(); onEdit() }}
            className="size-6 flex items-center justify-center rounded hover:bg-amber-500/20 text-muted-foreground hover:text-amber-400"
          >
            <Pencil className="size-3" />
          </span>
        )}
      </div>
      <p className="text-sm font-semibold text-foreground leading-tight px-5">{name}</p>
      {caption && (
        <p className="text-[10px] text-muted-foreground leading-tight">{caption}</p>
      )}
    </button>
  )
}

// ── PHB-style detail view ──────────────────────────────────────────────────────

function DetailView({
  entry, isAdminMode, isOwnHomebrew, onBack, onEdit, onEditEntry, type, onGoToSpells,
}: {
  entry: DocEntry
  isAdminMode: boolean
  isOwnHomebrew: boolean
  onBack: () => void
  onEdit: () => void
  onEditEntry: (e: DocEntry) => void
  type: DocType
  onGoToSpells?: (className: string) => void
}) {
  const d = entry.data ?? {}
  const [subclasses,   setSubclasses]   = useState<DocEntry[]>([])
  const [openSubclass, setOpenSubclass] = useState<DocEntry | null>(null)

  useEffect(() => {
    if (type !== "classes") return
    const q = supabase.from("documentation").select("*").eq("type", "class")
      .filter("data->>parent_class_id", "eq", entry.id).order("name")
    if (!entry.is_homebrew) q.eq("is_homebrew", false)
    q.then(({ data }) => setSubclasses((data ?? []) as DocEntry[]))
  }, [entry.id, type])

  const canEdit = isAdminMode || isOwnHomebrew
  const features: any[] = d.features ?? []
  const byLevel = features.reduce<Record<number, any[]>>((acc, f) => {
    if (!acc[f.level]) acc[f.level] = []
    acc[f.level].push(f)
    return acc
  }, {})

  // Derive HP text from hit die
  const dieNum   = d.hit_die ? parseInt((d.hit_die as string).slice(1)) : null
  const hpAvg    = dieNum ? dieNum / 2 + 1 : null
  const className = entry.name

  return (
    <>
      <div className="max-w-2xl">
        {/* Nav */}
        <div className="flex items-center justify-between mb-5">
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="size-4" /> Back
          </button>
          <div className="flex items-center gap-2">
            {type === "classes" && onGoToSpells && (
              <button onClick={() => onGoToSpells(entry.name)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-border text-muted-foreground hover:text-purple-400 hover:border-purple-700/40 transition-colors">
                <Sparkles className="size-3" />{entry.name} Spells<ExternalLink className="size-2.5 opacity-50 ml-0.5" />
              </button>
            )}
            {canEdit && (
              <button onClick={onEdit}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-amber-900/50 text-amber-500 hover:border-amber-700 transition-colors">
                <Pencil className="size-3" /> Edit
              </button>
            )}
          </div>
        </div>

        {/* Page title */}
        <div className="mb-1">
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">{entry.name}</h1>
            {entry.is_homebrew && (
              <span className="text-xs text-purple-400 font-semibold uppercase tracking-wider">Homebrew</span>
            )}
          </div>
          {entry.description && (
            <p className="text-sm text-muted-foreground mt-1 italic leading-relaxed">{entry.description}</p>
          )}
        </div>

        {/* ── CLASSES ─────────────────────────────────────────────────── */}
        {type === "classes" && (
          <>
            {/* Hit Points */}
            {dieNum && (
              <RefSection title="Hit Points">
                <Prop label="Hit Dice" value={`1${d.hit_die} per ${className} level`} />
                <Prop label="Hit Points at 1st Level" value={`${dieNum} + your Constitution modifier`} />
                <Prop label="Hit Points at Higher Levels"
                  value={`1${d.hit_die} (or ${hpAvg}) + your Constitution modifier per ${className} level after 1st`} />
              </RefSection>
            )}

            {/* Proficiencies */}
            {(d.armor_proficiencies?.length > 0 || d.weapon_proficiencies?.length > 0 ||
              d.saving_throws?.length > 0 || d.tools || d.skills) && (
              <RefSection title="Proficiencies">
                {d.armor_proficiencies?.length > 0 && (
                  <Prop label="Armor" value={d.armor_proficiencies.join(", ")} />
                )}
                {d.weapon_proficiencies?.length > 0 && (
                  <Prop label="Weapons"
                    value={(Array.isArray(d.weapon_proficiencies) ? d.weapon_proficiencies : [d.weapon_proficiencies]).join(", ")} />
                )}
                {d.tools && <Prop label="Tools" value={d.tools} />}
                {d.saving_throws?.length > 0 && (
                  <Prop label="Saving Throws"
                    value={d.saving_throws.map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(", ")} />
                )}
                {d.skills && <Prop label="Skills" value={d.skills} />}
              </RefSection>
            )}

            {/* Equipment */}
            {d.equipment?.length > 0 && (
              <RefSection title="Equipment">
                <p className="text-sm text-muted-foreground mb-2">
                  You start with the following equipment, in addition to the equipment granted by your background:
                </p>
                <ul className="flex flex-col gap-1.5">
                  {(d.equipment as string[]).map((line, i) => (
                    <li key={i} className="text-sm text-foreground pl-3 border-l-2 border-border">{line}</li>
                  ))}
                </ul>
              </RefSection>
            )}

            {/* Spellcasting */}
            {d.spellcasting_ability && d.spellcasting_type && (
              <RefSection title="Spellcasting">
                {d.spellcasting_description && (
                  <Markdown text={d.spellcasting_description} tone="slate" className="mb-3" />
                )}
                <Prop label="Spellcasting Ability" value={(d.spellcasting_ability as string).toUpperCase()} />
                {d.spellcasting_type && (
                  <Prop label="Caster Type" value={
                    ({ full: "Full Caster", half: "Half Caster", third: "Third Caster", pact: "Pact Magic" } as Record<string,string>)[d.spellcasting_type] ?? d.spellcasting_type
                  } />
                )}
              </RefSection>
            )}

            {/* Class Features */}
            {features.length > 0 && (
              <RefSection title="Class Features">
                <p className="text-sm text-muted-foreground italic mb-4">
                  As a {className}, you gain the following class features.
                </p>
                {Object.entries(byLevel).sort(([a],[b]) => parseInt(a)-parseInt(b)).map(([level, feats]) => (
                  <div key={level} className="mb-5 last:mb-0">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                      Level {level}
                    </p>
                    {(feats as any[]).map((f: any) => (
                      <div key={f.id} className="mb-3 last:mb-0">
                        <p className="text-sm font-bold text-foreground mb-0.5">{f.name}</p>
                        {f.description && <Markdown text={f.description} tone="slate" />}
                      </div>
                    ))}
                  </div>
                ))}
              </RefSection>
            )}

            {/* Subclass chooser */}
            {d.subclass_feature_name && (
              <RefSection title={`${d.subclass_feature_name}s`}>
                {subclasses.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No subclasses recorded yet.</p>
                ) : (
                  <div>
                    {subclasses.map(sc => (
                      <button
                        key={sc.id}
                        type="button"
                        onClick={() => setOpenSubclass(sc)}
                        className="group w-full flex items-center justify-between py-3 border-b border-border/60 last:border-0 text-left transition-colors hover:bg-card/40 px-1 rounded"
                      >
                        <div>
                          <p className="text-sm font-semibold text-foreground group-hover:text-amber-400 transition-colors">{sc.name}</p>
                          {sc.description && <p className="text-xs text-muted-foreground mt-0.5">{sc.description}</p>}
                        </div>
                        <ExternalLink className="size-3.5 text-muted-foreground group-hover:text-amber-500 shrink-0 ml-3 transition-colors" />
                      </button>
                    ))}
                  </div>
                )}
              </RefSection>
            )}

            {/* Subclasses when no feature name set */}
            {!d.subclass_feature_name && subclasses.length > 0 && (
              <RefSection title="Subclasses">
                <div>
                  {subclasses.map(sc => (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => setOpenSubclass(sc)}
                      className="group w-full flex items-center justify-between py-3 border-b border-border/60 last:border-0 text-left hover:bg-card/40 px-1 rounded transition-colors"
                    >
                      <div>
                        <p className="text-sm font-semibold text-foreground group-hover:text-amber-400 transition-colors">{sc.name}</p>
                        {sc.description && <p className="text-xs text-muted-foreground mt-0.5">{sc.description}</p>}
                      </div>
                      <ExternalLink className="size-3.5 text-muted-foreground group-hover:text-amber-500 shrink-0 ml-3 transition-colors" />
                    </button>
                  ))}
                </div>
              </RefSection>
            )}
          </>
        )}

        {/* ── RACES ───────────────────────────────────────────────────── */}
        {type === "races" && (
          <>
            {d.traits?.length > 0 && (
              <RefSection title="Racial Traits">
                {d.traits.map((t: any, i: number) => {
                  const name = typeof t === "string" ? t : (t?.name ?? "")
                  const desc = typeof t === "string" ? "" : (t?.description ?? "")
                  return (
                    <div key={i} className="mb-3 last:mb-0">
                      <p className="text-sm font-bold text-foreground">{name}</p>
                      {desc && <Markdown text={desc} tone="slate" size="xs" className="mt-0.5" />}
                    </div>
                  )
                })}
              </RefSection>
            )}
            {d.subraces?.length > 0 && (
              <RefSection title="Subraces">
                <div className="flex flex-col gap-4">
                  {d.subraces.map((s: any, si: number) => (
                    <div key={si}>
                      <p className="text-sm font-bold text-foreground mb-1.5">{s.name}</p>
                      {(s.traits ?? []).map((t: any, ti: number) => {
                        const name = typeof t === "string" ? t : (t?.name ?? "")
                        const desc = typeof t === "string" ? "" : (t?.description ?? "")
                        return (
                          <div key={ti} className="mb-2 pl-3 border-l border-border">
                            <p className="text-xs font-semibold text-foreground">{name}</p>
                            {desc && <Markdown text={desc} tone="slate" size="xs" className="mt-0.5" />}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </RefSection>
            )}
          </>
        )}

        {/* ── FEATS ───────────────────────────────────────────────────── */}
        {type === "feats" && (
          <>
            {d.prerequisite && (
              <RefSection title="Requirements">
                <Prop label="Prerequisite" value={d.prerequisite} />
              </RefSection>
            )}
            {d.description && (
              <RefSection title="Description">
                <Markdown text={d.description} tone="slate" />
              </RefSection>
            )}
          </>
        )}

        {/* ── ITEMS ───────────────────────────────────────────────────── */}
        {type === "items" && (
          <>
            <RefSection title="Properties">
              {d.rarity    && <Prop label="Rarity"    value={<span className="capitalize text-amber-400 font-semibold">{d.rarity}</span>} />}
              {d.item_type && <Prop label="Type"      value={<span className="capitalize">{d.item_type}</span>} />}
              {d.cost      && <Prop label="Cost"      value={d.cost} />}
              {d.requires_attunement && <Prop label="Attunement" value="Requires attunement" />}
              {d.item_type === "weapon" && d.damage && (
                <Prop label="Damage" value={`${d.damage}${d.damage_type ? ` ${d.damage_type}` : ""}`} />
              )}
              {d.item_type === "weapon" && d.properties && <Prop label="Weapon Properties" value={d.properties} />}
            </RefSection>
            {d.item_type === "pack" && d.pack_items?.length > 0 && (
              <RefSection title="Contents">
                <ul className="flex flex-col gap-1.5">
                  {(d.pack_items as PackItem[]).map((it, i) => (
                    <li key={i} className="text-sm text-foreground pl-3 border-l-2 border-border">
                      {it.amount > 1 ? `${it.amount} ${it.name}` : it.name}
                    </li>
                  ))}
                </ul>
              </RefSection>
            )}
            {d.description && (
              <RefSection title="Description">
                <Markdown text={d.description} tone="slate" />
              </RefSection>
            )}
          </>
        )}

        {/* ── BACKGROUNDS ─────────────────────────────────────────────── */}
        {type === "backgrounds" && (
          <>
            {(d.skill_proficiencies || d.tool_proficiencies || d.languages) && (
              <RefSection title="Proficiencies">
                {d.skill_proficiencies && <Prop label="Skills"    value={d.skill_proficiencies} />}
                {d.tool_proficiencies  && <Prop label="Tools"     value={d.tool_proficiencies} />}
                {d.languages           && <Prop label="Languages" value={d.languages} />}
              </RefSection>
            )}
            {d.equipment?.length > 0 && (
              <RefSection title="Equipment">
                <ul className="flex flex-col gap-1.5">
                  {(d.equipment as string[]).map((line, i) => (
                    <li key={i} className="text-sm text-foreground pl-3 border-l-2 border-border">{line}</li>
                  ))}
                </ul>
              </RefSection>
            )}
            {d.feature_name && (
              <RefSection title="Feature">
                <p className="text-sm font-bold text-foreground mb-0.5">{d.feature_name}</p>
                {d.feature_description && <Markdown text={d.feature_description} tone="slate" />}
              </RefSection>
            )}
          </>
        )}
      </div>

      {openSubclass && (
        <SubclassModal
          sc={openSubclass}
          onClose={() => setOpenSubclass(null)}
          canEdit={isAdminMode || (isOwnHomebrew && openSubclass.owner_id === entry.owner_id)}
          onEdit={() => { setOpenSubclass(null); onEditEntry(openSubclass) }}
        />
      )}
    </>
  )
}

// ── Main DocBrowser ────────────────────────────────────────────────────────────

type ViewMode = "list" | "create" | "edit" | "view"

interface Props {
  type: DocType
  isAdminMode: boolean
  userId: string | null
  userEmail: string | null
  onGoToSpells?: (className: string) => void
}

export function DocBrowser({ type, isAdminMode, userId, onGoToSpells }: Props) {
  const [baseEntries,    setBaseEntries]    = useState<DocEntry[]>([])
  const [myHomebrew,     setMyHomebrew]     = useState<DocEntry[]>([])
  const [myLibrary,      setMyLibrary]      = useState<LibraryObject[]>([])
  const [loading,        setLoading]        = useState(true)
  const [viewMode,       setViewMode]       = useState<ViewMode>("list")
  const [activeEntry,    setActiveEntry]    = useState<DocEntry | null>(null)
  const [createHomebrew, setCreateHomebrew] = useState(false)
  const [showHBBrowser,  setShowHBBrowser]  = useState(false)
  const [invocationRefresh, setInvocationRefresh] = useState(0)

  // Search + pagination — one search box filters all three list sections at
  // once (Core/My Homebrew/Homebrew library), each paginated independently
  // at PAGE_SIZE per page so a category with hundreds of entries (e.g. Items,
  // after a bulk import) doesn't dump them all into one giant grid.
  const [search,        setSearch]        = useState("")
  const [basePage,      setBasePage]      = useState(1)
  const [homebrewPage,  setHomebrewPage]  = useState(1)
  const [libraryPage,   setLibraryPage]   = useState(1)

  const singular = SINGULAR[type]
  const label    = TYPE_LABEL[type]

  useEffect(() => {
    setViewMode("list")
    setActiveEntry(null)
    setSearch("")
    setBasePage(1)
    setHomebrewPage(1)
    setLibraryPage(1)
    loadAll()
  }, [type, userId])

  // Search box changes go through this instead of setSearch directly, so
  // typing a new query always snaps every section back to its first page
  // rather than leaving you stranded on, say, page 4 of a now-3-page result.
  function handleSearchChange(v: string) {
    setSearch(v)
    setBasePage(1)
    setHomebrewPage(1)
    setLibraryPage(1)
  }

  // `silent` skips the loading spinner for background refreshes (e.g. after adding/removing
  // homebrew) so the grid doesn't briefly collapse to a few lines of "Loading…" — that height
  // drop was clamping the page's scroll position back up, which looked like a reset to the top.
  async function loadAll(silent = false) {
    if (!silent) setLoading(true)
    const [baseRes, homebrew, library] = await Promise.all([
      supabase.from("documentation").select("*").eq("type", singular).eq("is_homebrew", false).order("name"),
      userId
        ? supabase.from("documentation").select("*").eq("type", singular).eq("is_homebrew", true).eq("owner_id", userId).order("name")
        : Promise.resolve({ data: [] }),
      // No .order() here — the objects table doesn't have a created_at column
      // (ordering by it 400s the whole request), so sort client-side instead.
      userId
        ? supabase.from("objects").select("*").eq("type", `doc_${singular}`).eq("owner_id", userId)
        : Promise.resolve({ data: [], error: null }),
    ])
    const noSubclass = (e: any) => !e.data?.is_subclass
    setBaseEntries(((baseRes.data ?? []) as DocEntry[]).filter(noSubclass))
    setMyHomebrew(((homebrew.data ?? []) as DocEntry[]).filter(noSubclass))
    if ((library as any).error) console.error("Failed to load homebrew library:", (library as any).error)
    const libraryItems = (library.data ?? []) as LibraryObject[]
    libraryItems.sort((a, b) => (b.data?.added_at ?? "").localeCompare(a.data?.added_at ?? ""))
    setMyLibrary(libraryItems)
    setLoading(false)
  }

  async function removeFromLibrary(id: string) {
    await supabase.from("objects").delete().eq("id", id)
    setMyLibrary(prev => prev.filter(l => l.id !== id))
    invalidateSuggestionCache()
  }

  function handleFormSave() { loadAll(true); setInvocationRefresh(n => n + 1); setViewMode("list"); setActiveEntry(null) }
  function openCreate(asHomebrew: boolean) { setCreateHomebrew(asHomebrew); setActiveEntry(null); setViewMode("create") }
  function openEdit(entry: DocEntry) { setActiveEntry(entry); setViewMode("edit") }

  function openEditFromLibrary(item: LibraryObject) {
    supabase.from("documentation").select("*").eq("id", item.data.doc_id).single()
      .then(({ data }) => { if (data) { setActiveEntry(data as DocEntry); setViewMode("edit") } })
  }
  function openViewFromLibrary(item: LibraryObject) {
    supabase.from("documentation").select("*").eq("id", item.data.doc_id).single()
      .then(({ data }) => { if (data) { setActiveEntry(data as DocEntry); setViewMode("view") } })
  }

  // ── Form view ──────────────────────────────────────────────────────────────
  if (viewMode === "create" || viewMode === "edit") {
    const entryIsHomebrew = viewMode === "create" ? createHomebrew : !!(activeEntry?.is_homebrew)
    const canDelete = !!(activeEntry?.id) && (
      isAdminMode || (entryIsHomebrew && !!userId && activeEntry?.owner_id === userId)
    )
    return (
      <DocEntryForm
        type={type}
        initial={activeEntry ?? undefined}
        isHomebrew={entryIsHomebrew}
        userId={userId}
        onSave={handleFormSave}
        onCancel={() => setViewMode(activeEntry ? "view" : "list")}
        onDelete={canDelete ? () => { loadAll(); setViewMode("list"); setActiveEntry(null) } : undefined}
      />
    )
  }

  // ── Detail view ────────────────────────────────────────────────────────────
  if (viewMode === "view" && activeEntry) {
    return (
      <DetailView
        entry={activeEntry}
        type={type}
        isAdminMode={isAdminMode}
        isOwnHomebrew={!!userId && activeEntry.owner_id === userId}
        onBack={() => { setViewMode("list"); setActiveEntry(null) }}
        onEdit={() => openEdit(activeEntry)}
        onEditEntry={openEdit}
        onGoToSpells={onGoToSpells}
      />
    )
  }

  // ── List view ──────────────────────────────────────────────────────────────

  const q = search.trim().toLowerCase()
  const filteredBase     = q ? baseEntries.filter(e => e.name.toLowerCase().includes(q)) : baseEntries
  const filteredHomebrew = q ? myHomebrew.filter(e => e.name.toLowerCase().includes(q))  : myHomebrew
  const filteredLibrary  = q ? myLibrary.filter(l => l.name.toLowerCase().includes(q))   : myLibrary

  const basePageItems     = filteredBase.slice((basePage - 1) * PAGE_SIZE, basePage * PAGE_SIZE)
  const homebrewPageItems = filteredHomebrew.slice((homebrewPage - 1) * PAGE_SIZE, homebrewPage * PAGE_SIZE)
  const libraryPageItems  = filteredLibrary.slice((libraryPage - 1) * PAGE_SIZE, libraryPage * PAGE_SIZE)

  // Suggestion pool for the search box's dropdown — every entry across all
  // three sections, so typing a name suggests it regardless of which list it
  // actually lives in.
  const searchPool = [
    ...baseEntries.map(e => ({ id: e.id, name: e.name })),
    ...myHomebrew.map(e => ({ id: e.id, name: e.name })),
    ...myLibrary.map(l => ({ id: l.id, name: l.name })),
  ]

  return (
    <div className="flex flex-col gap-10">

      {!loading && (baseEntries.length > 0 || myHomebrew.length > 0 || myLibrary.length > 0) && (
        <DocSearchBar value={search} onChange={handleSearchChange} pool={searchPool} placeholder={`Search ${label.toLowerCase()}s…`} />
      )}

      {/* Core entries */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-bold text-amber-400">
            Core Rulebook{!loading && baseEntries.length > 0 ? ` (${q ? `${filteredBase.length} of ${baseEntries.length}` : baseEntries.length})` : ""}
          </h2>
          {isAdminMode && (
            <button onClick={() => openCreate(false)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-amber-900/50 text-amber-500 hover:border-amber-700 transition-colors">
              <Pencil className="size-3" /> Add Core {label}
            </button>
          )}
        </div>
        <div className="border-t border-amber-900/30 mb-4" />

        {loading ? (
          <div className="flex items-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /><span className="text-sm">Loading…</span>
          </div>
        ) : baseEntries.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-border rounded-lg">
            <p className="text-sm text-muted-foreground">No entries yet.</p>
            {isAdminMode && <p className="text-xs text-muted-foreground mt-1">Use "Add Core {label}" above.</p>}
          </div>
        ) : filteredBase.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-border rounded-lg">
            <p className="text-sm text-muted-foreground">No {label.toLowerCase()}s match "{search}".</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              {basePageItems.map(entry => (
                <DocCard key={entry.id} name={entry.name} caption={entry.description} canEdit={isAdminMode}
                  onClick={() => { setActiveEntry(entry); setViewMode("view") }}
                  onEdit={() => openEdit(entry)} />
              ))}
            </div>
            <Paginator page={basePage} total={filteredBase.length} onChange={setBasePage} />
          </>
        )}
      </section>

      {type === "feats" && <InvocationsSection userId={userId} isAdminMode={isAdminMode} refreshKey={invocationRefresh} />}

      {/* My Homebrew */}
      {userId && myHomebrew.length > 0 && (
        <section>
          <h2 className="text-base font-bold text-amber-400 mb-2">
            My {label}s ({q ? `${filteredHomebrew.length} of ${myHomebrew.length}` : myHomebrew.length})
          </h2>
          <div className="border-t border-amber-900/30 mb-4" />
          {filteredHomebrew.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No matches in your homebrew.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {homebrewPageItems.map(entry => (
                  <DocCard key={entry.id} name={entry.name} canEdit
                    onClick={() => { setActiveEntry(entry); setViewMode("view") }}
                    onEdit={() => openEdit(entry)} />
                ))}
              </div>
              <Paginator page={homebrewPage} total={filteredHomebrew.length} onChange={setHomebrewPage} />
            </>
          )}
        </section>
      )}

      {/* Homebrew — added-to-library entries that feed autofill on the character sheet */}
      {userId && myLibrary.length > 0 && (
        <section>
          <h2 className="text-base font-bold text-amber-400 mb-2">
            Homebrew ({q ? `${filteredLibrary.length} of ${myLibrary.length}` : myLibrary.length})
          </h2>
          <p className="text-xs text-muted-foreground -mt-1 mb-2">These show up in autofill on your character sheet. Remove one to take it out of autofill.</p>
          <div className="border-t border-amber-900/30 mb-4" />
          {filteredLibrary.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No matches in your library.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {libraryPageItems.map(item => (
                  <DocCard key={item.id} name={item.name} canEdit={item.data.doc_owner_id === userId}
                    onClick={() => openViewFromLibrary(item)}
                    onEdit={() => openEditFromLibrary(item)}
                    extraAction={
                      <span role="button" onClick={e => { e.stopPropagation(); removeFromLibrary(item.id) }}
                        className="size-6 flex items-center justify-center rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-400">
                        <X className="size-3" />
                      </span>
                    }
                  />
                ))}
              </div>
              <Paginator page={libraryPage} total={filteredLibrary.length} onChange={setLibraryPage} />
            </>
          )}
        </section>
      )}

      {/* Community Homebrew */}
      <section>
        <h2 className="text-base font-bold text-amber-400 mb-2">Community Homebrew</h2>
        <div className="border-t border-amber-900/30 mb-4" />
        <div className="flex items-center justify-between py-3">
          <p className="text-sm text-muted-foreground">Browse community {label.toLowerCase()}s or publish your own.</p>
          <button onClick={() => setShowHBBrowser(true)}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded border border-border text-muted-foreground hover:text-purple-400 hover:border-purple-700/50 transition-colors shrink-0 ml-4">
            <Library className="size-3.5" /> Browse {label}s
          </button>
        </div>
      </section>

      {showHBBrowser && (
        <HomebrewBrowserModal
          type={type}
          userId={userId}
          existingLibraryIds={new Set(myLibrary.map(l => l.data.doc_id))}
          onClose={() => setShowHBBrowser(false)}
          onAddNew={() => { setShowHBBrowser(false); openCreate(true) }}
          onLibraryChanged={() => loadAll(true)}
          onEditEntry={entry => { setShowHBBrowser(false); openEdit(entry) }}
        />
      )}
    </div>
  )
}
