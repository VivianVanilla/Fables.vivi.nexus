import { useState } from 'react'
import { LEVEL_COLORS } from './constants'
import { ChevronDown } from 'lucide-react'

const LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

interface Props {
  selectedLevels: number[]
  setSelectedLevels: (levels: number[]) => void
}

export function LevelMultiSelect({ selectedLevels, setSelectedLevels }: Props) {
  const [open, setOpen] = useState(false)

  const toggle = (lvl: number) =>
    setSelectedLevels(
      selectedLevels.includes(lvl)
        ? selectedLevels.filter((l) => l !== lvl)
        : [...selectedLevels, lvl]
    )

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors whitespace-nowrap ${
          open || selectedLevels.length > 0
            ? 'bg-muted border border-border text-foreground'
            : 'bg-card border border-border text-muted-foreground hover:border-border'
        }`}
      >
        {selectedLevels.length === 0 ? 'All Levels' : `${selectedLevels.length} Levels`}
        <ChevronDown className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 bg-background border border-border rounded-xl p-3 shadow-2xl w-screen max-w-xs sm:w-auto sm:min-w-56">
          <div className="flex flex-wrap gap-1.5 mb-3">
            {LEVELS.map((lvl) => {
              const active = selectedLevels.includes(lvl)
              const color = LEVEL_COLORS[lvl]
              return (
                <button
                  key={lvl}
                  onClick={() => toggle(lvl)}
                  className="px-2.5 py-1 rounded-lg text-xs transition-all"
                  style={{
                    backgroundColor: active ? `${color}40` : 'transparent',
                    border: `1px solid ${active ? color : `${color}50`}`,
                    color: 'white',
                    boxShadow: active ? `0 0 8px ${color}40` : 'none',
                  }}
                >
                  {lvl === 0 ? 'Cantrip' : `Lv ${lvl}`}
                </button>
              )
            })}
          </div>
          {selectedLevels.length > 0 && (
            <button
              onClick={() => setSelectedLevels([])}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  )
}
