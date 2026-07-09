import type { Spell } from './types'
import { CLASS_COLORS } from './constants'

interface Props {
  spell: Spell
  adminMode: boolean
  onOpen: (spell: Spell) => void
  onEdit: (spell: Spell) => void
}

export function SpellCard({ spell, adminMode, onOpen, onEdit }: Props) {
  return (
    <div
      onClick={() => onOpen(spell)}
      className="group relative bg-card/60 border border-border hover:border-border p-4 rounded-xl cursor-pointer transition-all hover:bg-card hover:shadow-lg hover:shadow-black/20"
    >
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <h3 className="font-semibold text-sm leading-snug text-foreground">{spell.name}</h3>
        {adminMode && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(spell) }}
            className="shrink-0 text-[10px] font-medium text-amber-500 hover:text-amber-300 border border-amber-800/60 hover:border-amber-500 rounded-lg px-2 py-0.5 transition-colors"
          >
            Edit
          </button>
        )}
      </div>

      <div className="text-xs text-muted-foreground space-y-0.5 mb-3">
        <div><span className="text-muted-foreground">Cast:</span> {spell.casting_time}</div>
        <div><span className="text-muted-foreground">Range:</span> {spell.range}</div>
        <div><span className="text-muted-foreground">Duration:</span> {spell.duration}</div>
      </div>

      <div className="flex flex-wrap gap-1">
        {spell.classes.map((c) => {
          const color = CLASS_COLORS[c.name] ?? '#6B7280'
          return (
            <span
              key={c.name}
              className="text-[10px] px-1.5 py-0.5 rounded text-white/90"
              style={{ backgroundColor: `${color}2a`, border: `1px solid ${color}60` }}
            >
              {c.name}
            </span>
          )
        })}
      </div>

      {spell.ctag && (
        <div className="mt-2">
          <span className="inline-block text-[10px] px-1.5 py-0.5 rounded border border-purple-500/30 bg-purple-950/40 text-purple-400">
            {spell.ctag}
          </span>
        </div>
      )}
    </div>
  )
}
