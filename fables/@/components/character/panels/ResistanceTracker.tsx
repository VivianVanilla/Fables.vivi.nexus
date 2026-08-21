import { DAMAGE_TYPES } from "@/components/shared/damageTypes"

interface Props {
  card: string
  resistances: string[]
  vulnerabilities: string[]
  readOnly?: boolean
  onUpdate: (patch: { resistances?: string[]; vulnerabilities?: string[] }) => void
}

// Each damage type cycles None → Resistant → Vulnerable → None on click —
// a type can't be both at once, same as the 5e rule that resistance and
// vulnerability to the same damage type just cancel out.
export function ResistanceTracker({ card, resistances, vulnerabilities, readOnly, onUpdate }: Props) {
  function cycle(type: string) {
    if (readOnly) return
    if (resistances.includes(type)) {
      onUpdate({ resistances: resistances.filter(t => t !== type), vulnerabilities: [...vulnerabilities, type] })
    } else if (vulnerabilities.includes(type)) {
      onUpdate({ vulnerabilities: vulnerabilities.filter(t => t !== type) })
    } else {
      onUpdate({ resistances: [...resistances, type] })
    }
  }

  return (
    <div className={`${card} p-3 flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-white/45 font-semibold">Resistances &amp; Vulnerabilities</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {DAMAGE_TYPES.map(type => {
          const resistant   = resistances.includes(type)
          const vulnerable  = vulnerabilities.includes(type)
          const stateClass  =
            resistant  ? "bg-emerald-500/25 text-emerald-200 border-emerald-500/40" :
            vulnerable ? "bg-red-500/25 text-red-200 border-red-500/40" :
                         "bg-white/8 text-white/45 border-white/10 hover:bg-white/15 hover:text-white/70"
          return (
            <button key={type} type="button" onClick={() => cycle(type)} disabled={readOnly}
              title={resistant ? "Resistant — click for Vulnerable" : vulnerable ? "Vulnerable — click to clear" : "Click to mark Resistant"}
              className={`text-[10px] px-2 py-1 rounded-full border font-semibold transition-colors disabled:cursor-default ${stateClass}`}>
              {type}
            </button>
          )
        })}
      </div>
      {resistances.length === 0 && vulnerabilities.length === 0 && (
        <p className="text-[10px] text-white/25 italic">Tap a damage type — once for Resistant, again for Vulnerable.</p>
      )}
    </div>
  )
}
