// ════════════════════════════════════════════════════════════════════════════
// FavoritesPanel.tsx — drag-drop favorites panel with expandable cards
//
// Can be docked (inline) or floated (fixed overlay, draggable by header).
// Cards: click header to expand detail. Drag grip to reorder.
// Tracked features: use count pill in header, full slider in expanded.
// ════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { FavoriteRef, SpellItem, EquipmentItem, Feature } from "../../character-types"
import { TracingSlider } from "../../ui/tracing-slider"
import { FeatureEntry } from "../entries/FeatureEntry"
import type { Theme } from "../../character-themes"

const MD_PROSE = "prose prose-sm prose-invert max-w-none text-white/60 prose-p:leading-relaxed prose-p:my-1 prose-table:text-xs prose-th:text-white/50 prose-td:text-white/50"

// ── Types ─────────────────────────────────────────────────────────────────────

interface FavoritesPanelProps {
  favorites:         FavoriteRef[]
  spellItems:        SpellItem[]
  equipItems:        EquipmentItem[]
  features:          Feature[]
  pb:                number
  onRemove:          (refId: string) => void
  onReorder:         (fromIdx: number, toIdx: number) => void
  onUpdateUses:      (featureId: string, usesUsed: number) => void
  onUpdateFeature:   (featureId: string, patch: Partial<Feature>) => void
  onLinkToggle:      (featureId: string, otherId: string) => void
  theme:             Theme
  card:              string
  readOnly:          boolean
  dragOver:          boolean
  onDragOver:        (e: React.DragEvent) => void
  onDragLeave:       () => void
  onDrop:            (e: React.DragEvent) => void
  isFloat:           boolean
  floatPos:          { x: number; y: number }
  onFloatToggle:     () => void
  onFloatPosChange:  (pos: { x: number; y: number }) => void
}

// ── Spell detail ──────────────────────────────────────────────────────────────

function SpellDetail({ spell }: { spell: SpellItem }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1">
        {spell.level !== undefined && (
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 text-white/60">Lv {spell.level}</span>
        )}
        {spell.school && (
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 text-white/50 italic">{spell.school}</span>
        )}
        {spell.castTime && (
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 text-white/50">{spell.castTime}</span>
        )}
        {spell.range && (
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 text-white/50">{spell.range}</span>
        )}
        {spell.damage && (
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-300/80">
            {spell.damage}{spell.damageType ? ` ${spell.damageType}` : ""}
          </span>
        )}
        {(spell.saveAttr || spell.saveType) && (
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-300/80">
            Save {spell.saveAttr || spell.saveType}
          </span>
        )}
      </div>
      {spell.notes && (
        <div className={MD_PROSE}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{spell.notes}</ReactMarkdown>
        </div>
      )}
    </div>
  )
}

// ── Equipment detail ──────────────────────────────────────────────────────────

function EquipDetail({ item }: { item: EquipmentItem }) {
  return (
    <div className="flex flex-wrap gap-1">
      {item.type && (
        <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 text-white/60 capitalize">{item.type}</span>
      )}
      {item.magicBonus && (
        <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold">{item.magicBonus}</span>
      )}
      {item.toHit && (
        <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 text-white/60">{item.toHit} hit</span>
      )}
      {item.damage && (
        <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-300/80">
          {item.damage}{item.damageType ? ` ${item.damageType}` : ""}
        </span>
      )}
      {item.properties && (
        <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 text-white/45 italic">{item.properties}</span>
      )}
      {item.notes && (
        <div className={`${MD_PROSE} mt-1 w-full`}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.notes}</ReactMarkdown>
        </div>
      )}
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<string, string> = { spell: "✦", equipment: "⚔", feature: "◈" }

export function FavoritesPanel({
  favorites, spellItems, equipItems, features, pb,
  onRemove, onReorder, onUpdateUses, onUpdateFeature, onLinkToggle,
  theme, card, readOnly,
  dragOver, onDragOver, onDragLeave, onDrop,
  isFloat, floatPos, onFloatToggle, onFloatPosChange,
}: FavoritesPanelProps) {
  const [expandedIds,   setExpandedIds]   = useState<Set<string>>(new Set())
  const [reorderDragIdx, setReorderDragIdx] = useState<number | null>(null)
  const [reorderOverIdx, setReorderOverIdx] = useState<number | null>(null)

  function toggleExpanded(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Float window drag ────────────────────────────────────────────────────

  const [isDraggingWindow, setIsDraggingWindow] = useState(false)
  const dragOffsetRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (!isFloat || !isDraggingWindow) return
    const onMove = (e: MouseEvent) => {
      onFloatPosChange({
        x: Math.max(0, e.clientX - dragOffsetRef.current.x),
        y: Math.max(0, e.clientY - dragOffsetRef.current.y),
      })
    }
    const onUp = () => setIsDraggingWindow(false)
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup",   onUp)
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp) }
  }, [isFloat, isDraggingWindow, onFloatPosChange])

  function startWindowDrag(e: React.MouseEvent) {
    if (!isFloat) return
    dragOffsetRef.current = { x: e.clientX - floatPos.x, y: e.clientY - floatPos.y }
    setIsDraggingWindow(true)
    e.preventDefault()
  }

  // ── Resolve helpers ──────────────────────────────────────────────────────

  function resolveSpell(refId: string)   { return spellItems.find(s => s.id === refId) }
  function resolveEquip(refId: string)   { return equipItems.find(i => i.id === refId) }
  function resolveFeature(refId: string) { return features.find(f => f.id === refId) }

  function resolveLabel(fav: FavoriteRef): string {
    if (fav.refType === "spell")     return resolveSpell(fav.refId)?.name     || fav.label
    if (fav.refType === "equipment") return resolveEquip(fav.refId)?.name     || fav.label
    return resolveFeature(fav.refId)?.name || fav.label
  }

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

  // ── Panel content ────────────────────────────────────────────────────────

  const panelContent = (
    <div className={`flex flex-col gap-2 ${isFloat ? "h-full" : "flex-1 min-h-0"}`}
      onDragOver={e => {
        // Only handle x-fable-ref drops at the panel level
        if (!e.dataTransfer.types.includes("x-fable-reorder")) onDragOver(e)
      }}
      onDragLeave={onDragLeave}
      onDrop={e => {
        if (!e.dataTransfer.types.includes("x-fable-reorder")) onDrop(e)
      }}>

      {/* Header */}
      <div
        className={`flex items-center gap-2 shrink-0 px-3 pt-3 ${isFloat ? "cursor-grab active:cursor-grabbing select-none pb-1" : "pb-0"}`}
        onMouseDown={startWindowDrag}>
        {isFloat && <span className="text-white/20 text-sm mr-0.5" title="Drag to move">⠿</span>}
        <span className="text-xs uppercase tracking-widest text-white/50 font-semibold flex-1">Favorites</span>
        <button type="button" onClick={onFloatToggle}
          title={isFloat ? "Dock panel" : "Float panel"}
          className="size-6 flex items-center justify-center rounded-md hover:bg-white/10 text-white/30 hover:text-white transition-colors text-xs shrink-0">
          {isFloat ? "↙" : "⊞"}
        </button>
      </div>

      {/* Card list */}
      <div className={`flex flex-col gap-1.5 px-3 pb-3 overflow-auto flex-1 min-h-0 rounded-xl transition-colors ${dragOver ? "ring-1 ring-primary/40 bg-primary/5" : ""}`}>

        {favorites.length === 0 && (
          <div className={`flex-1 flex flex-col items-center justify-center text-center py-8 rounded-xl border-2 border-dashed transition-colors ${dragOver ? "border-primary/50" : "border-white/10"}`}>
            <span className="text-white/20 text-2xl mb-2">★</span>
            <p className="text-sm text-white/30">Drag spells, items or features here</p>
            <p className="text-xs text-white/20 mt-0.5">or use ★ in quick search</p>
          </div>
        )}

        {favorites.map((fav, idx) => {
          const label      = resolveLabel(fav)
          const isExpanded = expandedIds.has(fav.refId)

          // Feature use count for header pill
          const featForHeader = fav.refType === "feature" ? resolveFeature(fav.refId) : null
          const showUsesPill  = !!(featForHeader?.trackable && (
            featForHeader.maxUsesFormula === "pb" ? pb : (featForHeader.maxUses ?? 0)
          ) > 0)
          const headerMax     = featForHeader?.maxUsesFormula === "pb" ? pb : (featForHeader?.maxUses ?? 0)
          const headerRem     = showUsesPill ? Math.max(0, headerMax - (featForHeader?.usesUsed ?? 0)) : 0

          const isReorderTarget = reorderOverIdx === idx && reorderDragIdx !== idx

          return (
            <div key={fav.refId}
              className={`${theme.box} border rounded-xl overflow-hidden transition-all ${
                isExpanded ? "border-white/20" : "border-white/10"
              } ${isReorderTarget ? "ring-1 ring-primary/60" : ""} ${
                reorderDragIdx === idx ? "opacity-40" : ""
              }`}
              onDragOver={e => handleReorderDragOver(e, idx)}
              onDrop={e => handleReorderDrop(e, idx)}
            >

              {/* Card header row: grip | icon+name | X/Y count | ★ */}
              <div className="flex items-center gap-2 px-2 py-2 min-h-11">
                {!readOnly && (
                  <span
                    draggable
                    onDragStart={e => handleReorderDragStart(e, idx)}
                    onDragEnd={handleReorderDragEnd}
                    className="text-white/15 hover:text-white/40 cursor-grab active:cursor-grabbing text-sm shrink-0 px-0.5 select-none"
                    title="Drag to reorder">⠿</span>
                )}

                {/* Icon + name — click to toggle expanded detail */}
                <div className="flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity select-none"
                  onClick={() => toggleExpanded(fav.refId)}>
                  <span className="text-sm text-white/30 shrink-0">{TYPE_ICON[fav.refType] ?? "·"}</span>
                  <span className="text-sm font-semibold text-white truncate">{label}</span>
                </div>

                {/* Compact X/Y count right next to ★ */}
                {showUsesPill && (
                  <span className="text-xs tabular-nums text-white/50 shrink-0">{headerRem}/{headerMax}</span>
                )}

                {!readOnly && (
                  <button type="button"
                    onClick={e => { e.stopPropagation(); onRemove(fav.refId) }}
                    title="Remove from favorites"
                    className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-yellow-400 hover:text-yellow-200 text-base shrink-0 transition-colors">
                    ★
                  </button>
                )}
              </div>

              {/* Always-visible slider row for tracked features */}
              {showUsesPill && (() => {
                const feat = resolveFeature(fav.refId)!
                return (
                  <div className="px-3 pb-2.5">
                    <TracingSlider
                      value={headerRem}
                      max={headerMax}
                      disabled={readOnly}
                      color={feat.sliderColor}
                      showButtons
                      onChange={val => onUpdateUses(fav.refId, headerMax - val)}
                    />
                  </div>
                )
              })()}

              {/* Expanded detail: description + edit (click name to toggle) */}
              {isExpanded && (
                <div className="px-3 pb-3 border-t border-white/5 pt-2.5">
                  {fav.refType === "spell" && (() => {
                    const spell = resolveSpell(fav.refId)
                    return spell
                      ? <SpellDetail spell={spell} />
                      : <p className="text-sm text-white/30 italic">Spell not found.</p>
                  })()}
                  {fav.refType === "equipment" && (() => {
                    const it = resolveEquip(fav.refId)
                    return it
                      ? <EquipDetail item={it} />
                      : <p className="text-sm text-white/30 italic">Item not found.</p>
                  })()}
                  {fav.refType === "feature" && (() => {
                    const feat = resolveFeature(fav.refId)
                    return feat
                      ? <FeatureEntry
                          feature={feat}
                          allFeatures={features.filter(f => f.id !== feat.id && f.trackable)}
                          theme={theme}
                          readOnly={readOnly}
                          pb={pb}
                          onChange={patch => onUpdateFeature(fav.refId, patch)}
                          onRemove={() => {}}
                          onLinkToggle={otherId => onLinkToggle(fav.refId, otherId)}
                        />
                      : <p className="text-sm text-white/30 italic">Feature not found.</p>
                  })()}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )

  // ── Floating wrapper ─────────────────────────────────────────────────────

  if (isFloat) {
    return (
      <div
        style={{ position: "fixed", left: floatPos.x, top: floatPos.y, width: 320, zIndex: 40, maxHeight: "70vh" }}
        className={`${card} shadow-2xl rounded-2xl flex flex-col overflow-hidden border border-white/20 ${isDraggingWindow ? "cursor-grabbing" : ""}`}>
        {panelContent}
      </div>
    )
  }

  // ── Docked wrapper ───────────────────────────────────────────────────────

  return (
    <div className={`${card} flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden`}>
      {panelContent}
    </div>
  )
}
