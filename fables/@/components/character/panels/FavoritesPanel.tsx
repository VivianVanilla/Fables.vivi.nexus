// ════════════════════════════════════════════════════════════════════════════
// FavoritesPanel.tsx — drag-drop favorites panel
//
// Cards render the exact same entry component used elsewhere (SpellEntry,
// EquipmentEntry, FeatureEntry) — favorites only adds a reorder grip and an
// unfavorite star around it, it never re-implements the item's own display.
//
// Drag grip to reorder. ★ removes from favorites (not the underlying item).
// ════════════════════════════════════════════════════════════════════════════

import { useState } from "react"
import type { userInfo } from "@/types/userInfo"
import type { FavoriteRef, SpellItem, EquipmentItem, Feature, FamiliarRef } from "../../character-types"
import type { MonsterData } from "../../monster-types"
import { SpellEntry } from "../entries/SpellEntry"
import { EquipmentEntry } from "../entries/EquipmentEntry"
import { FeatureEntry } from "../entries/FeatureEntry"
import { FavoriteStar } from "../ui/FavoriteStar"
import { safeParseJson } from "../../character-utils"
import type { Theme } from "../../character-themes"

// ── Familiar favorite card — compact, resolves the linked Monster live ───────

function FamiliarFavoriteEntry({
  fam, monster, poppedOut, onPopOut,
}: { fam: FamiliarRef; monster: userInfo.Objects; poppedOut: boolean; onPopOut: () => void }) {
  const mData = safeParseJson(monster.data) as MonsterData
  return (
    <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 flex items-center gap-2.5 min-h-11">
      <div className="size-8 rounded-lg overflow-hidden bg-white/5 ring-1 ring-white/10 shrink-0 flex items-center justify-center">
        {mData.portrait
          ? <img src={mData.portrait} alt="" className="w-full h-full object-cover" />
          : <span className="text-[9px] text-white/20">—</span>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{fam.nickname || monster.name}</p>
        <p className="text-[10px] text-white/40 uppercase tracking-wider">Familiar</p>
      </div>
      <button type="button" onClick={onPopOut} title={poppedOut ? "Already popped out" : "Pop out"}
        className={`size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-sm shrink-0 transition-colors ${poppedOut ? "text-primary" : "text-white/50 hover:text-white"}`}>
        ⧉
      </button>
    </div>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface FavoritesPanelProps {
  favorites:         FavoriteRef[]
  spellItems:        SpellItem[]
  equipItems:        EquipmentItem[]
  features:          Feature[]
  familiars:         FamiliarRef[]
  monsters:          userInfo.Objects[]
  poppedOutIds:      Set<string>
  pb:                number
  statMods:          Record<string, number>
  classes:           string[]
  onRemove:          (refId: string) => void
  onReorder:         (fromIdx: number, toIdx: number) => void
  onChangeSpell:     (id: string, patch: Partial<SpellItem>) => void
  onRemoveSpell:     (id: string) => void
  onChangeEquip:     (id: string, patch: Partial<EquipmentItem>) => void
  onRemoveEquip:     (id: string) => void
  onUpdateFeature:   (featureId: string, patch: Partial<Feature>) => void
  onRemoveFeature:   (featureId: string) => void
  onLinkToggle:      (featureId: string, otherId: string) => void
  onPopOutFamiliar:  (id: string) => void
  theme:             Theme
  card:              string
  readOnly:          boolean
  dragOver:          boolean
  onDragOver:        (e: React.DragEvent) => void
  onDragLeave:       () => void
  onDrop:            (e: React.DragEvent) => void
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function FavoritesPanel({
  favorites, spellItems, equipItems, features, familiars, monsters, poppedOutIds, pb, statMods, classes,
  onRemove, onReorder,
  onChangeSpell, onRemoveSpell, onChangeEquip, onRemoveEquip,
  onUpdateFeature, onRemoveFeature, onLinkToggle, onPopOutFamiliar,
  theme, card, readOnly,
  dragOver, onDragOver, onDragLeave, onDrop,
}: FavoritesPanelProps) {
  const [reorderDragIdx, setReorderDragIdx] = useState<number | null>(null)
  const [reorderOverIdx, setReorderOverIdx] = useState<number | null>(null)

  // ── Resolve helpers ──────────────────────────────────────────────────────

  function resolveSpell(refId: string)    { return spellItems.find(s => s.id === refId) }
  function resolveEquip(refId: string)    { return equipItems.find(i => i.id === refId) }
  function resolveFeature(refId: string)  { return features.find(f => f.id === refId) }
  function resolveFamiliar(refId: string) { return familiars.find(f => f.id === refId) }

  // ── Reorder drag handlers ────────────────────────────────────────────────

  function handleReorderDragStart(e: React.DragEvent, idx: number) {
    // Use a separate data key so it doesn't conflict with x-fable-ref drops
    e.dataTransfer.setData("x-fable-reorder", String(idx))
    e.dataTransfer.effectAllowed = "move"
    setReorderDragIdx(idx)
  }

  function handleReorderDragOver(e: React.DragEvent, idx: number) {
    if (!e.dataTransfer.types.includes("x-fable-reorder")) return
    e.preventDefault()
    e.stopPropagation()
    setReorderOverIdx(idx)
  }

  function handleReorderDrop(e: React.DragEvent, toIdx: number) {
    if (reorderDragIdx === null) return
    e.preventDefault()
    e.stopPropagation()
    if (reorderDragIdx !== toIdx) onReorder(reorderDragIdx, toIdx)
    setReorderDragIdx(null)
    setReorderOverIdx(null)
  }

  function handleReorderDragEnd() {
    setReorderDragIdx(null)
    setReorderOverIdx(null)
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={`${card} flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden`}>
      <div className="flex flex-col gap-2 flex-1 min-h-0"
        onDragOver={e => {
          // Only handle x-fable-ref drops at the panel level
          if (!e.dataTransfer.types.includes("x-fable-reorder")) onDragOver(e)
        }}
        onDragLeave={onDragLeave}
        onDrop={e => {
          if (!e.dataTransfer.types.includes("x-fable-reorder")) onDrop(e)
        }}>

        {/* Header */}
        <div className="flex items-center gap-2 shrink-0 px-3 pt-3">
          <span className="text-xs uppercase tracking-widest text-white/50 font-semibold flex-1">Favorites</span>
        </div>

        {/* Card list */}
        <div className={`flex flex-col gap-1.5 px-3 pb-3 overflow-auto flex-1 min-h-0 rounded-xl transition-colors ${dragOver ? "ring-1 ring-primary/40 bg-primary/5" : ""}`}>

          {favorites.length === 0 && (
            <div className={`flex-1 flex flex-col items-center justify-center text-center py-8 rounded-xl border-2 border-dashed transition-colors ${dragOver ? "border-primary/50" : "border-white/10"}`}>
              <span className="text-white/20 text-2xl mb-2">★</span>
              <p className="text-sm text-white/30">Drag spells, items, features or familiars here</p>
              <p className="text-xs text-white/20 mt-0.5">or use ★ in quick search</p>
            </div>
          )}

          {favorites.map((fav, idx) => {
            const isReorderTarget = reorderOverIdx === idx && reorderDragIdx !== idx

            // Resolve the entry to render — falls through to a "not found" row
            let entry: React.ReactNode
            if (fav.refType === "spell") {
              const spell = resolveSpell(fav.refId)
              entry = spell
                ? <SpellEntry spell={spell} theme={theme} readOnly={readOnly} showPrepToggle={false} classes={classes}
                    onChange={p => onChangeSpell(fav.refId, p)}
                    onRemove={() => onRemoveSpell(fav.refId)} />
                : <p className="text-sm text-white/30 italic px-3 py-2.5">Spell not found.</p>
            } else if (fav.refType === "equipment") {
              const item = resolveEquip(fav.refId)
              entry = item
                ? <EquipmentEntry item={item} theme={theme} readOnly={readOnly} statMods={statMods} pb={pb}
                    onChange={p => onChangeEquip(fav.refId, p)}
                    onRemove={() => onRemoveEquip(fav.refId)} />
                : <p className="text-sm text-white/30 italic px-3 py-2.5">Item not found.</p>
            } else if (fav.refType === "familiar") {
              const fam = resolveFamiliar(fav.refId)
              const monster = fam ? monsters.find(m => m.id === fam.monsterId) : undefined
              entry = fam && monster
                ? <FamiliarFavoriteEntry fam={fam} monster={monster}
                    poppedOut={poppedOutIds.has(fam.id)}
                    onPopOut={() => onPopOutFamiliar(fam.id)} />
                : <p className="text-sm text-white/30 italic px-3 py-2.5">Familiar not found.</p>
            } else {
              const feat = resolveFeature(fav.refId)
              entry = feat
                ? <FeatureEntry
                    feature={feat}
                    allFeatures={features.filter(f => f.id !== feat.id && f.trackable)}
                    theme={theme}
                    readOnly={readOnly}
                    pb={pb}
                    onChange={patch => onUpdateFeature(fav.refId, patch)}
                    onRemove={() => onRemoveFeature(fav.refId)}
                    onLinkToggle={otherId => onLinkToggle(fav.refId, otherId)}
                  />
                : <p className="text-sm text-white/30 italic px-3 py-2.5">Feature not found.</p>
            }

            return (
              <div key={fav.refId}
                className={`flex items-center gap-1 rounded-xl transition-all ${
                  isReorderTarget ? "ring-1 ring-primary/60" : ""
                } ${reorderDragIdx === idx ? "opacity-40" : ""}`}
                onDragOver={e => handleReorderDragOver(e, idx)}
                onDrop={e => handleReorderDrop(e, idx)}
              >
                {!readOnly && (
                  <span
                    draggable
                    onDragStart={e => handleReorderDragStart(e, idx)}
                    onDragEnd={handleReorderDragEnd}
                    className="text-white/15 hover:text-white/40 cursor-grab active:cursor-grabbing text-sm shrink-0 px-0.5 select-none"
                    title="Drag to reorder">⠿</span>
                )}

                <div className="flex-1 min-w-0">{entry}</div>

                {!readOnly && (
                  <FavoriteStar isFavorite onToggle={() => onRemove(fav.refId)} />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
