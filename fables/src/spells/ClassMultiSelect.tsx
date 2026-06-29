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
            ? 'bg-slate-700 border border-slate-600 text-slate-100'
            : 'bg-slate-900 border border-slate-800 text-slate-400 hover:border-slate-700'
        }`}
      >
        {selectedClasses.length === 0 ? 'All Classes' : `${selectedClasses.length} Classes`}
        <ChevronDown className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 bg-slate-950 border border-slate-800 rounded-xl p-3 shadow-2xl min-w-64">
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
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  )
}
