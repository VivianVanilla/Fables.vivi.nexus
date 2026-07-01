import { useEffect, useState } from "react"
import { Modal } from "../ui/Modal"
import { X, Check } from "lucide-react"
import { supabase } from "../../../../src/supabase"
import type { Feature } from "../../character-types"
import { nanoid } from "../../character-utils"



interface Props {
  current: string
  userId?: string | null
  onConfirm: (race: string) => void
  onImport?: (payload: { racialTraits?: Feature[] }) => void
  onClose: () => void
}

export function RacePickerModal({ current, userId, onConfirm, onImport, onClose }: Props) {
  const [selected,        setSelected]        = useState(current)
  const [search,          setSearch]          = useState("")
  const [allRaces,        setAllRaces]        = useState<string[]>([])
  const [importingTraits, setImportingTraits] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: coreRows } = await supabase
        .from("documentation").select("name")
        .eq("type", "race").eq("is_homebrew", false)

      const coreNames = (coreRows ?? []).map((r: any) => r.name as string)

      let ownNames: string[] = []
      let libNames: string[] = []

      if (userId) {
        const { data: ownRows } = await supabase
          .from("documentation").select("name")
          .eq("type", "race").eq("is_homebrew", true).eq("owner_id", userId)
        ownNames = (ownRows ?? []).map((r: any) => r.name as string)

        const { data: libObjs } = await supabase
          .from("objects").select("data")
          .eq("type", "doc_race").eq("owner_id", userId)
        const libIds = (libObjs ?? []).map((o: any) => o.data?.doc_id).filter(Boolean)

        if (libIds.length > 0) {
          const { data: libRows } = await supabase
            .from("documentation").select("name").in("id", libIds)
          libNames = (libRows ?? []).map((r: any) => r.name as string)
        }
      }

      const merged = [...new Set([...coreNames, ...ownNames, ...libNames])].sort()
      if (merged.length > 0) setAllRaces(merged)
    }
    load()
  }, [userId])

  const filtered = allRaces.filter(r => r.toLowerCase().includes(search.toLowerCase()))
  const showCustom = search.trim() && !allRaces.some(r => r.toLowerCase() === search.toLowerCase())

  function confirm() {
    onConfirm(selected)
    onClose()
  }

  async function loadRaceData() {
    const { data: rows } = await supabase
      .from("documentation").select("data")
      .eq("name", selected).eq("type", "race").limit(1)
    return rows?.[0]?.data ?? null
  }

  async function handleImportTraits() {
    if (!onImport || !selected) return
    setImportingTraits(true)
    const rd = await loadRaceData()
    const traits: Feature[] = []

    if (rd) {
      const rawTraits: any[] = rd.traits ?? rd.features ?? []
      rawTraits.forEach((t: any) => {
        if (typeof t === "string") {
          traits.push({ id: nanoid(), name: t, source: selected })
        } else if (t?.name) {
          traits.push({ id: nanoid(), name: t.name, source: selected, description: t.description ?? "" })
        }
      })
    }

    onImport({ racialTraits: traits })
    setImportingTraits(false)
    onClose()
  }

  return (
    <Modal onClose={onClose}>
      <div className="bg-zinc-900 border border-white/20 rounded-2xl shadow-2xl w-[min(320px,calc(100vw-2rem))] max-h-[80vh] flex flex-col overflow-hidden">
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
            {filtered.length === 0 && !showCustom && (
              <p className="text-xs text-white/25 text-center py-3">No matches</p>
            )}
          </div>
          {showCustom && (
            <button
              onClick={() => setSelected(search.trim())}
              className={`flex items-center justify-between text-left px-3 py-2 rounded-lg text-sm border border-dashed border-white/10 transition-colors ${
                selected === search.trim() ? "bg-white/15 text-white" : "text-white/40 hover:text-white/70"
              }`}
            >
              <span>Use "<span className="text-white">{search.trim()}</span>"</span>
              {selected === search.trim() && <Check className="size-3.5 shrink-0" />}
            </button>
          )}

          {/* Import button */}
          {onImport && selected && (
            <div className="border-t border-white/10 pt-3">
              <button
                onClick={handleImportTraits}
                disabled={importingTraits}
                className="w-full py-2 rounded-lg text-sm font-semibold bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30 transition-colors disabled:opacity-40"
              >
                {importingTraits ? "Importing…" : "Import All Racial Traits"}
              </button>
              <p className="text-[10px] text-white/25 text-center mt-1.5 leading-relaxed">
                Adds traits from the documentation library to your character
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-white/10 shrink-0">
          <button onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm text-white/40 border border-white/10 hover:border-white/20 hover:text-white/70 transition-colors">
            Cancel
          </button>
          <button onClick={confirm}
            className="flex-1 py-2 rounded-lg text-sm font-semibold bg-white/15 hover:bg-white/20 text-white transition-colors">
            Confirm
          </button>
        </div>
      </div>
    </Modal>
  )
}
