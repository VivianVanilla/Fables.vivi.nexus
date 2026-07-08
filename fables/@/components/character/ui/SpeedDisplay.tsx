// ════════════════════════════════════════════════════════════════════════════
// SpeedDisplay.tsx — shared walk/fly/swim/climb speed readout
//
// Shared between the character sheet's Speed square and the monster stat
// block. A single set speed renders as a plain big number (unchanged from
// before); once a second movement type is set, all of them render as a
// small color-coded stack instead.
// ════════════════════════════════════════════════════════════════════════════

export interface SpeedValues {
  walk?: number
  fly?: number
  swim?: number
  climb?: number
}

const SPEED_TYPES = [
  { key: "walk",  abbr: "Walk", color: "text-white"      },
  { key: "fly",   abbr: "Fly", color: "text-sky-300"     },
  { key: "swim",  abbr: "Swim", color: "text-cyan-300"    },
  { key: "climb", abbr: "Climb", color: "text-amber-300"   },
] as const

interface Props {
  speeds: SpeedValues
  size?: "sm" | "lg"
  zeroed?: boolean  // condition (e.g. Grappled) forces movement to 0
}

export function SpeedDisplay({ speeds, size = "sm", zeroed }: Props) {
  const numCls = size === "lg" ? "text-xl" : "text-md"

  if (zeroed) {
    return <span className={`${numCls} font-bold text-red-400 transition-colors duration-200`}>0</span>
  }

  const entries = SPEED_TYPES
    .map(t => ({ ...t, value: speeds[t.key] }))
    .filter((e): e is typeof e & { value: number } => !!e.value && e.value > 0)

  if (entries.length <= 1) {
    return <span className={`${numCls} font-bold text-white transition-all duration-200`}>{entries[0]?.value ?? 0}</span>
  }

  // Monster-size ("lg") lays the movement types out side by side — a vertical
  // stack of 3-4 entries took up too much room in the compact stats summary.
  return (
    <div className={`flex items-center transition-all duration-200 ${size === "lg" ? "flex-row gap-2" : "flex-col gap-0"}`}>
      {entries.map(e => (
        <div key={e.key} className="flex items-baseline gap-1 animate-in fade-in duration-200">
          <span className={`${size === "lg" ? "text-[11px]" : "text-[9px]"} font-bold ${e.color}`}>{e.abbr}</span>
          <span className={`${size === "lg" ? "text-base" : "text-xs"} font-bold text-white tabular-nums`}>{e.value}</span>
        </div>
      ))}
    </div>
  )
}
