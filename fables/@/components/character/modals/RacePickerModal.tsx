import { useState } from "react"
import { Modal } from "../ui/Modal"
import { X, Check } from "lucide-react"

const BASE_RACES = [
  "Dragonborn",
  "Dwarf (Hill)", "Dwarf (Mountain)",
  "Elf (High)", "Elf (Wood)", "Elf (Dark)",
  "Gnome (Forest)", "Gnome (Rock)",
  "Half-Elf", "Half-Orc",
  "Halfling (Lightfoot)", "Halfling (Stout)",
  "Human", "Tiefling",
]

interface Props {
  current: string
  onConfirm: (race: string) => void
  onClose: () => void
}

export function RacePickerModal({ current, onConfirm, onClose }: Props) {
  const [selected, setSelected] = useState(current)
  const [search, setSearch]     = useState("")

  const filtered = BASE_RACES.filter(r =>
    r.toLowerCase().includes(search.toLowerCase())
  )

  function confirm() {
    onConfirm(selected)
    onClose()
  }

  return (
    <Modal onClose={onClose}>
      <div className="bg-zinc-900 border border-white/20 rounded-2xl shadow-2xl w-[300px] max-h-[80vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <p className="text-base font-bold text-white">Choose Race</p>
          <button onClick={onClose} className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-3 overflow-y-auto flex-1">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search races…"
            className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-white/30 placeholder:text-white/20"
          />
          <div className="flex flex-col gap-1">
            {filtered.map(race => (
              <button
                key={race}
                onClick={() => setSelected(race)}
                className={`flex items-center justify-between text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selected === race
                    ? "bg-white/15 text-white"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                {race}
                {selected === race && <Check className="size-3.5 shrink-0" />}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-xs text-white/25 text-center py-3">No matches</p>
            )}
          </div>
          {/* Custom entry */}
          {search && !BASE_RACES.includes(search) && (
            <button
              onClick={() => setSelected(search)}
              className={`flex items-center justify-between text-left px-3 py-2 rounded-lg text-sm border border-dashed border-white/10 transition-colors ${
                selected === search ? "bg-white/15 text-white" : "text-white/40 hover:text-white/70"
              }`}
            >
              <span>Use "<span className="text-white">{search}</span>"</span>
              {selected === search && <Check className="size-3.5 shrink-0" />}
            </button>
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-white/10 shrink-0">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm text-white/40 border border-white/10 hover:border-white/20 hover:text-white/70 transition-colors">
            Cancel
          </button>
          <button onClick={confirm} className="flex-1 py-2 rounded-lg text-sm font-semibold bg-white/15 hover:bg-white/20 text-white transition-colors">
            Confirm
          </button>
        </div>
      </div>
    </Modal>
  )
}
