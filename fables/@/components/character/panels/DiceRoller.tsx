import React, { useState } from "react"

const DICE = [4, 6, 8, 10, 12, 20, 100] as const

type DiceEntry = { die: number; count: number }

interface Props {
  card: string
}

export function DiceRoller({ card }: Props) {
  const [pool,   setPool]   = useState<DiceEntry[]>([])
  const [result, setResult] = useState<{ die: number; rolls: number[] }[] | null>(null)

  function addDie(die: number) {
    setPool(prev => {
      const hit = prev.find(e => e.die === die)
      return hit
        ? prev.map(e => e.die === die ? { ...e, count: e.count + 1 } : e)
        : [...prev, { die, count: 1 }]
    })
    setResult(null)
  }

  function adjustDie(die: number, delta: number) {
    setPool(prev => {
      const hit = prev.find(e => e.die === die)
      if (!hit) return prev
      const next = hit.count + delta
      return next <= 0
        ? prev.filter(e => e.die !== die)
        : prev.map(e => e.die === die ? { ...e, count: next } : e)
    })
    setResult(null)
  }

  function rollAll() {
    if (!pool.length) return
    setResult(
      pool.map(({ die, count }) => ({
        die,
        rolls: Array.from({ length: count }, () => Math.floor(Math.random() * die) + 1),
      }))
    )
  }

  const grandTotal = result?.reduce((s, g) => s + g.rolls.reduce((a, r) => a + r, 0), 0) ?? null

  return (
    <div className={`${card} p-3 flex flex-col gap-2`}>
      <span className="text-[10px] uppercase tracking-widest text-white/45 font-semibold">Dice Roller</span>

      <div className="flex flex-wrap gap-1">
        {DICE.map(d => (
          <button key={d} type="button" onClick={() => addDie(d)}
            className={`px-2 py-1 text-xs rounded-lg font-mono transition-colors ${
              pool.find(e => e.die === d)
                ? "bg-white/20 text-white"
                : "bg-white/8 hover:bg-white/15 text-white/55 hover:text-white"
            }`}>
            d{d}
          </button>
        ))}
      </div>

      {pool.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10">
          {pool.map(({ die, count }) => (
            <div key={die} className="flex items-center gap-0.5">
              <button type="button" onClick={() => adjustDie(die, -1)}
                className="size-4 flex items-center justify-center text-white/30 hover:text-white/70 text-sm leading-none">−</button>
              <span className="text-xs font-mono text-white/80 min-w-[2rem] text-center">{count}d{die}</span>
              <button type="button" onClick={() => adjustDie(die, 1)}
                className="size-4 flex items-center justify-center text-white/30 hover:text-white/70 text-sm leading-none">+</button>
            </div>
          ))}
          <button type="button" onClick={() => { setPool([]); setResult(null) }}
            className="ml-auto text-[9px] text-white/25 hover:text-white/50 transition-colors">
            clear
          </button>
        </div>
      )}

      <button type="button" onClick={rollAll} disabled={!pool.length}
        className="w-full py-1.5 rounded-lg bg-white/12 hover:bg-white/20 text-white text-xs font-semibold disabled:opacity-25 transition-colors">
        Roll!
      </button>

      {result && (
        <div className="flex flex-col gap-1 px-2.5 py-2 rounded-lg bg-white/5 border border-white/10">
          {result.map(({ die, rolls }) => (
            <div key={die} className="flex items-baseline gap-1.5 text-[10px]">
              <span className="text-white/40 font-mono shrink-0">{rolls.length}d{die}</span>
              <span className="text-white/50 font-mono flex-1 min-w-0 truncate">[{rolls.join(", ")}]</span>
              <span className="text-white/60 shrink-0">= {rolls.reduce((s, r) => s + r, 0)}</span>
            </div>
          ))}
          {result.length > 1 && (
            <div className="flex items-center justify-between border-t border-white/10 pt-1 mt-0.5">
              <span className="text-[10px] text-white/40">Total</span>
              <span className="text-base font-bold text-white tabular-nums">{grandTotal}</span>
            </div>
          )}
          {result.length === 1 && (
            <div className="flex justify-end">
              <span className="text-base font-bold text-white tabular-nums">{grandTotal}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
