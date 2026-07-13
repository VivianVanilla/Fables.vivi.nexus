// ════════════════════════════════════════════════════════════════════════════
// SpellPickerModal.tsx — searchable menu of real SRD spells to add from,
// instead of typing a name into a blank entry with free reign over every
// field. "+ Add a custom/homebrew spell instead" still opens a blank entry,
// for the rare monster ability that isn't a real spell.
//
// Level/School filter down to a specific list, then "Import All" adds every
// spell currently matching search+filters in one go — e.g. filter to Level 3
// Evocation and pull in the whole set instead of adding them one at a time.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from "react"
import { Modal } from "../ui/Modal"
import { getSpells } from "../../../../src/spells/spellCache"
import type { Spell } from "../../../../src/spells/types"

interface Props {
  onClose: () => void
  onPick: (spell: Spell) => void
  onImportAll: (spells: Spell[]) => void
  onCustom: () => void
}

const LEVEL_LABELS = ["Cantrip", "1", "2", "3", "4", "5", "6", "7", "8", "9"]

export function SpellPickerModal({ onClose, onPick, onImportAll, onCustom }: Props) {
  const [allSpells, setAllSpells] = useState<Spell[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [levelFilter, setLevelFilter] = useState("all")
  const [schoolFilter, setSchoolFilter] = useState("all")

  useEffect(() => {
    let cancelled = false
    getSpells().then(spells => { if (!cancelled) { setAllSpells(spells); setLoading(false) } })
    return () => { cancelled = true }
  }, [])

  const schools = useMemo(() => {
    const set = new Set<string>()
    for (const s of allSpells) if (s.school?.name) set.add(s.school.name)
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [allSpells])

  const q = query.trim().toLowerCase()
  const matches = allSpells
    .filter(s => !q || s.name.toLowerCase().includes(q))
    .filter(s => levelFilter === "all" || s.level === parseInt(levelFilter))
    .filter(s => schoolFilter === "all" || s.school?.name === schoolFilter)
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))

  const filtersActive = q !== "" || levelFilter !== "all" || schoolFilter !== "all"

  return (
    <Modal onClose={onClose}>
      <div className="bg-zinc-900 border border-white/15 rounded-2xl shadow-2xl w-[min(480px,calc(100vw-2rem))] max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <p className="text-sm font-bold text-white">Add Spell</p>
          <button type="button" onClick={onClose}
            className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors">✕</button>
        </div>

        <div className="p-4 border-b border-white/10 shrink-0 flex flex-col gap-2">
          <input value={query} onChange={e => setQuery(e.target.value)} autoFocus placeholder="Search spells…"
            className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:ring-1 focus:ring-white/30" />
          <div className="flex items-center gap-2">
            <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)}
              className="flex-1 min-w-0 bg-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none">
              <option value="all" className="bg-zinc-800 text-white">All Levels</option>
              {LEVEL_LABELS.map((label, lvl) => (
                <option key={lvl} value={lvl} className="bg-zinc-800 text-white">{label === "Cantrip" ? "Cantrip" : `Level ${label}`}</option>
              ))}
            </select>
            <select value={schoolFilter} onChange={e => setSchoolFilter(e.target.value)}
              className="flex-1 min-w-0 bg-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none">
              <option value="all" className="bg-zinc-800 text-white">All Schools</option>
              {schools.map(s => <option key={s} value={s} className="bg-zinc-800 text-white">{s}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-2 min-h-40">
          {loading ? (
            <p className="text-xs text-white/30 italic px-3 py-6 text-center">Loading spells…</p>
          ) : matches.length === 0 ? (
            <p className="text-xs text-white/30 italic px-3 py-6 text-center">No spells match these filters.</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {matches.slice(0, 200).map(s => (
                <button key={s.index} type="button" onClick={() => onPick(s)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 transition-colors flex items-center justify-between gap-3">
                  <span className="text-sm text-white truncate">{s.name}</span>
                  <span className="text-[10px] text-white/40 shrink-0">
                    {s.level === 0 ? "Cantrip" : `Lv ${s.level}`} · {s.school?.name}
                  </span>
                </button>
              ))}
              {matches.length > 200 && (
                <p className="text-[10px] text-white/25 italic text-center py-2">Showing first 200 — keep narrowing the filters to see more.</p>
              )}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-white/10 shrink-0 flex items-center justify-between gap-2">
          <button type="button" onClick={onCustom}
            className="text-xs text-white/40 hover:text-white transition-colors shrink-0">
            + Custom/homebrew spell
          </button>
          {!loading && matches.length > 0 && (
            <button type="button" onClick={() => onImportAll(matches)}
              disabled={!filtersActive}
              title={filtersActive ? undefined : "Search or filter first, so this doesn't import the entire spell list"}
              className="text-xs font-semibold px-3 py-1.5 rounded-full bg-primary/80 hover:bg-primary disabled:opacity-30 disabled:hover:bg-primary/80 text-white transition-colors shrink-0">
              Import All ({matches.length})
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
