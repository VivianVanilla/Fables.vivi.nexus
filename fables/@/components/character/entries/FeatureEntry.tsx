// ════════════════════════════════════════════════════════════════════════════
// FeatureEntry.tsx — collapsible feature card
//
// Untracked: ▶ Feature Name  [Source]                    [✎]
// Trackable: ▶ Feature Name  [──────slider──────] 2/3 LR  [✎]
// Expanded adds description text below the header row.
// Edit mode: name, source, description, track uses, max (or = PB), resets, links
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react"
import type { Feature } from "../../character-types"
import type { Theme } from "../../character-themes"
import { TracingSlider } from "../../ui/tracing-slider"
import { MarkdownTextarea } from "../../ui/MarkdownTextarea"
import { Markdown } from "../../ui/Markdown"
import { supabase } from "../../../../src/supabase"

// ── Feature suggestion cache — per doc type, per homebrew scope ───────────────

export type SuggestionSource = "race" | "class" | "feat" | "item"

export interface Suggestion {
  name: string
  description: string
  meta?: { item_type?: string; damage?: string; damage_type?: string; properties?: string }
}

const cacheMap   = new Map<string, Suggestion[]>()
const promiseMap = new Map<string, Promise<Suggestion[]>>()

// Called whenever the user's homebrew library changes (add/remove) so stale
// suggestions don't linger for the rest of the session.
export function invalidateSuggestionCache() {
  cacheMap.clear()
  promiseMap.clear()
}

export async function getSuggestions(docType: SuggestionSource, userId?: string | null): Promise<Suggestion[]> {
  const key = `${docType}:${userId ?? "anon"}`
  if (cacheMap.has(key)) return cacheMap.get(key)!
  if (promiseMap.has(key)) return promiseMap.get(key)!

  const p = (async () => {
    // Core (non-homebrew)
    const { data: coreRows } = await supabase
      .from("documentation").select("name, description, data")
      .eq("type", docType).eq("is_homebrew", false)

    let homebrew: any[] = []
    if (userId) {
      // Personal homebrew
      const { data: ownRows } = await supabase
        .from("documentation").select("name, description, data")
        .eq("type", docType).eq("is_homebrew", true).eq("owner_id", userId)

      // Library homebrew
      const objType = docType === "race" ? "doc_race" : docType === "class" ? "doc_class" : docType === "item" ? "doc_item" : "doc_feat"
      const { data: libObjs } = await supabase
        .from("objects").select("data").eq("type", objType).eq("owner_id", userId)
      const libIds = (libObjs ?? []).map((o: any) => o.data?.doc_id).filter(Boolean)

      let libRows: any[] = []
      if (libIds.length) {
        const { data: lr } = await supabase.from("documentation").select("name, description, data").in("id", libIds)
        libRows = lr ?? []
      }

      homebrew = [...(ownRows ?? []), ...libRows]
    }

    const all = [...(coreRows ?? []), ...homebrew]
    const results: Suggestion[] = []

    for (const row of all) {
      // Feats and items are stored as one document per entry, unlike races/classes
      // which nest traits/features arrays. The real text lives in data.description —
      // the top-level `description` column is actually the "Source" field (e.g. "PHB p.51").
      if (docType === "feat") {
        if (row.name) results.push({ name: row.name, description: row.data?.description ?? "" })
        continue
      }
      if (docType === "item") {
        if (row.name) results.push({
          name: row.name,
          description: row.data?.description ?? "",
          meta: {
            item_type:    row.data?.item_type,
            damage:       row.data?.damage,
            damage_type:  row.data?.damage_type,
            properties:   row.data?.properties,
          },
        })
        continue
      }

      const features: any[] = row.data?.features ?? []
      const traits:   any[] = row.data?.traits   ?? []

      features.forEach(f => {
        if (f?.name) results.push({ name: f.name, description: f.description ?? "" })
      })
      traits.forEach(t => {
        if (typeof t === "string") results.push({ name: t, description: "" })
        else if (t?.name) results.push({ name: t.name, description: t.description ?? "" })
      })
    }

    // Deduplicate by name
    const seen = new Set<string>()
    const deduped = results.filter(s => {
      const k = s.name.toLowerCase()
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })

    cacheMap.set(key, deduped)
    return deduped
  })()

  promiseMap.set(key, p)
  return p
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface FeatureEntryProps {
  feature:          Feature
  allFeatures:      Feature[]         // other trackable features available to link
  onChange:         (patch: Partial<Feature>) => void
  onRemove:         () => void
  onLinkToggle:     (otherId: string) => void
  theme:            Theme
  readOnly?:        boolean
  pb:               number            // current proficiency bonus
  suggestionSource?: SuggestionSource  // which doc type to autocomplete from
  userId?:          string | null
  isFavorite?:       boolean
  onToggleFavorite?: () => void        // omit to hide the star (e.g. inside FavoritesPanel, which has its own)
  onAddToEquipment?: (feature: Feature) => void  // only wired for the Items tab
  showAttunement?:   boolean            // only true for the Items tab — shows an "Attuned" toggle
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// ── Component ─────────────────────────────────────────────────────────────────

export function FeatureEntry({
  feature, allFeatures, onChange, onRemove, onLinkToggle, theme, readOnly = false, pb, suggestionSource, userId,
  isFavorite, onToggleFavorite, onAddToEquipment, showAttunement,
}: FeatureEntryProps) {
  const [expanded,    setExpanded]    = useState(false)
  const [editing,     setEditing]     = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showSuggest, setShowSuggest] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Preload cache when entering edit mode
  useEffect(() => {
    if (editing && suggestionSource) getSuggestions(suggestionSource, userId)
  }, [editing, suggestionSource, userId])

  // Compute effective max uses: PB formula overrides manual value
  const effectiveMax  = feature.maxUsesFormula === "pb" ? pb : (feature.maxUses ?? 0)
  const usesUsed      = feature.usesUsed ?? 0
  const usesRemaining = Math.max(0, effectiveMax - usesUsed)
  const hasUses       = !!(feature.trackable && effectiveMax > 0)

  // ── Drag source ──────────────────────────────────────────────────────────

  const dragAttrs = readOnly ? {} : {
    draggable: true as const,
    onDragStart(e: React.DragEvent) {
      e.dataTransfer.setData("x-fable-ref", JSON.stringify({
        refId:   feature.id,
        refType: "feature",
        label:   feature.name || "Feature",
      }))
      e.dataTransfer.effectAllowed = "copy"
    },
  }

  // ── Edit mode ────────────────────────────────────────────────────────────

  if (editing) {
    const usesPB = feature.maxUsesFormula === "pb"

    return (
      <div className={`rounded-xl ${theme.box} border border-white/20 p-3 flex flex-col gap-2`}>

        {/* Name with autocomplete */}
        <div className="relative">
          <input
            ref={nameInputRef}
            value={feature.name}
            autoFocus
            placeholder="Feature name"
            onChange={async e => {
              const q = e.target.value
              onChange({ name: q })
              if (q.length >= 2 && suggestionSource) {
                const all = await getSuggestions(suggestionSource, userId)
                const ql = q.toLowerCase()
                const matches = all.filter(s => s.name.toLowerCase().includes(ql)).slice(0, 8)
                setSuggestions(matches)
                setShowSuggest(matches.length > 0)
              } else {
                setShowSuggest(false)
              }
            }}
            onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
            className={`w-full bg-transparent outline-none text-sm font-semibold ${theme.color} placeholder:text-white/30 border-b border-white/10 pb-1.5`}
          />
          {showSuggest && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-zinc-900 border border-white/15 rounded-lg shadow-xl overflow-hidden">
              {suggestions.map(s => (
                <button
                  key={s.name}
                  type="button"
                  onMouseDown={e => {
                    e.preventDefault()
                    onChange({
                      name: s.name,
                      description: s.description || feature.description,
                      ...(s.meta ? { itemMeta: { itemType: s.meta.item_type, damage: s.meta.damage, damageType: s.meta.damage_type, properties: s.meta.properties } } : {}),
                    })
                    setShowSuggest(false)
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-white/10 transition-colors border-b border-white/5 last:border-0"
                >
                  <span className="text-white font-medium">{s.name}</span>
                  {s.description && (
                    <span className="text-white/35 ml-2 truncate block">{s.description.slice(0, 60)}{s.description.length > 60 ? "…" : ""}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input value={feature.source ?? ""} placeholder="Source (e.g. Fighter, Variant Human…)"
            onChange={e => onChange({ source: e.target.value })}
            className="flex-1 min-w-0 bg-transparent outline-none text-xs text-white/60 placeholder:text-white/20"
          />
          <label className="flex items-center gap-1.5 text-[10px] text-white/40 shrink-0">
            Level
            <input type="number" min={1} max={20} value={feature.level ?? ""} placeholder="—"
              onChange={e => onChange({ level: e.target.value ? Math.min(20, Math.max(1, parseInt(e.target.value) || 1)) : undefined })}
              className="w-11 bg-white/10 rounded px-1.5 py-1 text-center text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </label>
        </div>
        <MarkdownTextarea
          value={feature.description ?? ""}
          onChange={v => onChange({ description: v })}
          placeholder="Description…"
          rows={5}
          className="bg-transparent outline-none text-xs text-white/70 placeholder:text-white/20 resize-none leading-relaxed border-t border-white/10 pt-2 w-full"
          variant="light"
        />

        {showAttunement && (
          <label className="flex items-center gap-2 text-xs text-purple-300 cursor-pointer select-none border-t border-white/10 pt-2">
            <input type="checkbox" checked={feature.attuned ?? false}
              onChange={e => onChange({ attuned: e.target.checked })}
              className="accent-purple-500"
            />
            Attuned
          </label>
        )}

        {/* Use tracking */}
        <div className="border-t border-white/10 pt-2 flex flex-col gap-2">
          <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer select-none">
            <input type="checkbox" checked={feature.trackable ?? false}
              onChange={e => onChange({ trackable: e.target.checked })}
            />
            Track uses
          </label>

          {feature.trackable && (
            <>
              <div className="flex items-center gap-3 text-xs flex-wrap">
                {/* Max uses — either PB or manual */}
                <label className="flex items-center gap-1.5 text-white/50">
                  Max
                  {usesPB ? (
                    <span className="px-2 py-1 rounded bg-primary/20 text-primary text-xs font-semibold">PB ({pb})</span>
                  ) : (
                    <input type="number" value={feature.maxUses ?? ""} min={1}
                      onChange={e => onChange({ maxUses: parseInt(e.target.value) || 0 })}
                      className="w-12 bg-white/10 rounded px-2 py-1 text-center text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                  )}
                </label>
                <label className="flex items-center gap-1.5 text-white/50 cursor-pointer select-none">
                  <input type="checkbox" checked={usesPB}
                    onChange={e => onChange({ maxUsesFormula: e.target.checked ? "pb" : undefined, maxUses: e.target.checked ? undefined : (feature.maxUses ?? 1) })}
                  />
                  = Prof. Bonus
                </label>
                <label className="flex items-center gap-1.5 text-white/50">
                  Resets on
                  <select value={feature.resetsOn ?? "long"}
                    onChange={e => onChange({ resetsOn: e.target.value as Feature["resetsOn"] })}
                    className="bg-black/30 rounded px-2 py-1 text-white outline-none text-xs">
                    <option value="short">Short Rest</option>
                    <option value="long">Long Rest</option>
                    <option value="dawn">Dawn</option>
                    <option value="manual">Manual</option>
                  </select>
                </label>
                <label className="flex items-center gap-1.5 text-white/50 cursor-pointer">
                  Bar color
                  <input type="color" value={feature.sliderColor ?? "#6366f1"}
                    onChange={e => onChange({ sliderColor: e.target.value })}
                    className="size-4 cursor-pointer rounded border-0 bg-transparent p-0"
                  />
                </label>
              </div>

              {/* Linked features — only features with matching max uses are eligible to sync,
                  except already-linked ones (kept visible so a stale link can be undone). */}
              {effectiveMax > 0 && (() => {
                const linkCandidates = allFeatures.filter(other => {
                  const linked   = feature.linkedTo?.includes(other.id) ?? false
                  const otherMax = other.maxUsesFormula === "pb" ? pb : (other.maxUses ?? 0)
                  return linked || otherMax === effectiveMax
                })
                if (linkCandidates.length === 0) return null
                return (
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-white/40 uppercase tracking-widest">Sync uses with</span>
                    <div className="flex flex-wrap gap-1">
                      {linkCandidates.map(other => {
                        const linked   = feature.linkedTo?.includes(other.id) ?? false
                        const otherMax = other.maxUsesFormula === "pb" ? pb : (other.maxUses ?? 0)
                        const stale    = linked && otherMax !== effectiveMax
                        return (
                          <button key={other.id} type="button" onClick={() => onLinkToggle(other.id)}
                            title={stale ? `Max uses no longer match (${otherMax} vs ${effectiveMax}) — click to unlink` : undefined}
                            className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                              stale
                                ? "bg-red-500/10 border-red-400/40 text-red-300"
                                : linked
                                ? "bg-primary/20 border-primary/50 text-white"
                                : "border-white/15 text-white/40 hover:border-white/30 hover:text-white/70"
                            }`}>
                            {linked ? "✓ " : ""}{other.name || "Unnamed"}
                          </button>
                        )
                      })}
                    </div>
                    {(feature.linkedTo?.length ?? 0) > 0 && (
                      <p className="text-[9px] text-white/30 italic">Use changes on this feature will mirror to linked features.</p>
                    )}
                  </div>
                )
              })()}
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-white/10 pt-2">
          <button type="button" onClick={onRemove} className="text-xs text-red-400/60 hover:text-red-400 px-1 py-1 transition-colors">Delete</button>
          <button type="button" onClick={() => setEditing(false)} className="text-xs px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors">Done</button>
        </div>
      </div>
    )
  }

  // ── View mode ────────────────────────────────────────────────────────────

  return (
    <div className={`rounded-xl ${theme.box} border border-white/10 overflow-hidden`}>

      {/* Header row */}
      <div {...dragAttrs}
        className="flex flex-col px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors select-none"
        onClick={() => setExpanded(v => !v)}>

        {/* Top row: expand chevron + name + desktop bar */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/30 shrink-0 w-3">{expanded ? "▼" : "▶"}</span>

          <span className="flex-1 min-w-0 text-sm font-semibold text-white truncate">
            {feature.name || <span className="text-white/30 italic">Unnamed</span>}
          </span>

          {feature.level != null && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/50 shrink-0">Lv {feature.level}</span>
          )}

          {showAttunement && (
            <label className="flex items-center gap-1 shrink-0 text-[10px] text-purple-300" onClick={e => e.stopPropagation()} title="Attuned">
              <input type="checkbox" checked={feature.attuned ?? false} disabled={readOnly}
                onChange={e => onChange({ attuned: e.target.checked })}
                className="size-3.5 accent-purple-500 cursor-pointer" />
            </label>
          )}

          {/* Desktop bar (sm and up) */}
          {hasUses && (
            <div className="hidden sm:flex shrink-0 items-center gap-1.5 w-[50%]" onClick={e => e.stopPropagation()}>
              <TracingSlider
                value={usesRemaining} max={effectiveMax}
                disabled={readOnly} color={feature.sliderColor}
                showButtons buttonSize="sm" className="flex-1 min-w-0"
                onChange={val => onChange({ usesUsed: effectiveMax - val })}
              />
              <span className="text-xs text-white/50 shrink-0 tabular-nums w-8 text-right">
                {usesRemaining}/{effectiveMax}
              </span>
            </div>
          )}

          {(feature.linkedTo?.length ?? 0) > 0 && (
            <span className="text-[9px] text-primary/60 shrink-0" title="Synced with other feature(s)">⟳</span>
          )}
        </div>

        {/* Mobile bar — full width below name */}
        {hasUses && (
          <div className="sm:hidden flex items-center gap-2 mt-1.5 pl-5" onClick={e => e.stopPropagation()}>
            <TracingSlider
              value={usesRemaining} max={effectiveMax}
              disabled={readOnly} color={feature.sliderColor}
              showButtons buttonSize="sm" className="flex-1 min-w-0"
              onChange={val => onChange({ usesUsed: effectiveMax - val })}
            />
            <span className="text-xs text-white/50 shrink-0 tabular-nums w-8 text-right">
              {usesRemaining}/{effectiveMax}
            </span>
          </div>
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-3 border-t border-white/5 flex flex-col gap-3">
          <div className="flex items-center gap-2 mt-2">
            {feature.source && hasUses && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/50 truncate">
                {feature.source}
              </span>
            )}
            <div className="flex items-center gap-1 ml-auto">
              {onAddToEquipment && !readOnly && (
                <button type="button" onClick={e => { e.stopPropagation(); onAddToEquipment(feature) }}
                  className="text-[10px] px-2 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors shrink-0">
                  + Equipment
                </button>
              )}
              {onToggleFavorite && (
                <button type="button" onClick={e => { e.stopPropagation(); onToggleFavorite() }}
                  title="Add to favorites"
                  className={`text-base shrink-0 transition-colors ${isFavorite ? "text-yellow-400" : "text-white/20 hover:text-yellow-400"}`}>
                  ★
                </button>
              )}
              {!readOnly && (
                <button type="button" onClick={() => setEditing(true)}
                  className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/70 hover:text-white text-sm shrink-0 transition-colors">
                  ✎
                </button>
              )}
            </div>
          </div>
          {feature.description ? (
            <Markdown text={feature.description} tone="dark" />
          ) : !readOnly ? (
            <p className="text-xs text-white/20 italic">No description — click ✎ to add one.</p>
          ) : null}
        </div>
      )}
    </div>
  )
}
