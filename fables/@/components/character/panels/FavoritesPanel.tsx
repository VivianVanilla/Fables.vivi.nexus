// ════════════════════════════════════════════════════════════════════════════
// FavoritesPanel.tsx — drag-drop favorites panel with expandable cards
//
// Can be docked (inline) or floated (fixed overlay, draggable by header).
// Each favorite expands on click to show spell / item / feature detail.
// ★ = currently favorited — click to remove.
// ════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { FavoriteRef, SpellItem, EquipmentItem, Feature } from "../../character-types"
import { TracingSlider } from "../../ui/tracing-slider"
import type { Theme } from "../../character-themes"

const MD_PROSE = "prose prose-sm prose-invert max-w-none text-white/60 prose-p:leading-relaxed prose-p:my-1 prose-table:text-xs prose-th:text-white/50 prose-td:text-white/50"

// ── Types ─────────────────────────────────────────────────────────────────────

interface FavoritesPanelProps {
  favorites:        FavoriteRef[]
  spellItems:       SpellItem[]
  equipItems:       EquipmentItem[]
  features:         Feature[]
  onRemove:         (refId: string) => void
  onUpdateUses:     (featureId: string, usesUsed: number) => void
  theme:            Theme
  card:             string
  readOnly:         boolean
  dragOver:         boolean
  onDragOver:       (e: React.DragEvent) => void
  onDragLeave:      () => void
  onDrop:           (e: React.DragEvent) => void
  // Float / popout
  isFloat:          boolean
  floatPos:         { x: number; y: number }
  onFloatToggle:    () => void
  onFloatPosChange: (pos: { x: number; y: number }) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resetLabel(r?: Feature["resetsOn"]) {
  if (r === "short") return "Short Rest"
  if (r === "dawn")  return "Dawn"
  return "Long Rest"
}

// ── Sub-components ────────────────────────────────────────────────────────────

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

function FeatureDetail({
  feature, readOnly, onUpdateUses,
}: {
  feature: Feature
  readOnly: boolean
  onUpdateUses: (usesUsed: number) => void
}) {
  const maxUses       = feature.maxUses  ?? 0
  const usesUsed      = feature.usesUsed ?? 0
  const usesRemaining = Math.max(0, maxUses - usesUsed)
  const hasUses       = !!(feature.trackable && maxUses > 0)

  return (
    <div className="flex flex-col gap-2">
      {feature.source && (
        <span className="text-sm text-white/40 italic">{feature.source}</span>
      )}
      {feature.description && (
        <div className={MD_PROSE}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{feature.description}</ReactMarkdown>
        </div>
      )}
      {hasUses && (
        <TracingSlider
          value={usesRemaining}
          max={maxUses}
          disabled={readOnly}
          color={feature.sliderColor}
          showButtons
          showLabel
          label={`${usesRemaining}/${maxUses} uses`}
          labelRight={resetLabel(feature.resetsOn)}
          onChange={val => onUpdateUses(maxUses - val)}
        />
      )}
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<string, string> = { spell: "✦", equipment: "⚔", feature: "◈" }

export function FavoritesPanel({
  favorites, spellItems, equipItems, features,
  onRemove, onUpdateUses,
  theme, card, readOnly,
  dragOver, onDragOver, onDragLeave, onDrop,
  isFloat, floatPos, onFloatToggle, onFloatPosChange,
}: FavoritesPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // ── Float / drag state ───────────────────────────────────────────────────

  const [isDragging, setIsDragging] = useState(false)
  const dragOffsetRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (!isFloat || !isDragging) return

    const onMove = (e: MouseEvent) => {
      onFloatPosChange({
        x: Math.max(0, e.clientX - dragOffsetRef.current.x),
        y: Math.max(0, e.clientY - dragOffsetRef.current.y),
      })
    }
    const onUp = () => setIsDragging(false)

    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
  }, [isFloat, isDragging, onFloatPosChange])

  function startHeaderDrag(e: React.MouseEvent) {
    if (!isFloat) return
    dragOffsetRef.current = {
      x: e.clientX - floatPos.x,
      y: e.clientY - floatPos.y,
    }
    setIsDragging(true)
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

  // ── Panel body ───────────────────────────────────────────────────────────

  const floatWidth = 300

  const panelContent = (
    <div
      className={`flex flex-col gap-2 ${isFloat ? "h-full" : "flex-1 min-h-0"}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Header */}
      <div
        className={`flex items-center gap-2 shrink-0 px-3 pt-3 ${isFloat ? "cursor-grab active:cursor-grabbing select-none pb-1" : "pb-0"}`}
        onMouseDown={startHeaderDrag}
      >
        {isFloat && (
          <span className="text-white/20 text-sm mr-0.5" title="Drag to move">⠿</span>
        )}
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

        {favorites.map(fav => {
          const label      = resolveLabel(fav)
          const isExpanded = expandedId === fav.refId

          return (
            <div key={fav.refId}
              className={`${theme.box} border rounded-xl overflow-hidden transition-all ${isExpanded ? "border-white/20" : "border-white/10"}`}>

              {/* Card header */}
              <div
                className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-white/5 transition-colors select-none min-h-11"
                onClick={() => setExpandedId(isExpanded ? null : fav.refId)}>
                <span className="text-sm text-white/30 shrink-0">{TYPE_ICON[fav.refType] ?? "·"}</span>
                <span className="text-sm font-semibold text-white flex-1 truncate min-w-0">{label}</span>

                {/* Use count badge */}
                {fav.refType === "feature" && (() => {
                  const f = resolveFeature(fav.refId)
                  if (f?.trackable && f?.maxUses) {
                    const rem = Math.max(0, (f.maxUses ?? 0) - (f.usesUsed ?? 0))
                    return <span className="text-sm text-white/50 shrink-0 tabular-nums">{rem}/{f.maxUses}</span>
                  }
                  return null
                })()}

                {/* Star = unfavorite */}
                {!readOnly && (
                  <button type="button"
                    onClick={e => { e.stopPropagation(); onRemove(fav.refId) }}
                    title="Remove from favorites"
                    className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-yellow-400 hover:text-yellow-200 text-base shrink-0 transition-colors">
                    ★
                  </button>
                )}
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-4 pb-3 border-t border-white/5 pt-2">
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
                      ? <FeatureDetail
                          feature={feat}
                          readOnly={readOnly}
                          onUpdateUses={u => onUpdateUses(fav.refId, u)}
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
        style={{ position: "fixed", left: floatPos.x, top: floatPos.y, width: floatWidth, zIndex: 40, maxHeight: "70vh" }}
        className={`${card} shadow-2xl rounded-2xl flex flex-col overflow-hidden border border-white/20 ${isDragging ? "cursor-grabbing" : ""}`}
      >
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
