// ════════════════════════════════════════════════════════════════════════════
// ClassPickerModal.tsx — Pick class(es) and levels for a character
// ════════════════════════════════════════════════════════════════════════════

import { useState } from "react"
import { Modal } from "../ui/Modal"
import { Minus, Plus, X } from "lucide-react"

const ALL_CLASSES = [
  "Artificer", "Barbarian", "Bard", "Cleric", "Druid",
  "Fighter", "Monk", "Paladin", "Ranger", "Rogue",
  "Sorcerer", "Warlock", "Wizard",
]

interface ClassEntry {
  cls: string
  level: number
}

interface Props {
  initial: ClassEntry[]
  onConfirm: (classes: ClassEntry[]) => void
  onClose: () => void
}

export function ClassPickerModal({ initial, onConfirm, onClose }: Props) {
  const [entries, setEntries] = useState<ClassEntry[]>(
    initial.length > 0 ? initial : []
  )
  const [search, setSearch] = useState("")

  const totalLevel = entries.reduce((s, e) => s + e.level, 0)

  const available = ALL_CLASSES.filter(
    cls =>
      !entries.some(e => e.cls === cls) &&
      cls.toLowerCase().includes(search.toLowerCase())
  )

  function addClass(cls: string) {
    setEntries(prev => [...prev, { cls, level: 1 }])
    setSearch("")
  }

  function removeClass(cls: string) {
    setEntries(prev => prev.filter(e => e.cls !== cls))
  }

  function changeLevel(cls: string, delta: number) {
    setEntries(prev =>
      prev.map(e =>
        e.cls === cls
          ? { ...e, level: Math.min(20, Math.max(1, e.level + delta)) }
          : e
      )
    )
  }

  function setLevel(cls: string, val: string) {
    const n = parseInt(val)
    if (isNaN(n)) return
    setEntries(prev =>
      prev.map(e =>
        e.cls === cls ? { ...e, level: Math.min(20, Math.max(1, n)) } : e
      )
    )
  }

  function confirm() {
    onConfirm(entries)
    onClose()
  }

  return (
    <Modal onClose={onClose}>
      <div className="bg-zinc-900 border border-white/20 rounded-2xl shadow-2xl w-[340px] max-h-[85vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <div>
            <p className="text-base font-bold text-white">Choose Classes</p>
            {totalLevel > 0 && (
              <p className="text-xs text-white/40 mt-0.5">
                Total Level <span className="text-white font-semibold">{totalLevel}</span>
                {totalLevel > 20 && <span className="text-red-400 ml-1">(exceeds 20)</span>}
              </p>
            )}
          </div>
          <button onClick={onClose} className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white">
            <X className="size-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 flex flex-col gap-4 p-5">

          {/* Selected classes */}
          {entries.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Selected</p>
              {entries.map(e => (
                <div key={e.cls} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                  <span className="flex-1 text-sm text-white">{e.cls}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => changeLevel(e.cls, -1)}
                      className="size-6 flex items-center justify-center rounded text-white/50 hover:text-white hover:bg-white/10"
                    >
                      <Minus className="size-3" />
                    </button>
                    <input
                      type="number"
                      value={e.level}
                      onChange={ev => setLevel(e.cls, ev.target.value)}
                      onFocus={ev => ev.target.select()}
                      min={1} max={20}
                      className="w-8 text-center bg-black/30 rounded px-1 py-0.5 text-sm text-white outline-none"
                    />
                    <button
                      onClick={() => changeLevel(e.cls, 1)}
                      className="size-6 flex items-center justify-center rounded text-white/50 hover:text-white hover:bg-white/10"
                    >
                      <Plus className="size-3" />
                    </button>
                  </div>
                  <button
                    onClick={() => removeClass(e.cls)}
                    className="size-6 flex items-center justify-center rounded text-white/30 hover:text-red-400 hover:bg-white/5"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add class */}
          <div className="flex flex-col gap-2">
            <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Add Class</p>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search classes…"
              className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-white/30 placeholder:text-white/20"
            />
            <div className="grid grid-cols-2 gap-1.5">
              {available.map(cls => (
                <button
                  key={cls}
                  onClick={() => addClass(cls)}
                  className="text-left px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                >
                  {cls}
                </button>
              ))}
              {available.length === 0 && (
                <p className="col-span-2 text-xs text-white/25 text-center py-3">
                  {search ? "No matches" : "All classes added"}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-5 border-t border-white/10 shrink-0">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm text-white/40 border border-white/10 hover:border-white/20 hover:text-white/70 transition-colors">
            Cancel
          </button>
          <button
            onClick={confirm}
            className="flex-1 py-2 rounded-lg text-sm font-semibold bg-white/15 hover:bg-white/20 text-white transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </Modal>
  )
}
