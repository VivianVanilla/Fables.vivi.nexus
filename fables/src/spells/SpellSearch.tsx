import { useState, useRef, useEffect } from 'react'
import { Search } from 'lucide-react'
import type { Spell } from './types'
import { useHomebrewFilter } from '../hooks/useHomebrewFilter'
import { HOMEBREW_TAGS } from './constants'

interface Props {
  value: string
  onChange: (val: string) => void
  spells: Spell[]
}

export function SpellSearch({ value, onChange, spells }: Props) {
  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<Spell[]>([])
  const hideHomebrew = useHomebrewFilter()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!value.trim()) {
      setSuggestions([])
      setOpen(false)
      return
    }

    const q = value.toLowerCase()
    let pool = spells
    if (hideHomebrew) {
      pool = pool.filter((s) => !HOMEBREW_TAGS.includes(s.ctag))
    }
    const matches = pool
      .filter((s) => s.name.toLowerCase().startsWith(q))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 8)

    setSuggestions(matches)
    setOpen(matches.length > 0)
  }, [value, spells, hideHomebrew])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={containerRef} className="relative w-full">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500 pointer-events-none" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder="Search spells…"
        className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm placeholder:text-slate-600 focus:outline-none focus:border-slate-600 transition-colors"
      />
      {open && (
        <div className="absolute z-50 top-full mt-1 w-full bg-slate-950 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
          {suggestions.map((spell) => (
            <button
              key={spell.index}
              type="button"
              onMouseDown={() => { onChange(spell.name); setOpen(false) }}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-800 transition-colors flex items-center justify-between gap-4"
            >
              <span className="text-slate-200 truncate">{spell.name}</span>
              <span className="text-xs text-slate-500 shrink-0">
                {spell.level === 0 ? 'Cantrip' : `Lv ${spell.level}`} · {spell.school?.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
