// ════════════════════════════════════════════════════════════════════════════
// DocBrowser.tsx — PHB-style reference browser
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react"
import { supabase } from "../../../src/supabase"
import { Pencil, Library, Loader2, ArrowLeft, X, ExternalLink, Sparkles } from "lucide-react"
import type { DocType, DocEntry } from "./doc-types"
import { SINGULAR, TYPE_LABEL } from "./doc-types"
import { DocEntryForm } from "./DocEntryForm"
import { HomebrewBrowserModal } from "./HomebrewBrowserModal"
import { Markdown } from "../ui/Markdown"

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
      <span className="font-semibold text-slate-200 shrink-0">{label}:</span>
      <span className="text-slate-400 sm:ml-0.5">{value}</span>
    </div>
  )
}

// ── Subclass spells table helper ───────────────────────────────────────────────

function SpellsTable({ rows }: { rows: { level: number; spells: string[] }[] }) {
  if (!rows?.length) return null
  return (
    <table className="w-full text-sm border-collapse mt-1">
      <thead>
        <tr>
          <th className="text-left text-[10px] uppercase tracking-wider text-slate-500 font-semibold pb-2 w-28">Level</th>
          <th className="text-left text-[10px] uppercase tracking-wider text-slate-500 font-semibold pb-2">Spells</th>
        </tr>
      </thead>
      <tbody>
        {[...rows].sort((a,b) => a.level - b.level).map(row => (
          <tr key={row.level} className="border-t border-slate-800/60">
            <td className="py-2 text-slate-400">{ORDINAL[row.level] ?? row.level}</td>
            <td className="py-2 text-slate-300">{(row.spells ?? []).join(", ")}</td>
          </tr>
        ))}
      </tbody>
    </table>
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
  const domainSpells: { level: number; spells: string[] }[] = d.domain_spells ?? []

  const byLevel = features.reduce<Record<number, any[]>>((acc, f) => {
    if (!acc[f.level]) acc[f.level] = []
    acc[f.level].push(f)
    return acc
  }, {})

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-950 border border-slate-700 rounded-xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-slate-800 shrink-0">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-amber-500/60 font-semibold mb-0.5">Subclass</p>
            <h2 className="text-xl font-bold text-slate-100">{sc.name}</h2>
            {sc.description && <p className="text-sm text-slate-500 mt-0.5 leading-snug italic">{sc.description}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canEdit && onEdit && (
              <button onClick={() => { onClose(); onEdit() }}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-amber-900/50 text-amber-500 hover:border-amber-700 transition-colors">
                <Pencil className="size-3" /> Edit
              </button>
            )}
            <button onClick={onClose} className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-200">
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {domainSpells.length > 0 && (
            <RefSection title="Subclass Spells">
              <SpellsTable rows={domainSpells} />
            </RefSection>
          )}

          {features.length > 0 && (
            <RefSection title="Subclass Features">
              {Object.entries(byLevel).sort(([a],[b]) => parseInt(a)-parseInt(b)).map(([level, feats]) => (
                <div key={level} className="mb-5 last:mb-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                    Level {level}
                  </p>
                  {(feats as any[]).map((f: any) => (
                    <div key={f.id} className="mb-3 last:mb-0">
                      <p className="text-sm font-bold text-slate-200 mb-0.5">{f.name}</p>
                      {f.description && <Markdown text={f.description} tone="slate" />}
                    </div>
                  ))}
                </div>
              ))}
            </RefSection>
          )}

          {features.length === 0 && domainSpells.length === 0 && (
            <p className="text-sm text-slate-600 italic mt-2">No features recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Entry card ─────────────────────────────────────────────────────────────────

function DocCard({
  entry, isAdminMode, onClick, onEdit,
}: {
  entry: DocEntry
  isAdminMode: boolean
  onClick: () => void
  onEdit: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex flex-col items-center justify-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/50 p-3 hover:border-amber-900/60 hover:bg-slate-900 transition-all min-h-[80px] text-center w-full"
    >
      {isAdminMode && (
        <span
          role="button"
          onClick={e => { e.stopPropagation(); onEdit() }}
          className="absolute top-2 right-2 size-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-amber-500/20 text-slate-700 hover:text-amber-400 transition-all"
        >
          <Pencil className="size-3" />
        </span>
      )}
      <p className="text-sm font-semibold text-slate-200 leading-tight px-5">{entry.name}</p>
      {entry.description && (
        <p className="text-[10px] text-slate-600 leading-tight">{entry.description}</p>
      )}
    </button>
  )
}

// ── Library card ───────────────────────────────────────────────────────────────

function LibraryCard({
  item, isOwner, onRemove, onEdit, onClick,
}: {
  item: LibraryObject
  isOwner: boolean
  onRemove: () => void
  onEdit: () => void
  onClick: () => void
}) {
  const addedDate = item.data.added_at
    ? new Date(item.data.added_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : null

  return (
    <div className="flex items-center gap-3 border-b border-slate-800/60 py-3 last:border-0">
      <button type="button" onClick={onClick} className="flex-1 min-w-0 text-left">
        <p className="text-sm font-semibold text-slate-200 truncate">{item.name}</p>
        <p className="text-xs text-slate-600 mt-0.5">
          {item.data.description}{addedDate && ` · Added ${addedDate}`}
        </p>
      </button>
      <div className="flex items-center gap-2 shrink-0">
        {isOwner && (
          <button onClick={onEdit} className="text-xs text-amber-500/80 hover:text-amber-400 transition-colors">Edit</button>
        )}
        <button onClick={onRemove} className="size-6 flex items-center justify-center text-slate-700 hover:text-red-400 transition-colors">
          <X className="size-3.5" />
        </button>
      </div>
    </div>
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
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors">
            <ArrowLeft className="size-4" /> Back
          </button>
          <div className="flex items-center gap-2">
            {type === "classes" && onGoToSpells && (
              <button onClick={() => onGoToSpells(entry.name)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-slate-700 text-slate-400 hover:text-purple-400 hover:border-purple-700/40 transition-colors">
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
            <h1 className="text-2xl font-bold text-slate-100">{entry.name}</h1>
            {entry.is_homebrew && (
              <span className="text-xs text-purple-400 font-semibold uppercase tracking-wider">Homebrew</span>
            )}
          </div>
          {entry.description && (
            <p className="text-sm text-slate-500 mt-1 italic leading-relaxed">{entry.description}</p>
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
                <p className="text-sm text-slate-400 mb-2">
                  You start with the following equipment, in addition to the equipment granted by your background:
                </p>
                <ul className="flex flex-col gap-1.5">
                  {(d.equipment as string[]).map((line, i) => (
                    <li key={i} className="text-sm text-slate-300 pl-3 border-l-2 border-slate-800">{line}</li>
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
                <p className="text-sm text-slate-500 italic mb-4">
                  As a {className}, you gain the following class features.
                </p>
                {Object.entries(byLevel).sort(([a],[b]) => parseInt(a)-parseInt(b)).map(([level, feats]) => (
                  <div key={level} className="mb-5 last:mb-0">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                      Level {level}
                    </p>
                    {(feats as any[]).map((f: any) => (
                      <div key={f.id} className="mb-3 last:mb-0">
                        <p className="text-sm font-bold text-slate-200 mb-0.5">{f.name}</p>
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
                  <p className="text-sm text-slate-600 italic">No subclasses recorded yet.</p>
                ) : (
                  <div>
                    {subclasses.map(sc => (
                      <button
                        key={sc.id}
                        type="button"
                        onClick={() => setOpenSubclass(sc)}
                        className="group w-full flex items-center justify-between py-3 border-b border-slate-800/60 last:border-0 text-left transition-colors hover:bg-slate-900/40 px-1 rounded"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-200 group-hover:text-amber-400 transition-colors">{sc.name}</p>
                          {sc.description && <p className="text-xs text-slate-600 mt-0.5">{sc.description}</p>}
                        </div>
                        <ExternalLink className="size-3.5 text-slate-700 group-hover:text-amber-500 shrink-0 ml-3 transition-colors" />
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
                      className="group w-full flex items-center justify-between py-3 border-b border-slate-800/60 last:border-0 text-left hover:bg-slate-900/40 px-1 rounded transition-colors"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-200 group-hover:text-amber-400 transition-colors">{sc.name}</p>
                        {sc.description && <p className="text-xs text-slate-600 mt-0.5">{sc.description}</p>}
                      </div>
                      <ExternalLink className="size-3.5 text-slate-700 group-hover:text-amber-500 shrink-0 ml-3 transition-colors" />
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
                      <p className="text-sm font-bold text-slate-200">{name}</p>
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
                      <p className="text-sm font-bold text-slate-200 mb-1.5">{s.name}</p>
                      {(s.traits ?? []).map((t: any, ti: number) => {
                        const name = typeof t === "string" ? t : (t?.name ?? "")
                        const desc = typeof t === "string" ? "" : (t?.description ?? "")
                        return (
                          <div key={ti} className="mb-2 pl-3 border-l border-slate-700">
                            <p className="text-xs font-semibold text-slate-300">{name}</p>
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
              {d.requires_attunement && <Prop label="Attunement" value="Requires attunement" />}
            </RefSection>
            {d.description && (
              <RefSection title="Description">
                <Markdown text={d.description} tone="slate" />
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

  const singular = SINGULAR[type]
  const label    = TYPE_LABEL[type]

  useEffect(() => {
    setViewMode("list")
    setActiveEntry(null)
    loadAll()
  }, [type, userId])

  async function loadAll() {
    setLoading(true)
    const [baseRes, homebrew, library] = await Promise.all([
      supabase.from("documentation").select("*").eq("type", singular).eq("is_homebrew", false).order("name"),
      userId
        ? supabase.from("documentation").select("*").eq("type", singular).eq("is_homebrew", true).eq("owner_id", userId).order("name")
        : Promise.resolve({ data: [] }),
      userId
        ? supabase.from("objects").select("*").eq("type", `doc_${singular}`).eq("owner_id", userId).order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
    ])
    const noSubclass = (e: any) => !e.data?.is_subclass
    setBaseEntries(((baseRes.data ?? []) as DocEntry[]).filter(noSubclass))
    setMyHomebrew(((homebrew.data ?? []) as DocEntry[]).filter(noSubclass))
    setMyLibrary((library.data ?? []) as LibraryObject[])
    setLoading(false)
  }

  async function removeFromLibrary(id: string) {
    await supabase.from("objects").delete().eq("id", id)
    setMyLibrary(prev => prev.filter(l => l.id !== id))
  }

  function handleFormSave() { loadAll(); setViewMode("list"); setActiveEntry(null) }
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
  return (
    <div className="flex flex-col gap-10">

      {/* Core entries */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-bold text-amber-400">
            Core Rulebook{!loading && baseEntries.length > 0 ? ` (${baseEntries.length})` : ""}
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
          <div className="flex items-center gap-2 py-10 text-slate-600">
            <Loader2 className="size-4 animate-spin" /><span className="text-sm">Loading…</span>
          </div>
        ) : baseEntries.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-slate-800 rounded-lg">
            <p className="text-sm text-slate-600">No entries yet.</p>
            {isAdminMode && <p className="text-xs text-slate-700 mt-1">Use "Add Core {label}" above.</p>}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {baseEntries.map(entry => (
              <DocCard key={entry.id} entry={entry} isAdminMode={isAdminMode}
                onClick={() => { setActiveEntry(entry); setViewMode("view") }}
                onEdit={() => openEdit(entry)} />
            ))}
          </div>
        )}
      </section>

      {/* My Homebrew */}
      {userId && myHomebrew.length > 0 && (
        <section>
          <h2 className="text-base font-bold text-amber-400 mb-2">My {label}s ({myHomebrew.length})</h2>
          <div className="border-t border-amber-900/30 mb-4" />
          <div>
            {myHomebrew.map(entry => (
              <div key={entry.id} className="flex items-center gap-3 py-3 border-b border-slate-800/60 last:border-0">
                <button type="button" onClick={() => { setActiveEntry(entry); setViewMode("view") }} className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-semibold text-slate-200 truncate">{entry.name}</p>
                  {entry.description && <p className="text-xs text-slate-600 mt-0.5 truncate">{entry.description}</p>}
                </button>
                <button onClick={() => openEdit(entry)}
                  className="text-xs text-amber-500/80 hover:text-amber-400 transition-colors shrink-0">
                  Edit
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* My Library */}
      {userId && myLibrary.length > 0 && (
        <section>
          <h2 className="text-base font-bold text-amber-400 mb-2">My Library ({myLibrary.length})</h2>
          <div className="border-t border-amber-900/30 mb-4" />
          <div>
            {myLibrary.map(item => (
              <LibraryCard key={item.id} item={item} isOwner={item.data.doc_owner_id === userId}
                onRemove={() => removeFromLibrary(item.id)}
                onEdit={() => openEditFromLibrary(item)}
                onClick={() => openViewFromLibrary(item)} />
            ))}
          </div>
        </section>
      )}

      {/* Community Homebrew */}
      <section>
        <h2 className="text-base font-bold text-amber-400 mb-2">Community Homebrew</h2>
        <div className="border-t border-amber-900/30 mb-4" />
        <div className="flex items-center justify-between py-3">
          <p className="text-sm text-slate-500">Browse community {label.toLowerCase()}s or publish your own.</p>
          <button onClick={() => setShowHBBrowser(true)}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded border border-slate-700 text-slate-400 hover:text-purple-400 hover:border-purple-700/50 transition-colors shrink-0 ml-4">
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
          onLibraryChanged={loadAll}
          onEditEntry={entry => { setShowHBBrowser(false); openEdit(entry) }}
        />
      )}
    </div>
  )
}
