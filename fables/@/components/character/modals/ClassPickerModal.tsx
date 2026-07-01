import { useEffect, useState } from "react"
import { Modal } from "../ui/Modal"
import { Minus, Plus, X, ChevronDown } from "lucide-react"
import { supabase } from "../../../../src/supabase"
import type { Feature, SpellItem } from "../../character-types"
import { nanoid } from "../../character-utils"

interface ClassEntry {
  cls: string
  level: number
}

interface Props {
  initial: ClassEntry[]
  userId?: string | null
  onConfirm: (classes: ClassEntry[]) => void
  onImport?: (payload: { classFeatures?: Feature[]; spellItems?: SpellItem[] }) => void
  onClose: () => void
}

export function ClassPickerModal({ initial, userId, onConfirm, onImport, onClose }: Props) {
  const [entries,          setEntries]          = useState<ClassEntry[]>(initial.length > 0 ? initial : [])
  const [search,           setSearch]           = useState("")
  const [allClasses,       setAllClasses]       = useState<string[]>([])
  const [subclassOptions,  setSubclassOptions]  = useState<Record<string, string[]>>({})
  const [selectedSubclass, setSelectedSubclass] = useState<Record<string, string>>({})
  const [importUpTo,       setImportUpTo]       = useState(1)

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

  async function handleImportFeatures() {
    if (!onImport || !entries.length) return
    setImportingFeatures(true)
    const rows = await loadClassAndSubData()
    const allFeatures: Feature[] = []

    for (const { entry, classData, subData } of rows) {
      if (classData) {
        const features: any[] = classData.features ?? []
        features
          .filter(f => (f.level ?? 0) <= importUpTo)
          .forEach(f => allFeatures.push({
            id:          nanoid(),
            name:        f.name,
            source:      `${entry.cls} ${f.level}`,
            description: f.description ?? "",
          }))
      }
      if (subData) {
        const subFeatures: any[] = subData.features ?? []
        const subName = selectedSubclass[entry.cls]
        subFeatures
          .filter(f => (f.level ?? 0) <= importUpTo)
          .forEach(f => allFeatures.push({
            id:          nanoid(),
            name:        f.name,
            source:      `${subName} ${f.level}`,
            description: f.description ?? "",
          }))
      }
    }

    onImport({ classFeatures: allFeatures })
    setImportingFeatures(false)
    onClose()
  }

  async function handleImportSpells() {
    if (!onImport || !entries.length) return
    setImportingSpells(true)
    const rows = await loadClassAndSubData()
    const allSpells: SpellItem[] = []

    for (const { entry, subData } of rows) {
      if (subData) {
        const domainSpells: any[] = subData.domain_spells ?? []
        domainSpells
          .filter(row => (row.level ?? 0) <= importUpTo)
          .forEach(row => {
            const names = (row.spells ?? "").split(",").map((s: string) => s.trim()).filter(Boolean)
            names.forEach((spellName: string) => allSpells.push({
              id:             nanoid(),
              name:           spellName,
              alwaysPrepared: true,
              sourceClass:    entry.cls,
            }))
          })
      }
    }

    onImport({ spellItems: allSpells })
    setImportingSpells(false)
    onClose()
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
                        className="w-full appearance-none bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/70 outline-none focus:border-white/25 pr-7"
                      >
                        <option value="">No subclass</option>
                        {subclassOptions[e.cls].map(sc => (
                          <option key={sc} value={sc}>{sc}</option>
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
                Pulls class features and subclass spells from the documentation library up to the chosen level.
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/50 shrink-0">Up to level</span>
                <input
                  type="number" min={1} max={20} value={importUpTo}
                  onChange={e => setImportUpTo(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-14 bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-sm text-white text-center outline-none focus:border-white/30"
                />
              </div>
              <button
                onClick={handleImportFeatures}
                disabled={importingFeatures}
                className="w-full py-2 rounded-lg text-sm font-semibold bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/30 transition-colors disabled:opacity-40"
              >
                {importingFeatures ? "Importing…" : "Import Class & Subclass Features"}
              </button>
              <button
                onClick={handleImportSpells}
                disabled={importingSpells}
                className="w-full py-2 rounded-lg text-sm font-semibold bg-violet-600/20 border border-violet-500/30 text-violet-300 hover:bg-violet-600/30 transition-colors disabled:opacity-40"
              >
                {importingSpells ? "Importing…" : "Import Subclass Spell List"}
              </button>
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
