import { useEffect, useState } from "react"
import { Modal } from "../ui/Modal"
import { Minus, Plus, X, ChevronDown } from "lucide-react"
import { supabase } from "../../../../src/supabase"
import { getSpells } from "../../../../src/spells/spellCache"
import { SCHOOLS } from "../../../../src/spells/constants"
import type { Feature, SpellItem } from "../../character-types"
import { nanoid, maxSpellLevelForClass } from "../../character-utils"
import { parseSpellCombat } from "../../character-spell-utils"

interface ClassEntry {
  cls: string
  level: number
}

interface Props {
  initial: ClassEntry[]
  userId?: string | null
  existingFeatures?: Feature[]  // current data.classFeatures — used to warn before duplicate imports
  existingSpells?: SpellItem[]  // current data.spellItems — used to skip re-importing spells already known
  onConfirm: (classes: ClassEntry[]) => void
  onImport?: (payload: { classFeatures?: Feature[]; spellItems?: SpellItem[] }) => void
  onClose: () => void
}

export function ClassPickerModal({ initial, userId, existingFeatures = [], existingSpells = [], onConfirm, onImport, onClose }: Props) {
  const [entries,          setEntries]          = useState<ClassEntry[]>(initial.length > 0 ? initial : [])
  const [search,           setSearch]           = useState("")
  const [allClasses,       setAllClasses]       = useState<string[]>([])
  const [subclassOptions,  setSubclassOptions]  = useState<Record<string, string[]>>({})
  const [selectedSubclass, setSelectedSubclass] = useState<Record<string, string>>({})
  const [duplicateWarning, setDuplicateWarning] = useState<string[] | null>(null)
  const [spellImportClass, setSpellImportClass] = useState("")           // "" = default to entries[0]
  const [spellLevelChoice, setSpellLevelChoice] = useState("upto")       // "upto" | "0".."9"
  const [spellSchoolChoice, setSpellSchoolChoice] = useState("")         // "" = any school
  const [spellsImportedMsg, setSpellsImportedMsg] = useState<string | null>(null)

  // Load core + homebrew + library classes from the DB
  useEffect(() => {
    async function load() {
      const { data: coreRows } = await supabase
        .from("documentation").select("name, data")
        .eq("type", "class").eq("is_homebrew", false)

      const coreNames = (coreRows ?? [])
        .filter((r: any) => !r.data?.is_subclass)
        .map((r: any) => r.name as string)

      let ownNames: string[] = []
      let libNames: string[] = []

      if (userId) {
        const { data: ownRows } = await supabase
          .from("documentation").select("name, data")
          .eq("type", "class").eq("is_homebrew", true).eq("owner_id", userId)

        ownNames = (ownRows ?? [])
          .filter((r: any) => !r.data?.is_subclass)
          .map((r: any) => r.name as string)

        const { data: libObjs } = await supabase
          .from("objects").select("data")
          .eq("type", "doc_class").eq("owner_id", userId)

        const libIds = (libObjs ?? []).map((o: any) => o.data?.doc_id).filter(Boolean)

        if (libIds.length > 0) {
          const { data: libRows } = await supabase
            .from("documentation").select("name, data").in("id", libIds)
          libNames = (libRows ?? [])
            .filter((r: any) => !r.data?.is_subclass)
            .map((r: any) => r.name as string)
        }
      }

      const merged = [...new Set([...coreNames, ...ownNames, ...libNames])].sort()
      if (merged.length > 0) setAllClasses(merged)
    }
    load()
  }, [userId])

  // Load subclasses for a given class name (lazy, on demand)
  async function loadSubclassesFor(className: string) {
    if (subclassOptions[className] !== undefined) return
    setSubclassOptions(prev => ({ ...prev, [className]: [] })) // mark loading

    const { data: parentRows } = await supabase
      .from("documentation").select("id")
      .eq("name", className).eq("type", "class").limit(1)

    if (!parentRows?.length) return
    const parentId = parentRows[0].id

    const { data: subRows } = await supabase
      .from("documentation").select("name")
      .eq("type", "class")
      .filter("data->>parent_class_id", "eq", parentId)

    const names = (subRows ?? []).map((r: any) => r.name as string).sort()
    setSubclassOptions(prev => ({ ...prev, [className]: names }))
  }

  // ── Class management ─────────────────────────────────────────────────────────

  const totalLevel = entries.reduce((s, e) => s + e.level, 0)

  const available = allClasses.filter(cls =>
    !entries.some(e => e.cls === cls) &&
    cls.toLowerCase().includes(search.toLowerCase())
  )

  const showCustom = search.trim() &&
    !allClasses.some(c => c.toLowerCase() === search.toLowerCase()) &&
    !entries.some(e => e.cls.toLowerCase() === search.toLowerCase())

  function addClass(cls: string) {
    setEntries(prev => [...prev, { cls, level: 1 }])
    setSearch("")
    loadSubclassesFor(cls)
  }

  function removeClass(cls: string) {
    setEntries(prev => prev.filter(e => e.cls !== cls))
    setSelectedSubclass(prev => { const n = { ...prev }; delete n[cls]; return n })
  }

  function changeLevel(cls: string, delta: number) {
    setEntries(prev =>
      prev.map(e => e.cls === cls ? { ...e, level: Math.min(20, Math.max(1, e.level + delta)) } : e)
    )
  }

  function setLevel(cls: string, val: string) {
    const n = parseInt(val)
    if (isNaN(n)) return
    setEntries(prev =>
      prev.map(e => e.cls === cls ? { ...e, level: Math.min(20, Math.max(1, n)) } : e)
    )
  }

  function confirm() {
    onConfirm(entries)
    onClose()
  }

  // ── Import handler ───────────────────────────────────────────────────────────

  const [importingFeatures, setImportingFeatures] = useState(false)
  const [importingSpells,   setImportingSpells]   = useState(false)

  async function loadClassAndSubData() {
    const results: Array<{ entry: ClassEntry; classData: any; subData: any }> = []
    for (const entry of entries) {
      let classData: any = null
      const { data: classRows } = await supabase
        .from("documentation").select("data")
        .eq("name", entry.cls).eq("type", "class")
      if (classRows?.length) {
        classData = (classRows.find((r: any) => !r.data?.is_subclass) ?? classRows[0]).data
      }

      let subData: any = null
      const subName = selectedSubclass[entry.cls]
      if (subName) {
        const { data: subRows } = await supabase
          .from("documentation").select("data")
          .eq("name", subName).eq("type", "class").limit(1)
        if (subRows?.length) subData = subRows[0].data
      }

      results.push({ entry, classData, subData })
    }
    return results
  }

  async function handleImportFeatures(force = false) {
    if (!onImport || !entries.length) return

    if (!force) {
      const existingSources = new Set(existingFeatures.map(f => f.source))
      const labels = entries.flatMap(e => [e.cls, selectedSubclass[e.cls]].filter(Boolean) as string[])
      const dupes = labels.filter(l => existingSources.has(l))
      if (dupes.length > 0) {
        setDuplicateWarning(dupes)
        return
      }
    }
    setDuplicateWarning(null)

    setImportingFeatures(true)
    const rows = await loadClassAndSubData()
    const allFeatures: Feature[] = []

    for (const { entry, classData, subData } of rows) {
      if (classData) {
        const features: any[] = classData.features ?? []
        features
          .filter(f => (f.level ?? 0) <= entry.level)
          .forEach(f => allFeatures.push({
            id:          nanoid(),
            name:        f.name,
            source:      entry.cls,
            level:       f.level,
            description: f.description ?? "",
          }))
      }
      if (subData) {
        const subFeatures: any[] = subData.features ?? []
        const subName = selectedSubclass[entry.cls]
        subFeatures
          .filter(f => (f.level ?? 0) <= entry.level)
          .forEach(f => allFeatures.push({
            id:          nanoid(),
            name:        f.name,
            source:      subName,
            level:       f.level,
            description: f.description ?? "",
          }))
      }
    }

    onImport({ classFeatures: allFeatures })
    setImportingFeatures(false)
    onClose()
  }

  // Pulls from the full spell database (not just subclass-granted freebies) —
  // covers prepared casters like Cleric/Druid who need their whole class list
  // available to choose "prepared" spells from, not just a few known ones.
  async function handleImportSpells() {
    if (!onImport || !entries.length) return
    const entry = entries.find(e => e.cls === spellImportClass) ?? entries[0]
    setImportingSpells(true)
    setSpellsImportedMsg(null)
    try {
      const all = await getSpells()
      const existingNames = new Set(existingSpells.map(s => s.name.trim().toLowerCase()))
      const capLevel = spellLevelChoice === "upto" ? maxSpellLevelForClass(entry.cls, entry.level) : parseInt(spellLevelChoice, 10)
      const matches = all.filter(s => {
        if (!s.classes?.some(c => c.name.toLowerCase() === entry.cls.toLowerCase())) return false
        if (existingNames.has(s.name.trim().toLowerCase())) return false
        if (spellSchoolChoice && (s.school?.name ?? "").toLowerCase() !== spellSchoolChoice.toLowerCase()) return false
        const lvl = s.level ?? 0
        // "Up to class level" skips cantrips — those are known individually
        // (a small fixed number), not chosen from the whole class list like
        // leveled spells. "Cantrips only" is an explicit choice, so it's exempt.
        return spellLevelChoice === "upto" ? (lvl > 0 && lvl <= capLevel) : lvl === capLevel
      })
      const newSpells: SpellItem[] = matches.map(s => {
        const parsed = parseSpellCombat(s.desc ?? "")
        const dur = s.duration ?? ""
        return {
          id:                 nanoid(),
          name:               s.name,
          level:              s.level,
          school:             s.school?.name ?? "",
          castTime:           s.casting_time ?? "",
          range:              s.range ?? "",
          duration:           dur,
          components:         s.components?.join(", ") ?? "",
          materialComponents: s.materialComponents ? (s.materials ?? "") : "",
          ritual:             s.ritual ?? false,
          concentration:      dur.toLowerCase().includes("concentration"),
          damage:             s.damage ?? parsed.damage ?? "",
          damageType:         s.damageType !== "None" ? s.damageType : "",
          saveAttr:           s.saveAttr ?? parsed.saveAttr ?? "",
          notes:              Array.isArray(s.desc) ? s.desc.join("\n\n") : (s.desc ?? ""),
          sourceClass:        entry.cls,
        }
      })
      if (newSpells.length) onImport({ spellItems: newSpells })
      setSpellsImportedMsg(newSpells.length ? `Imported ${newSpells.length} spell${newSpells.length === 1 ? "" : "s"}.` : "No new spells matched.")
    } finally {
      setImportingSpells(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Modal onClose={onClose}>
      <div className="bg-zinc-900 border border-white/20 rounded-2xl shadow-2xl w-[min(380px,calc(100vw-2rem))] max-h-[85vh] flex flex-col overflow-hidden">

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
                <div key={e.cls} className="flex flex-col gap-1.5 bg-white/5 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-sm text-white font-medium">{e.cls}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => changeLevel(e.cls, -1)}
                        className="size-6 flex items-center justify-center rounded text-white/50 hover:text-white hover:bg-white/10">
                        <Minus className="size-3" />
                      </button>
                      <input
                        type="number" value={e.level}
                        onChange={ev => setLevel(e.cls, ev.target.value)}
                        onFocus={ev => ev.target.select()}
                        min={1} max={20}
                        className="w-8 text-center bg-black/30 rounded px-1 py-0.5 text-sm text-white outline-none"
                      />
                      <button onClick={() => changeLevel(e.cls, 1)}
                        className="size-6 flex items-center justify-center rounded text-white/50 hover:text-white hover:bg-white/10">
                        <Plus className="size-3" />
                      </button>
                    </div>
                    <button onClick={() => removeClass(e.cls)}
                      className="size-6 flex items-center justify-center rounded text-white/30 hover:text-red-400 hover:bg-white/5">
                      <X className="size-3" />
                    </button>
                  </div>

                  {/* Subclass selector */}
                  {(subclassOptions[e.cls]?.length ?? 0) > 0 && (
                    <div className="relative">
                      <select
                        value={selectedSubclass[e.cls] ?? ""}
                        onChange={ev => setSelectedSubclass(prev => ({ ...prev, [e.cls]: ev.target.value }))}
                        className="w-full appearance-none bg-zinc-800 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/70 outline-none focus:border-white/25 pr-7"
                      >
                        <option value="" className="bg-zinc-800 text-white">No subclass</option>
                        {subclassOptions[e.cls].map(sc => (
                          <option key={sc} value={sc} className="bg-zinc-800 text-white">{sc}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3 text-white/30 pointer-events-none" />
                    </div>
                  )}
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
                <button key={cls} onClick={() => addClass(cls)}
                  className="text-left px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white bg-white/5 hover:bg-white/10 transition-colors">
                  {cls}
                </button>
              ))}
              {available.length === 0 && !showCustom && (
                <p className="col-span-2 text-xs text-white/25 text-center py-3">
                  {search ? "No matches" : entries.length ? "All classes added" : "Loading…"}
                </p>
              )}
            </div>
            {showCustom && (
              <button
                onClick={() => addClass(search.trim())}
                className="text-left px-3 py-2 rounded-lg text-sm border border-dashed border-white/10 text-white/40 hover:text-white/70 transition-colors"
              >
                Use "<span className="text-white">{search.trim()}</span>"
              </button>
            )}
          </div>

          {/* Import section */}
          {onImport && entries.length > 0 && (
            <div className="border-t border-white/10 pt-4 flex flex-col gap-3">
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Import from Docs</p>
              <p className="text-xs text-white/30 leading-relaxed">
                Pulls class & subclass features from the documentation library, up to each class's own level above.
              </p>
              {duplicateWarning && (
                <div className="flex flex-col gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                  <p className="text-xs text-amber-300 leading-relaxed">
                    You've already imported features from <span className="font-semibold">{duplicateWarning.join(", ")}</span> — importing again will duplicate them.
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setDuplicateWarning(null)}
                      className="flex-1 py-1.5 rounded-lg text-xs text-white/50 border border-white/10 hover:border-white/20 hover:text-white/80 transition-colors">
                      Cancel
                    </button>
                    <button onClick={() => handleImportFeatures(true)}
                      className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30 transition-colors">
                      Import Anyway
                    </button>
                  </div>
                </div>
              )}
              <button
                onClick={() => handleImportFeatures()}
                disabled={importingFeatures}
                className="w-full py-2 rounded-lg text-sm font-semibold bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/30 transition-colors disabled:opacity-40"
              >
                {importingFeatures ? "Importing…" : "Import Class & Subclass Features"}
              </button>

              <div className="flex flex-col gap-2 border-t border-white/5 pt-3">
                <p className="text-[10px] uppercase tracking-widest text-white/30 font-semibold">Import Spells</p>
                <div className="grid grid-cols-2 gap-2">
                  {entries.length > 1 && (
                    <label className="flex flex-col gap-1 col-span-2">
                      <span className="text-[10px] text-white/40">Class</span>
                      <select value={spellImportClass || entries[0].cls} onChange={e => setSpellImportClass(e.target.value)}
                        className="bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-white/30">
                        {entries.map(e => <option key={e.cls} value={e.cls} className="bg-zinc-800 text-white">{e.cls}</option>)}
                      </select>
                    </label>
                  )}
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-white/40">Level</span>
                    <select value={spellLevelChoice} onChange={e => setSpellLevelChoice(e.target.value)}
                      className="bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-white/30">
                      <option value="upto" className="bg-zinc-800 text-white">Up to class level</option>
                      <option value="0" className="bg-zinc-800 text-white">Cantrips only</option>
                      {[1,2,3,4,5,6,7,8,9].map(l => <option key={l} value={l} className="bg-zinc-800 text-white">Level {l} only</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-white/40">School</span>
                    <select value={spellSchoolChoice} onChange={e => setSpellSchoolChoice(e.target.value)}
                      className="bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-white/30">
                      <option value="" className="bg-zinc-800 text-white">Any school</option>
                      {SCHOOLS.map(s => <option key={s} value={s} className="bg-zinc-800 text-white">{s}</option>)}
                    </select>
                  </label>
                </div>
                {spellsImportedMsg && <p className="text-[11px] text-emerald-300/80">{spellsImportedMsg}</p>}
                <button
                  onClick={handleImportSpells}
                  disabled={importingSpells}
                  className="w-full py-2 rounded-lg text-sm font-semibold bg-violet-600/20 border border-violet-500/30 text-violet-300 hover:bg-violet-600/30 transition-colors disabled:opacity-40"
                >
                  {importingSpells ? "Importing…" : "Import Spells"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-5 border-t border-white/10 shrink-0">
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
