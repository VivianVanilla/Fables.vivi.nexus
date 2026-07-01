import { useState } from "react"
import type { HitDicePool } from "../../character-types"

interface Props {
  card: string
  pools: HitDicePool[]
  readOnly?: boolean
  onUpdate: (id: string, patch: Partial<HitDicePool>) => void
  onRemove: (id: string) => void
  onAdd: (pool: Omit<HitDicePool, "id">) => void
}

export function HitDice({ card, pools, readOnly, onUpdate, onRemove, onAdd }: Props) {
  const [editing,   setEditing]   = useState(false)
  const [showAdd,   setShowAdd]   = useState(false)
  const [newDie,    setNewDie]    = useState("d8")
  const [newCount,  setNewCount]  = useState(1)

  function commitAdd() {
    onAdd({ dieType: newDie, total: newCount, used: 0 })
    setShowAdd(false)
    setNewDie("d8")
    setNewCount(1)
  }

  return (
    <div className={`${card} p-3 flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-white/50 font-semibold">Hit Dice</span>
        {!readOnly && (
          <button
            type="button"
            onClick={() => { setEditing(v => !v); setShowAdd(false); setNewDie("d8"); setNewCount(1) }}
            className={`text-xs px-2.5 py-1 rounded-full transition-colors ${editing ? "bg-yellow-500/20 text-yellow-300" : "bg-white/10 hover:bg-white/20 text-white/50 hover:text-white"}`}
          >
            {editing ? "Done" : "✎ Edit"}
          </button>
        )}
      </div>

      {/* View mode */}
      {!editing && (
        <>
          {pools.length === 0 && (
            <p className="text-xs text-white/30 italic text-center py-2">
              {readOnly ? "None" : "No hit dice — click ✎ Edit to add"}
            </p>
          )}
          {pools.map(pool => {
            const rem = Math.max(0, pool.total - pool.used)
            return (
              <div key={pool.id} className="flex items-center gap-2">
                <span className="text-xs font-bold text-white/70 w-8">{pool.dieType}</span>
                <div className="flex flex-wrap gap-1 flex-1">
                  {Array.from({ length: pool.total }).map((_, i) => {
                    const avail = i < rem
                    return (
                      <button key={i} type="button" disabled={readOnly}
                        title={avail ? "Click to use" : "Click to recover"}
                        onClick={() => onUpdate(pool.id, { used: avail ? pool.used + 1 : Math.max(0, pool.used - 1) })}
                        className={`size-5 rounded text-xs font-bold border transition-colors disabled:cursor-default disabled:hover:bg-transparent ${
                          avail
                            ? "bg-white/15 border-white/20 text-white hover:bg-red-900/60 hover:border-red-400/40"
                            : "bg-transparent border-white/10 text-white/20 hover:bg-green-900/40 hover:border-green-400/30"
                        }`}>◆</button>
                    )
                  })}
                </div>
                <span className="text-xs text-white/30">{rem}/{pool.total}</span>
              </div>
            )
          })}
        </>
      )}

      {/* Edit mode */}
      {editing && !readOnly && (
        <div className="flex flex-col gap-2">
          {pools.map(pool => (
            <div key={pool.id} className="flex items-center gap-2">
              <select value={pool.dieType} onChange={e => onUpdate(pool.id, { dieType: e.target.value })}
                className="bg-black/30 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-16">
                {["d4","d6","d8","d10","d12"].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <div className="flex items-center gap-1.5 flex-1">
                <button type="button"
                  onClick={() => onUpdate(pool.id, { total: Math.max(1, pool.total - 1), used: Math.min(pool.used, pool.total - 1) })}
                  className="size-6 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm flex items-center justify-center">−</button>
                <span className="text-sm text-white w-6 text-center">{pool.total}</span>
                <button type="button"
                  onClick={() => onUpdate(pool.id, { total: pool.total + 1 })}
                  className="size-6 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm flex items-center justify-center">+</button>
              </div>
              <button type="button" onClick={() => onRemove(pool.id)}
                className="size-7 flex items-center justify-center rounded-lg text-white/30 hover:text-red-400 hover:bg-red-900/30 text-sm transition-colors">✕</button>
            </div>
          ))}

          {!showAdd ? (
            <button type="button" onClick={() => setShowAdd(true)}
              className="text-sm border border-dashed border-white/15 hover:border-white/30 rounded-xl py-2 text-white/40 hover:text-white transition-colors">
              + Add pool
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2">
              <select value={newDie} onChange={e => setNewDie(e.target.value)}
                className="bg-black/30 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-16">
                {["d4","d6","d8","d10","d12"].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <div className="flex items-center gap-1.5 flex-1">
                <button type="button" onClick={() => setNewCount(c => Math.max(1, c - 1))}
                  className="size-6 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm flex items-center justify-center">−</button>
                <span className="text-sm text-white w-6 text-center">{newCount}</span>
                <button type="button" onClick={() => setNewCount(c => c + 1)}
                  className="size-6 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm flex items-center justify-center">+</button>
              </div>
              <button type="button" onClick={commitAdd}
                className="text-xs px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors">Add</button>
              <button type="button" onClick={() => setShowAdd(false)}
                className="size-7 flex items-center justify-center rounded-lg text-white/30 hover:text-white text-sm transition-colors">✕</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
