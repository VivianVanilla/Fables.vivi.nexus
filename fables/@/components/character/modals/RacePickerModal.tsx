import { useEffect, useState } from "react"
import { Modal } from "../ui/Modal"
import { X, Check, ChevronLeft } from "lucide-react"
import { supabase } from "../../../../src/supabase"
import type { Feature } from "../../character-types"
import { nanoid } from "../../character-utils"

interface Subrace   { id: string; name: string; traits: any[] }
interface RaceEntry { name: string; subraces: Subrace[]; docData: any }

interface Props {
  current: string
  currentSubrace?: string
  userId?: string | null
  onConfirm: (race: string, subrace?: string) => void
  onImport?: (payload: { racialTraits?: Feature[] }) => void
  onClose: () => void
}

export function RacePickerModal({ current, currentSubrace, userId, onConfirm, onImport, onClose }: Props) {
  const [raceEntries, setRaceEntries] = useState<RaceEntry[]>([])
  const [search,      setSearch]      = useState("")
  const [selRace,     setSelRace]     = useState(current)
  const [selSubrace,  setSelSubrace]  = useState(currentSubrace ?? "")
  const [subraceStep, setSubraceStep] = useState<RaceEntry | null>(null)  // non-null = subrace picker open
  const [importing,   setImporting]   = useState(false)

  useEffect(() => {
    async function load() {
      const { data: coreRows } = await supabase
        .from("documentation").select("name, data")
        .eq("type", "race").eq("is_homebrew", false)

      let extraRows: any[] = []
      if (userId) {
        const { data: ownRows } = await supabase
          .from("documentation").select("name, data")
          .eq("type", "race").eq("is_homebrew", true).eq("owner_id", userId)

        const { data: libObjs } = await supabase
          .from("objects").select("data")
          .eq("type", "doc_race").eq("owner_id", userId)
        const libIds = (libObjs ?? []).map((o: any) => o.data?.doc_id).filter(Boolean)
        let libRows: any[] = []
        if (libIds.length) {
          const { data: lr } = await supabase
            .from("documentation").select("name, data").in("id", libIds)
          libRows = lr ?? []
        }
        extraRows = [...(ownRows ?? []), ...libRows]
      }

      const seen = new Set<string>()
      const entries: RaceEntry[] = []
      for (const r of [...(coreRows ?? []), ...extraRows]) {
        if (seen.has(r.name)) continue
        seen.add(r.name)
        entries.push({ name: r.name, subraces: r.data?.subraces ?? [], docData: r.data ?? {} })
      }
      entries.sort((a, b) => a.name.localeCompare(b.name))
      setRaceEntries(entries)
    }
    load()
  }, [userId])

  const q = search.toLowerCase()
  const filtered = raceEntries.filter(e =>
    !q || e.name.toLowerCase().includes(q)
  )
  const showCustom = search.trim() && !raceEntries.some(e => e.name.toLowerCase() === search.toLowerCase())

  function pickRace(entry: RaceEntry) {
    if (entry.subraces.length > 0) {
      // Open subrace picker
      setSubraceStep(entry)
      setSelRace(entry.name)
      setSelSubrace("")
    } else {
      setSelRace(entry.name)
      setSelSubrace("")
    }
  }

  function pickSubrace(entry: RaceEntry, sub: Subrace) {
    setSelRace(entry.name)
    setSelSubrace(sub.name)
    setSubraceStep(null)
  }

  function confirm() {
    onConfirm(selRace, selSubrace || undefined)
    onClose()
  }

  async function handleImport() {
    if (!onImport || !selRace) return
    setImporting(true)

    const { data: rows } = await supabase
      .from("documentation").select("data")
      .eq("name", selRace).eq("type", "race").limit(1)

    const rd = rows?.[0]?.data ?? null
    const traits: Feature[] = []

    function pushTraits(rawTraits: any[], source: string) {
      ;(rawTraits ?? []).forEach((t: any) => {
        if (typeof t === "string") traits.push({ id: nanoid(), name: t, source })
        else if (t?.name) traits.push({ id: nanoid(), name: t.name, source, description: t.description ?? "" })
      })
    }

    if (rd) {
      pushTraits(rd.traits ?? rd.features ?? [], selRace)
      if (selSubrace) {
        const sub = (rd.subraces ?? []).find((s: Subrace) => s.name === selSubrace)
        if (sub) pushTraits(sub.traits ?? [], selSubrace)
      }
    }

    onImport({ racialTraits: traits })
    setImporting(false)
    onClose()
  }

  // ── Subrace step ─────────────────────────────────────────────────────────────

  if (subraceStep) {
    return (
      <Modal onClose={onClose}>
        <div className="bg-zinc-900 border border-white/20 rounded-2xl shadow-2xl w-[min(340px,calc(100vw-2rem))] max-h-[85vh] flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3 shrink-0">
            <button onClick={() => setSubraceStep(null)}
              className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white shrink-0">
              <ChevronLeft className="size-4" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-white">{subraceStep.name}</p>
              <p className="text-xs text-white/35">Choose a subrace</p>
            </div>
            <button onClick={onClose} className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white shrink-0">
              <X className="size-4" />
            </button>
          </div>

          <div className="p-4 flex flex-col gap-1 overflow-y-auto flex-1">
            {/* Option: no subrace */}
            <button
              onClick={() => { setSelSubrace(""); setSubraceStep(null) }}
              className={`flex items-center justify-between text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                selRace === subraceStep.name && !selSubrace
                  ? "bg-white/15 text-white"
                  : "text-white/40 hover:text-white/70 hover:bg-white/5"
              }`}
            >
              <span className="italic">No subrace</span>
              {selRace === subraceStep.name && !selSubrace && <Check className="size-3.5 shrink-0" />}
            </button>

            <div className="h-px bg-white/8 my-1" />

            {subraceStep.subraces.map(sub => {
              const isSelected = selRace === subraceStep.name && selSubrace === sub.name
              return (
                <button
                  key={sub.id ?? sub.name}
                  onClick={() => pickSubrace(subraceStep, sub)}
                  className={`flex items-center justify-between text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    isSelected ? "bg-white/15 text-white" : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {sub.name}
                  {isSelected && <Check className="size-3.5 shrink-0" />}
                </button>
              )
            })}
          </div>

          <div className="flex gap-2 p-4 border-t border-white/10 shrink-0">
            <button onClick={() => setSubraceStep(null)}
              className="flex-1 py-2 rounded-lg text-sm text-white/40 border border-white/10 hover:border-white/20 hover:text-white/70 transition-colors">
              Back
            </button>
            <button onClick={() => { setSubraceStep(null) }}
              className="flex-1 py-2 rounded-lg text-sm font-semibold bg-white/15 hover:bg-white/20 text-white transition-colors">
              Done
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  // ── Race step ─────────────────────────────────────────────────────────────────

  return (
    <Modal onClose={onClose}>
      <div className="bg-zinc-900 border border-white/20 rounded-2xl shadow-2xl w-[min(340px,calc(100vw-2rem))] max-h-[85vh] flex flex-col overflow-hidden">

        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <div>
            <p className="text-base font-bold text-white">Choose Race</p>
            {selRace && (
              <p className="text-xs text-white/40 mt-0.5">
                {selSubrace
                  ? <><span className="text-white/60">{selRace}</span> · <span className="text-white">{selSubrace}</span></>
                  : <span className="text-white">{selRace}</span>}
              </p>
            )}
          </div>
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

          <div className="flex flex-col gap-0.5">
            {filtered.map(entry => {
              const isSelected  = selRace === entry.name
              const hasSubraces = entry.subraces.length > 0
              return (
                <button
                  key={entry.name}
                  onClick={() => pickRace(entry)}
                  className={`flex items-center justify-between text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    isSelected ? "bg-white/15 text-white" : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {entry.name}
                    {hasSubraces && (
                      <span className="text-[9px] text-white/30 font-normal">
                        {entry.subraces.length} subraces
                      </span>
                    )}
                  </span>
                  {isSelected && !hasSubraces && <Check className="size-3.5 shrink-0" />}
                  {isSelected && hasSubraces && selSubrace && <Check className="size-3.5 shrink-0" />}
                  {hasSubraces && (
                    <span className="text-white/20 text-xs shrink-0">›</span>
                  )}
                </button>
              )
            })}

            {filtered.length === 0 && !showCustom && (
              <p className="text-xs text-white/25 text-center py-4">
                {raceEntries.length === 0 ? "Loading…" : "No matches"}
              </p>
            )}
          </div>

          {showCustom && (
            <button
              onClick={() => { setSelRace(search.trim()); setSelSubrace("") }}
              className={`flex items-center justify-between text-left px-3 py-2 rounded-lg text-sm border border-dashed border-white/10 transition-colors ${
                selRace === search.trim() ? "bg-white/15 text-white" : "text-white/40 hover:text-white/70"
              }`}
            >
              <span>Use "<span className="text-white">{search.trim()}</span>"</span>
              {selRace === search.trim() && <Check className="size-3.5 shrink-0" />}
            </button>
          )}

          {onImport && selRace && (
            <div className="border-t border-white/10 pt-3">
              <button
                onClick={handleImport}
                disabled={importing}
                className="w-full py-2 rounded-lg text-sm font-semibold bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30 transition-colors disabled:opacity-40"
              >
                {importing ? "Importing…" : selSubrace ? `Import ${selSubrace} Traits` : "Import All Racial Traits"}
              </button>
              {selSubrace && (
                <p className="text-[10px] text-white/25 text-center mt-1.5">Imports parent race traits + subrace traits</p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-white/10 shrink-0">
          <button onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm text-white/40 border border-white/10 hover:border-white/20 hover:text-white/70 transition-colors">
            Cancel
          </button>
          <button onClick={confirm} disabled={!selRace}
            className="flex-1 py-2 rounded-lg text-sm font-semibold bg-white/15 hover:bg-white/20 text-white transition-colors disabled:opacity-40">
            Confirm
          </button>
        </div>
      </div>
    </Modal>
  )
}
