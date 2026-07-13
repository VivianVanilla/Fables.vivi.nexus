// ════════════════════════════════════════════════════════════════════════════
// SpellPickerModal.tsx — searchable menu of real SRD spells to add from,
// instead of typing a name into a blank entry with free reign over every
// field. "+ Add a custom/homebrew spell instead" still opens a blank entry,
// for the rare monster ability that isn't a real spell.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react"
import { Modal } from "../ui/Modal"
import { getSpells } from "../../../../src/spells/spellCache"
import type { Spell } from "../../../../src/spells/types"

interface Props {
  onClose: () => void
  onPick: (spell: Spell) => void
  onCustom: () => void
}

export function SpellPickerModal({ onClose, onPick, onCustom }: Props) {
  const [allSpells, setAllSpells] = useState<Spell[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")

  useEffect(() => {
    let cancelled = false
    getSpells().then(spells => { if (!cancelled) { setAllSpells(spells); setLoading(false) } })
    return () => { cancelled = true }
  }, [])

  const q = query.trim().toLowerCase()
  const matches = (q
    ? allSpells.filter(s => s.name.toLowerCase().includes(q))
    : allSpells
  ).slice().sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))

  return (
    <Modal onClose={onClose}>
      <div className="bg-zinc-900 border border-white/15 rounded-2xl shadow-2xl w-[min(440px,calc(100vw-2rem))] max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <p className="text-sm font-bold text-white">Add Spell</p>
          <button type="button" onClick={onClose}
            className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors">✕</button>
        </div>

        <div className="p-4 border-b border-white/10 shrink-0">
          <input value={query} onChange={e => setQuery(e.target.value)} autoFocus placeholder="Search spells…"
            className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:ring-1 focus:ring-white/30" />
        </div>

        <div className="overflow-y-auto flex-1 p-2 min-h-40">
          {loading ? (
            <p className="text-xs text-white/30 italic px-3 py-6 text-center">Loading spells…</p>
          ) : matches.length === 0 ? (
            <p className="text-xs text-white/30 italic px-3 py-6 text-center">No spells match "{query}".</p>
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
                <p className="text-[10px] text-white/25 italic text-center py-2">Showing first 200 — keep typing to narrow it down.</p>
              )}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-white/10 shrink-0">
          <button type="button" onClick={onCustom}
            className="text-xs text-white/40 hover:text-white transition-colors">
            + Add a custom/homebrew spell instead
          </button>
        </div>
      </div>
    </Modal>
  )
}
