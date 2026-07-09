import { useEffect, useMemo, useState } from 'react'
import { Shield, Sparkles, SlidersHorizontal, X } from 'lucide-react'
import { supabase } from '../supabase'
import { getSpells } from './spellCache'
import type { Spell, SpellFilters } from './types'
import { DEFAULT_FILTERS } from './types'
import { SCHOOLS, CASTING, DAMAGE_TYPES } from './constants'
import { filterSpells } from './filterSpells'
import { SpellCard } from './SpellCard'
import { SpellModal } from './SpellModal'
import { SpellSearch } from './SpellSearch'
import { ClassMultiSelect } from './ClassMultiSelect'
import { LevelMultiSelect } from './LevelMultiSelect'
import { AddSpellForm, DEFAULT_DRAFT, spellDraftToPayload } from './AddSpellForm'
import type { SpellDraft } from './AddSpellForm'
import { useHomebrewFilter } from '../hooks/useHomebrewFilter'

const ADMIN_PASSWORD = 'archmage'

export function SpellBrowser({
  isAdmin = false,
  adminEnabled = false,
  initialClasses = [],
}: {
  isAdmin?: boolean
  adminEnabled?: boolean
  initialClasses?: string[]
}) {
  const [spells, setSpells] = useState<Spell[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<SpellFilters>(DEFAULT_FILTERS)
  const [selectedClasses, setSelectedClasses] = useState<string[]>(initialClasses)
  const [selectedLevels, setSelectedLevels] = useState<number[]>([])
  const [selectedSpell, setSelectedSpell] = useState<Spell | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const hideHomebrew = useHomebrewFilter()
  const [adminMode, setAdminMode] = useState(adminEnabled)
  const [passwordInput, setPasswordInput] = useState('')
  const [editingIndex, setEditingIndex] = useState<string | null>(null)
  const [draft, setDraft] = useState<SpellDraft>(DEFAULT_DRAFT)
  const [showForm, setShowForm] = useState(false)

  // Sync edit controls with the external admin toggle
  useEffect(() => {
    setAdminMode(adminEnabled)
    if (!adminEnabled) setShowForm(false)
  }, [adminEnabled])

  // Sync class filter when navigated here from a class page
  useEffect(() => {
    if (initialClasses.length > 0) setSelectedClasses(initialClasses)
  }, [initialClasses.join(",")])

  useEffect(() => {
    setLoading(true)
    getSpells()
      .then(setSpells)
      .catch((e) => console.error('Failed to load spells:', e))
      .finally(() => setLoading(false))
  }, [])

  const baseCount = useMemo(
    () => hideHomebrew ? spells.filter(s => !s.ctag).length : spells.length,
    [spells, hideHomebrew]
  )

  const filtered = useMemo(() => {
    let list = filterSpells(spells, filters, selectedClasses, search, selectedLevels)
    // When "Hide Homebrew" is on, strip any spells that have a campaign tag
    if (hideHomebrew) list = list.filter(s => !s.ctag)
    return list
  }, [spells, filters, selectedClasses, search, selectedLevels, hideHomebrew])

  const grouped = useMemo(() => {
    const g: Record<number, Spell[]> = {}
    filtered.forEach((s) => {
      if (!g[s.level]) g[s.level] = []
      g[s.level].push(s)
    })
    return g
  }, [filtered])

  const activeFilterCount = [
    filters.school !== 'All',
    filters.casting_time !== 'All',
    filters.damageType !== 'All',
    filters.ritual !== 'All',
    filters.concentration !== 'All',
    filters.campaignTag !== 'All',
    selectedClasses.length > 0,
    selectedLevels.length > 0,
  ].filter(Boolean).length

  function handleAdminLogin() {
    if (passwordInput === ADMIN_PASSWORD) {
      setAdminMode(true)
      setPasswordInput('')
    }
  }

  function handleEditSpell(spell: Spell) {
    setEditingIndex(spell.index)
    setDraft({
      name: spell.name,
      level: spell.level,
      school: spell.school?.name ?? 'Evocation',
      classes: spell.classes?.map((c) => c.name) ?? [],
      damageType: spell.damageType ?? 'Fire',
      components: spell.components ?? ['V'],
      range: spell.range ?? '',
      duration: spell.duration ?? '',
      desc: Array.isArray(spell.desc) ? spell.desc.join('\n') : (spell.desc ?? ''),
      casting_time: spell.casting_time ?? '1 Action',
      ctag: spell.ctag ?? '',
      materialComponents: spell.materialComponents ?? false,
      materials: spell.materials ?? '',
      ritual: spell.ritual ?? false,
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSave() {
    if (!draft.name.trim()) return

    const payload = spellDraftToPayload(draft)
    const spellName = editingIndex ?? payload.index

    const { error } = await supabase
      .from('spells')
      .upsert({ spell_name: spellName, spell_data: payload }, { onConflict: 'spell_name' })

    if (error) {
      console.error('Save failed:', error)
      return
    }

    setSpells((prev) =>
      editingIndex
        ? prev.map((s) => (s.index === editingIndex ? payload : s))
        : [...prev, payload]
    )
    setDraft(DEFAULT_DRAFT)
    setEditingIndex(null)
    setShowForm(false)
  }

  function clearFilters() {
    setFilters(DEFAULT_FILTERS)
    setSelectedClasses([])
    setSelectedLevels([])
    setSearch('')
  }

  const selectCls = 'bg-card border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground hover:border-border transition-colors focus:outline-none cursor-pointer'

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2 text-foreground">
          <Sparkles className="size-4 text-purple-400" />
          <span className="font-semibold text-sm tracking-wide">
            {loading ? 'Loading…' : `${baseCount} Spells`}
          </span>
          {!loading && filtered.length !== baseCount && (
            <span className="text-muted-foreground text-xs">({filtered.length} shown)</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="size-3" /> Clear filters
            </button>
          )}
          {adminMode && (
            <button
              onClick={() => setShowForm((v) => !v)}
              className="text-xs bg-purple-800/50 hover:bg-purple-700/60 border border-purple-700/50 text-purple-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              {showForm ? 'Close Form' : '+ New Spell'}
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="mb-3">
        <SpellSearch value={search} onChange={setSearch} spells={spells} />
      </div>

      {/* Filters toggle (mobile) + inline (desktop) */}
      <div className="mb-4">
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className={`md:hidden flex items-center gap-2 text-sm px-3 py-2 rounded-lg border transition-colors ${
            filtersOpen || activeFilterCount > 0
              ? 'bg-muted border-border text-foreground'
              : 'bg-card border-border text-muted-foreground'
          }`}
        >
          <SlidersHorizontal className="size-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <span className="bg-purple-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">
              {activeFilterCount}
            </span>
          )}
        </button>

        <div className={`${filtersOpen ? 'flex' : 'hidden'} md:flex flex-wrap gap-2 mt-2 md:mt-0`}>
          <ClassMultiSelect selectedClasses={selectedClasses} setSelectedClasses={setSelectedClasses} />
          <LevelMultiSelect selectedLevels={selectedLevels} setSelectedLevels={setSelectedLevels} />

          <select value={filters.school} onChange={(e) => setFilters((f) => ({ ...f, school: e.target.value }))} className={selectCls}>
            <option value="All" className="bg-card text-foreground">All Schools</option>
            {SCHOOLS.map((s) => <option key={s} className="bg-card text-foreground">{s}</option>)}
          </select>

          <select value={filters.casting_time} onChange={(e) => setFilters((f) => ({ ...f, casting_time: e.target.value }))} className={selectCls}>
            <option value="All" className="bg-card text-foreground">Casting Time</option>
            {CASTING.map((t) => <option key={t} className="bg-card text-foreground">{t}</option>)}
          </select>

          <select value={filters.damageType} onChange={(e) => setFilters((f) => ({ ...f, damageType: e.target.value }))} className={selectCls}>
            <option value="All" className="bg-card text-foreground">Damage Type</option>
            {DAMAGE_TYPES.map((d) => <option key={d} className="bg-card text-foreground">{d}</option>)}
          </select>

          <select value={filters.concentration} onChange={(e) => setFilters((f) => ({ ...f, concentration: e.target.value }))} className={selectCls}>
            <option value="All" className="bg-card text-foreground">Concentration</option>
            <option value="Concentration" className="bg-card text-foreground">Conc. only</option>
            <option value="No Concentration" className="bg-card text-foreground">No conc.</option>
          </select>

          <select value={filters.ritual} onChange={(e) => setFilters((f) => ({ ...f, ritual: e.target.value }))} className={selectCls}>
            <option value="All" className="bg-card text-foreground">Ritual</option>
            <option value="true" className="bg-card text-foreground">Ritual only</option>
            <option value="false" className="bg-card text-foreground">No ritual</option>
          </select>

          {!hideHomebrew && (
            <select value={filters.campaignTag} onChange={(e) => setFilters((f) => ({ ...f, campaignTag: e.target.value }))} className={selectCls}>
              <option value="All" className="bg-card text-foreground">Campaign</option>
              <option value="Twilight" className="bg-card text-foreground">Twilight</option>
              <option value="Squain" className="bg-card text-foreground">Squain</option>
              <option value="Special-Banned" className="bg-card text-foreground">Special/Banned</option>
            </select>
          )}
        </div>
      </div>

      {/* Admin form */}
      {adminMode && showForm && (
        <AddSpellForm
          draft={draft}
          setDraft={setDraft}
          onSave={handleSave}
          editingIndex={editingIndex}
        />
      )}

      {/* Admin login — only shown to non-admin users who aren't already in admin mode */}
      {!adminMode && !isAdmin && (
        <details className="mb-4 group">
          <summary className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-muted-foreground cursor-pointer select-none list-none">
            <Shield className="size-3" /> Admin
          </summary>
          <div className="mt-2 flex gap-2">
            <input
              type="password"
              placeholder="Password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
              className="flex-1 bg-card border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-border"
            />
            <button
              onClick={handleAdminLogin}
              className="bg-muted hover:bg-muted text-foreground px-3 py-1.5 rounded-lg text-sm transition-colors"
            >
              Enter
            </button>
          </div>
        </details>
      )}

      {adminMode && !isAdmin && (
        <div className="mb-4 flex items-center justify-between text-xs bg-green-950/40 border border-green-800/40 text-green-400 px-3 py-2 rounded-lg">
          <span className="flex items-center gap-1.5"><Shield className="size-3" /> Admin enabled</span>
          <button onClick={() => { setAdminMode(false); setShowForm(false) }} className="text-red-400 hover:text-red-300 transition-colors">
            Disable
          </button>
        </div>
      )}

      {/* Spell list */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Loading spells…
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          No spells match your filters.
        </div>
      ) : (
        <div className="space-y-8 pb-8">
          {Object.entries(grouped)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([level, levelSpells]) => (
              <section key={level}>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 border-b border-border pb-2">
                  {level === '0' ? 'Cantrips' : `Level ${level}`}
                  <span className="ml-2 text-muted-foreground normal-case font-normal tracking-normal">({levelSpells.length})</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {levelSpells.map((spell) => (
                    <SpellCard
                      key={spell.index}
                      spell={spell}
                      adminMode={adminMode}
                      onOpen={setSelectedSpell}
                      onEdit={handleEditSpell}
                    />
                  ))}
                </div>
              </section>
            ))}
        </div>
      )}

      <SpellModal spell={selectedSpell} onClose={() => setSelectedSpell(null)} />
    </div>
  )
}
