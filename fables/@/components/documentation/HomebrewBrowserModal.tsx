// ════════════════════════════════════════════════════════════════════════════
// HomebrewBrowserModal.tsx — Browse all published homebrew for a given type
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react"
import { supabase } from "../../../src/supabase"
import { X, ChevronRight, Check, Loader2, Plus, Pencil, Trash2 } from "lucide-react"
import type { DocType, DocEntry } from "./doc-types"
import { SINGULAR, TYPE_LABEL } from "./doc-types"
import { Markdown } from "../ui/Markdown"
import { invalidateSuggestionCache } from "../character/entries/FeatureEntry"

interface Props {
  type: DocType
  userId: string | null
  existingLibraryIds: Set<string>  // set of doc_ids already in the user's library
  onClose: () => void
  onAddNew?: () => void
  onLibraryChanged: () => void   // called after add/remove so DocBrowser reloads
  onEditEntry: (entry: DocEntry) => void  // called when user edits their own entry
}

// Rarity color helpers for items
const RARITY_COLOR: Record<string, string> = {
  common: "text-slate-400",
  uncommon: "text-green-400",
  rare: "text-blue-400",
  "very rare": "text-purple-400",
  legendary: "text-amber-400",
  artifact: "text-red-400",
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-slate-500 shrink-0 w-32">{label}</span>
      <span className="text-slate-300">{value}</span>
    </div>
  )
}


// ── Entry detail panel ────────────────────────────────────────────────────────

function EntryDetail({ entry, type, userId, libraryState, onAdd, onRemove, onEdit }: {
  entry: DocEntry
  type: DocType
  userId: string | null
  libraryState: Map<string, { objectId: string; added_at: string }>
  onAdd: (entry: DocEntry) => void
  onRemove: (docId: string) => void
  onEdit: (entry: DocEntry) => void
}) {
  const d = entry.data ?? {}
  const lib = libraryState.get(entry.id)
  const isAdded = !!lib
  const isOwner = !!userId && entry.owner_id === userId

  const addedDate = lib?.added_at
    ? new Date(lib.added_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : null

  return (
    <div className="flex flex-col gap-4">
      {/* Title + actions */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-100">{entry.name}</h3>
          <p className="text-sm text-slate-500 mt-0.5">{entry.description}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {isOwner ? (
            <button
              onClick={() => onEdit(entry)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors"
            >
              <Pencil className="size-3.5" /> Edit
            </button>
          ) : userId ? (
            isAdded ? (
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-green-800/30 text-green-400 border border-green-700/30">
                  <Check className="size-3.5" /> Added
                </div>
                {addedDate && <p className="text-[10px] text-slate-600">Since {addedDate}</p>}
                <button
                  onClick={() => onRemove(entry.id)}
                  className="flex items-center gap-1 text-[10px] text-slate-700 hover:text-red-400 transition-colors mt-0.5"
                >
                  <Trash2 className="size-3" /> Remove from library
                </button>
              </div>
            ) : (
              <button
                onClick={() => onAdd(entry)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-colors"
              >
                Add to Library
              </button>
            )
          ) : (
            <p className="text-xs text-slate-600 italic">Sign in to save</p>
          )}
        </div>
      </div>

      {/* Type-specific detail */}
      {type === "classes" && (
        <div className="flex flex-col gap-2 text-sm">
          {d.hit_die && <Row label="Hit Die" value={d.hit_die} />}
          {d.saving_throws?.length > 0 && <Row label="Saving Throws" value={d.saving_throws.map((s: string) => s.toUpperCase()).join(", ")} />}
          {d.spellcasting_ability && <Row label="Spellcasting" value={`${d.spellcasting_ability.toUpperCase()} (${d.spellcasting_type})`} />}
          {d.armor_proficiencies?.length > 0 && <Row label="Armor" value={d.armor_proficiencies.join(", ")} />}
          {d.weapon_proficiencies?.length > 0 && (
            <Row label="Weapons" value={(Array.isArray(d.weapon_proficiencies) ? d.weapon_proficiencies : [d.weapon_proficiencies]).join(", ")} />
          )}
          {d.subclass_level && <Row label="Subclass at" value={`Level ${d.subclass_level}`} />}
          {d.features?.length > 0 && (
            <div className="mt-2 flex flex-col gap-1">
              <span className="text-slate-500 font-medium">Features ({d.features.length})</span>
              {(d.features as any[]).slice(0, 5).map((f: any) => (
                <div key={f.id} className="flex gap-2 text-xs">
                  <span className="text-slate-600 shrink-0 w-12">Lv {f.level}</span>
                  <span className="text-slate-400">{f.name}</span>
                </div>
              ))}
              {d.features.length > 5 && <span className="text-xs text-slate-600">+{d.features.length - 5} more…</span>}
            </div>
          )}
        </div>
      )}

      {type === "races" && (
        <div className="flex flex-col gap-2 text-sm">
          <Row label="Speed" value={`${d.speed ?? 30} ft`} />
          <Row label="Size" value={d.size ?? "Medium"} />
          {d.darkvision > 0 && <Row label="Darkvision" value={`${d.darkvision} ft`} />}
          {d.ability_bonuses && (
            <Row
              label="Ability Bonuses"
              value={
                Object.entries(d.ability_bonuses)
                  .filter(([,v]) => (v as number) !== 0)
                  .map(([k,v]) => `${k.toUpperCase()} +${v}`)
                  .join(", ") || "None"
              }
            />
          )}
          {d.languages?.length > 0 && <Row label="Languages" value={d.languages.join(", ")} />}
          {d.traits?.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-slate-500 font-medium">Traits</span>
              <div className="flex flex-wrap gap-1.5">
                {d.traits.map((t: string) => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">{t}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {type === "feats" && (
        <div className="flex flex-col gap-2 text-sm">
          {d.prerequisite && <Row label="Prerequisite" value={d.prerequisite} />}
          {d.description && <Markdown text={d.description} tone="slate" />}
        </div>
      )}

      {type === "items" && (
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-semibold ${RARITY_COLOR[d.rarity ?? "common"] ?? "text-slate-400"}`}>
              {(d.rarity ?? "Common").replace(/\b\w/g, (c: string) => c.toUpperCase())}
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400">{(d.item_type ?? "Wondrous").replace(/\b\w/g, (c: string) => c.toUpperCase())}</span>
            {d.requires_attunement && <span className="text-xs text-amber-400">(requires attunement)</span>}
          </div>
          {d.item_type === "weapon" && d.damage && (
            <Row label="Damage" value={`${d.damage}${d.damage_type ? ` ${d.damage_type}` : ""}`} />
          )}
          {d.item_type === "weapon" && d.properties && <Row label="Properties" value={d.properties} />}
          {d.description && <Markdown text={d.description} tone="slate" />}
          {d.ac_bonus    && <Row label="AC Bonus"    value={`+${d.ac_bonus}`} />}
          {d.save_bonus  && <Row label="Save Bonus"  value={`+${d.save_bonus}`} />}
          {d.set_stat    && <Row label="Sets"        value={`${d.set_stat.ability.toUpperCase()} = ${d.set_stat.value}`} />}
        </div>
      )}
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export function HomebrewBrowserModal({
  type, userId, existingLibraryIds, onClose, onAddNew, onLibraryChanged, onEditEntry,
}: Props) {
  const [entries,      setEntries]      = useState<DocEntry[]>([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState("")
  const [selected,     setSelected]     = useState<DocEntry | null>(null)
  // Maps doc_id → { objectId, added_at }
  const [libraryState, setLibraryState] = useState<Map<string, { objectId: string; added_at: string }>>(new Map())

  const singular = SINGULAR[type]

  // Load all homebrew entries for this type
  useEffect(() => {
    supabase
      .from("documentation")
      .select("*")
      .eq("type", singular)
      .eq("is_homebrew", true)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setEntries((data ?? []) as DocEntry[])
        setLoading(false)
      })
  }, [type])

  // Load library state (doc_ids the user already added) to get objectId + added_at
  useEffect(() => {
    if (!userId || existingLibraryIds.size === 0) return
    supabase
      .from("objects")
      .select("id, data")
      .eq("type", `doc_${singular}`)
      .eq("owner_id", userId)
      .then(({ data, error }) => {
        if (error) { console.error("Failed to load library state:", error); return }
        const map = new Map<string, { objectId: string; added_at: string }>()
        for (const obj of data ?? []) {
          const docId = (obj as any).data?.doc_id
          if (docId) {
            map.set(docId, {
              objectId: (obj as any).id,
              added_at: (obj as any).data?.added_at ?? "",
            })
          }
        }
        setLibraryState(map)
      })
  }, [userId, type])

  async function addToLibrary(entry: DocEntry) {
    if (!userId) return
    const added_at = new Date().toISOString()
    const { data, error } = await supabase.from("objects").insert({
      name: entry.name,
      type: `doc_${singular}`,
      owner_id: userId,
      parent_id: null,
      position: 0,
      created_date: added_at.split("T")[0],
      data: {
        doc_id: entry.id,
        doc_type: singular,
        doc_owner_id: entry.owner_id,
        name: entry.name,
        description: entry.description,
        source: "homebrew",
        added_at,
        ...entry.data,
      },
    }).select("id").single()

    if (error) {
      console.error("Failed to add to library:", error)
      return
    }

    if (data) {
      setLibraryState(prev => new Map(prev).set(entry.id, { objectId: (data as any).id, added_at }))
      invalidateSuggestionCache()
      onLibraryChanged()
    }
  }

  async function removeFromLibrary(docId: string) {
    const lib = libraryState.get(docId)
    if (!lib) return
    await supabase.from("objects").delete().eq("id", lib.objectId)
    setLibraryState(prev => {
      const next = new Map(prev)
      next.delete(docId)
      return next
    })
    invalidateSuggestionCache()
    onLibraryChanged()
  }

  const filtered = entries.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.description?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800 shrink-0">
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-slate-100">
              Community {type.charAt(0).toUpperCase() + type.slice(1)}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{filtered.length} entries · click to view details</p>
          </div>
          {onAddNew && userId && (
            <button
              onClick={onAddNew}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/15 border border-purple-600/25 text-purple-400 hover:bg-purple-600/25 text-sm font-medium transition-colors shrink-0"
            >
              <Plus className="size-3.5" />
              Add New {TYPE_LABEL[type]}
            </button>
          )}
          <button onClick={onClose} className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-200 shrink-0">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* List panel — hidden on mobile when something is selected */}
          <div className={`${selected ? "hidden sm:flex" : "flex"} flex-col w-full sm:w-72 sm:shrink-0 border-r border-slate-800`}>
            <div className="p-3 border-b border-slate-800">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-purple-500 placeholder:text-slate-600"
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="size-5 text-slate-600 animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-slate-600 text-center p-8">
                  {search ? "No matches" : `No homebrew ${type} yet`}
                </p>
              ) : (
                filtered.map(e => {
                  const inLib = libraryState.has(e.id)
                  const isOwn = !!userId && e.owner_id === userId
                  return (
                    <button
                      key={e.id}
                      onClick={() => setSelected(e)}
                      className={`w-full text-left flex items-center justify-between px-4 py-3 border-b border-slate-800/50 transition-colors hover:bg-slate-800/50 ${selected?.id === e.id ? "bg-slate-800" : ""}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-200 truncate">{e.name}</p>
                        <p className="text-xs text-slate-600 truncate mt-0.5">{e.description}</p>
                      </div>
                      <div className="shrink-0 ml-2 flex items-center gap-1.5">
                        {isOwn && <Pencil className="size-3 text-amber-600" />}
                        {inLib && <Check className="size-3 text-green-500" />}
                        <ChevronRight className="size-4 text-slate-600" />
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Detail panel — full-width on mobile (replaces list), right column on sm+ */}
          <div className={`${selected ? "flex" : "hidden sm:flex"} flex-1 flex-col overflow-y-auto`}>
            {/* Back button — mobile only */}
            {selected && (
              <button
                onClick={() => setSelected(null)}
                className="sm:hidden flex items-center gap-1.5 px-4 py-3 text-sm text-slate-400 hover:text-slate-200 border-b border-slate-800 shrink-0 transition-colors"
              >
                <ChevronRight className="size-4 rotate-180" />
                Back to list
              </button>
            )}
            <div className="flex-1 overflow-y-auto p-6">
              {selected ? (
                <EntryDetail
                  entry={selected}
                  type={type}
                  userId={userId}
                  libraryState={libraryState}
                  onAdd={addToLibrary}
                  onRemove={removeFromLibrary}
                  onEdit={onEditEntry}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center gap-2">
                  <p className="text-slate-600 text-sm">Select a {TYPE_LABEL[type]} from the list to view details</p>
                  {!userId && (
                    <p className="text-xs text-slate-700">Sign in to add entries to your library</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
