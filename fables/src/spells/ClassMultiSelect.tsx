import { useState } from 'react'
import { CLASS_OPTIONS, CLASS_COLORS } from './constants'
import { ChevronDown } from 'lucide-react'

interface Props {
  selectedClasses: string[]
  setSelectedClasses: (classes: string[]) => void
}

export function ClassMultiSelect({ selectedClasses, setSelectedClasses }: Props) {
  const [open, setOpen] = useState(false)

  const toggle = (cls: string) =>
    setSelectedClasses(
      selectedClasses.includes(cls)
        ? selectedClasses.filter((c) => c !== cls)
        : [...selectedClasses, cls]
    )

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors whitespace-nowrap ${
          open || selectedClasses.length > 0
            ? 'bg-muted border border-border text-foreground'
            : 'bg-card border border-border text-muted-foreground hover:border-border'
        }`}
      >
        {selectedClasses.length === 0 ? 'All Classes' : `${selectedClasses.length} Classes`}
        <ChevronDown className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 bg-background border border-border rounded-xl p-3 shadow-2xl w-screen max-w-xs sm:w-auto sm:min-w-64">
          <div className="flex flex-wrap gap-1.5 mb-3">
            {CLASS_OPTIONS.map((cls) => {
              const active = selectedClasses.includes(cls)
              const color = CLASS_COLORS[cls]
              return (
                <button
                  key={cls}
                  onClick={() => toggle(cls)}
                  className="px-2.5 py-1 rounded-lg text-xs transition-all"
                  style={{
                    backgroundColor: active ? `${color}40` : 'transparent',
                    border: `1px solid ${active ? color : `${color}50`}`,
                    color: 'white',
                    boxShadow: active ? `0 0 8px ${color}40` : 'none',
                  }}
                >
                  {cls}
                </button>
              )
            })}
          </div>
          {selectedClasses.length > 0 && (
            <button
              onClick={() => setSelectedClasses([])}
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
