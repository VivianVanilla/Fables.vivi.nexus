// ════════════════════════════════════════════════════════════════════════════
// FamiliarsTab.tsx — attach Monsters (created elsewhere) to this character as
// familiars. Each familiar is a live reference to its source Monster object —
// only nickname/current HP/notes live on the character itself; favoriting goes
// through the shared favorites list (refType "familiar"), same as everything else.
// ════════════════════════════════════════════════════════════════════════════

import { useState } from "react"
import type { userInfo } from "@/types/userInfo"
import type { FamiliarRef, FavoriteRef } from "../../character-types"
import type { MonsterData } from "../../monster-types"
import { FamiliarMonsterView } from "../../monster"
import { TracingSlider } from "../../ui/tracing-slider"
import { safeParseJson } from "../../character-utils"

interface FamiliarsTabProps {
  familiars: FamiliarRef[]
  monsters: userInfo.Objects[]
  favorites: FavoriteRef[]
  card: string
  readOnly: boolean
  poppedOutIds: Set<string>
  onAdd: (monsterId: string) => void
  onUpdate: (id: string, patch: Partial<FamiliarRef>) => void
  onRemove: (id: string) => void
  onToggleFavorite: (id: string, label: string) => void
  onPopOut: (id: string) => void
}

function getMonsterData(monster: userInfo.Objects): MonsterData {
  return safeParseJson(monster.data) as MonsterData
}

export function FamiliarsTab({
  familiars, monsters, favorites, card, readOnly, poppedOutIds,
  onAdd, onUpdate, onRemove, onToggleFavorite, onPopOut,
}: FamiliarsTabProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [pickerValue, setPickerValue] = useState("")

  const isFavorited = (id: string) => favorites.some(f => f.refId === id)
  const sorted = [...familiars].sort((a, b) => (isFavorited(b.id) ? 1 : 0) - (isFavorited(a.id) ? 1 : 0))

  function handleAdd() {
    if (!pickerValue) return
    onAdd(pickerValue)
    setPickerValue("")
  }

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">

      {/* Add picker */}
      {!readOnly && (
        <div className={`${card} p-3 flex items-center gap-2 shrink-0`}>
          {monsters.length === 0 ? (
            <p className="text-xs text-white/30 italic">
              No monsters in your library yet — create one from the sidebar "+" menu, then add it here.
            </p>
          ) : (
            <>
              <select value={pickerValue} onChange={e => setPickerValue(e.target.value)}
                className="flex-1 min-w-0 bg-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none">
                <option value="">Choose a monster to add as a familiar…</option>
                {monsters.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <button type="button" onClick={handleAdd} disabled={!pickerValue}
                className="text-sm px-3 py-2 rounded-lg bg-primary/80 hover:bg-primary disabled:opacity-30 disabled:cursor-default text-white font-semibold transition-colors shrink-0">
                + Add Familiar
              </button>
            </>
          )}
        </div>
      )}

      {/* Familiar list */}
      <div className="flex flex-col gap-2 overflow-auto flex-1 min-h-0">
        {sorted.length === 0 && (
          <p className="text-sm text-white/25 italic text-center py-8">No familiars yet.</p>
        )}

        {sorted.map(fam => {
          const monster  = monsters.find(m => m.id === fam.monsterId)
          const mData    = monster ? getMonsterData(monster) : null
          const isOpen   = expandedId === fam.id
          const poppedOut = poppedOutIds.has(fam.id)
          const label     = fam.nickname || monster?.name || "Familiar"

          return (
            <div key={fam.id} className={`${card} overflow-hidden`}>
              <div className="flex items-center gap-3 px-3 py-2.5"
                draggable={!readOnly}
                onDragStart={e => {
                  e.dataTransfer.setData("x-fable-ref", JSON.stringify({ refId: fam.id, refType: "familiar", label }))
                  e.dataTransfer.effectAllowed = "copy"
                }}>
                {/* Portrait thumbnail */}
                <button type="button" onClick={() => monster && setExpandedId(isOpen ? null : fam.id)}
                  className="size-10 rounded-lg overflow-hidden bg-white/5 ring-1 ring-white/10 shrink-0 flex items-center justify-center">
                  {mData?.portrait
                    ? <img src={mData.portrait} alt="" className="w-full h-full object-cover" />
                    : <span className="text-[9px] text-white/20">—</span>}
                </button>

                {/* Name / nickname */}
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => monster && setExpandedId(isOpen ? null : fam.id)}>
                  <p className="text-sm font-semibold text-white truncate">
                    {fam.nickname || monster?.name || <span className="text-white/30 italic">Monster not found</span>}
                  </p>
                  {fam.nickname && monster?.name && (
                    <p className="text-[10px] text-white/30 truncate">{monster.name}</p>
                  )}
                </div>

                {/* HP tracker */}
                {monster && mData && (mData.maxHp ?? 0) > 0 && (
                  <div className="hidden sm:flex items-center gap-2.5 w-64 shrink-0" onClick={e => e.stopPropagation()}>
                    <TracingSlider
                      value={fam.currentHp ?? mData.maxHp ?? 0} max={mData.maxHp ?? 0} disabled={readOnly}
                      showButtons buttonSize="md" color="#22c55e"
                      onChange={val => onUpdate(fam.id, { currentHp: val })}
                      className="flex-1 min-w-0"
                    />
                    <span className="text-sm text-white/50 tabular-nums shrink-0 font-semibold">
                      {fam.currentHp ?? mData.maxHp}/{mData.maxHp}
                    </span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <button type="button" onClick={() => onToggleFavorite(fam.id, label)}
                    title="Add to favorites"
                    className={`size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-base transition-colors ${isFavorited(fam.id) ? "text-yellow-400" : "text-white/20 hover:text-yellow-400"}`}>
                    ★
                  </button>
                  {monster && (
                    <button type="button" onClick={() => onPopOut(fam.id)}
                      title={poppedOut ? "Already popped out" : "Pop out"}
                      className={`size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-sm transition-colors ${poppedOut ? "text-primary" : "text-white/40 hover:text-white"}`}>
                      ⧉
                    </button>
                  )}
                  {!readOnly && (
                    <button type="button" onClick={() => onRemove(fam.id)}
                      title="Remove familiar"
                      className="size-7 flex items-center justify-center rounded-lg hover:bg-red-500/20 text-white/30 hover:text-red-400 text-sm transition-colors">
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {!readOnly && (
                <div className="px-3 pb-2 -mt-1">
                  <input value={fam.nickname ?? ""} placeholder="Nickname (optional)"
                    onChange={e => onUpdate(fam.id, { nickname: e.target.value })}
                    className="w-full bg-transparent outline-none text-xs text-white/50 placeholder:text-white/20" />
                </div>
              )}

              {/* Inline expanded stat block — editable, writes back to the source Monster */}
              {isOpen && monster && (
                <div className="px-3 pb-3 border-t border-white/5 pt-3">
                  <FamiliarMonsterView monster={monster} readOnly={readOnly} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
