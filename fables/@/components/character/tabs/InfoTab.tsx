// ════════════════════════════════════════════════════════════════════════════
// InfoTab.tsx — Info tab with Overview / Traits / Feats / Features sub-tabs
// ════════════════════════════════════════════════════════════════════════════

import { useState } from "react"
import type { CharacterData, Feature } from "../../character-types"
import type { Theme } from "../../character-themes"
import { nanoid } from "../../character-utils"
import { FeatureEntry } from "../entries/FeatureEntry"

// ── Types ─────────────────────────────────────────────────────────────────────

type InfoSubTab = "overview" | "traits" | "feats" | "features"

interface InfoTabProps {
  data: CharacterData
  update: (patch: Partial<CharacterData>) => void
  theme: Theme
  card: string
  readOnly: boolean
}

// ── Sub-component: FeatureList ────────────────────────────────────────────────

interface FeatureListProps {
  items: Feature[]
  label: string
  onAdd: () => void
  onChange: (id: string, patch: Partial<Feature>) => void
  onRemove: (id: string) => void
  theme: Theme
  card: string
  readOnly: boolean
}

function FeatureList({ items, label, onAdd, onChange, onRemove, theme, card, readOnly }: FeatureListProps) {
  return (
    <div className={`${card} p-3 flex flex-col gap-2 flex-1 min-h-0`}>

      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <span className="text-[10px] uppercase tracking-widest text-white/50 font-semibold">{label}</span>
        {!readOnly && (
          <button
            type="button"
            onClick={onAdd}
            className="text-[9px] px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors"
          >
            + Add
          </button>
        )}
      </div>

      {/* Entry list */}
      <div className="flex flex-col gap-1.5 overflow-auto flex-1">
        {items.length === 0 && (
          <p className="text-[10px] text-white/25 italic text-center py-6">
            {readOnly ? "None" : "None yet — click Add"}
          </p>
        )}
        {items.map(f => (
          <FeatureEntry
            key={f.id}
            feature={f}
            theme={theme}
            readOnly={readOnly}
            onChange={patch => onChange(f.id, patch)}
            onRemove={() => onRemove(f.id)}
          />
        ))}
      </div>
    </div>
  )
}

// ── Main InfoTab component ────────────────────────────────────────────────────

const SUB_TABS: [InfoSubTab, string][] = [
  ["overview", "Overview"],
  ["traits",   "Traits"],
  ["feats",    "Feats"],
  ["features", "Features"],
]

export function InfoTab({ data, update, theme, card, readOnly }: InfoTabProps) {
  const [subTab, setSubTab] = useState<InfoSubTab>("overview")

  // ── Feature list helpers ─────────────────────────────────────────────────

  type FeatureKey = "racialTraits" | "feats" | "classFeatures"

  function addFeature(key: FeatureKey) {
    update({ [key]: [...(data[key] ?? []), { id: nanoid(), name: "" }] })
  }

  function changeFeature(key: FeatureKey, id: string, patch: Partial<Feature>) {
    update({ [key]: (data[key] ?? []).map(f => f.id === id ? { ...f, ...patch } : f) })
  }

  function removeFeature(key: FeatureKey, id: string) {
    update({ [key]: (data[key] ?? []).filter(f => f.id !== id) })
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">

      {/* Sub-tab bar */}
      <div className="flex items-center gap-1 flex-wrap shrink-0">
        {SUB_TABS.map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            onClick={() => setSubTab(tab)}
            className={`px-3 py-1 text-[10px] uppercase tracking-widest rounded-full font-semibold transition-colors ${
              subTab === tab
                ? "bg-white/20 text-white"
                : "text-white/40 hover:text-white/70 hover:bg-white/5"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Overview ───────────────────────────────────────────────────────── */}

      {subTab === "overview" && (
        <div className="flex flex-col gap-3 overflow-auto flex-1">

          {/* Background / Alignment */}
          <div className={`${card} p-3 flex flex-col gap-2`}>
            <span className="text-[10px] uppercase tracking-widest text-white/50 font-semibold">Background</span>
            <input
              value={data.background ?? ""}
              onChange={e => update({ background: e.target.value })}
              placeholder="Acolyte, Sage…"
              disabled={readOnly}
              className="bg-transparent outline-none text-xs text-white placeholder:text-white/20 border-b border-white/10 pb-1 disabled:opacity-60"
            />
            <input
              value={data.alignment ?? ""}
              onChange={e => update({ alignment: e.target.value })}
              placeholder="Alignment…"
              disabled={readOnly}
              className="bg-transparent outline-none text-xs text-white placeholder:text-white/20 disabled:opacity-60"
            />
          </div>

          {/* Party code */}
          <div className={`${card} p-3 flex flex-col gap-2`}>
            <span className="text-[10px] uppercase tracking-widest text-white/50 font-semibold">Party</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/50 shrink-0">Code</span>
              <input
                value={data.partyCode ?? ""}
                onChange={e => update({ partyCode: e.target.value.toUpperCase() })}
                placeholder="Enter party code from DM…"
                maxLength={8}
                disabled={readOnly}
                className="flex-1 bg-white/10 rounded px-2 py-1 text-xs font-mono tracking-widest text-white outline-none focus:ring-1 focus:ring-primary placeholder:text-white/20 uppercase disabled:opacity-60"
              />
            </div>
            {data.partyCode && (
              <p className="text-[9px] text-white/40">
                Joined: <span className="text-white/70 font-mono">{data.partyCode}</span>
              </p>
            )}
          </div>

          {/* Multiclass breakdown — only shown when relevant */}
          {data.multiclass && data.classes && data.classes.length > 1 && (
            <div className={`${card} p-3 flex flex-col gap-2`}>
              <span className="text-[10px] uppercase tracking-widest text-white/50 font-semibold">Classes</span>
              {data.classes.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-white/70 flex-1">{c.cls}</span>
                  <span className="text-white/40">Lv {c.level}</span>
                </div>
              ))}
            </div>
          )}

          {/* Notes hint */}
          <div className={`${card} p-3`}>
            <span className="text-[10px] uppercase tracking-widest text-white/50 font-semibold block mb-1">Notes</span>
            <p className="text-xs text-white/35 leading-relaxed">
              Create a <span className="text-white/60 font-semibold">Note</span> from the sidebar (+&nbsp;→ Note) to write character notes, backstory, or session logs with full markdown support.
            </p>
          </div>
        </div>
      )}

      {/* ── Racial Traits ──────────────────────────────────────────────────── */}

      {subTab === "traits" && (
        <FeatureList
          items={data.racialTraits ?? []}
          label="Racial Traits"
          onAdd={() => addFeature("racialTraits")}
          onChange={(id, p) => changeFeature("racialTraits", id, p)}
          onRemove={id => removeFeature("racialTraits", id)}
          theme={theme}
          card={card}
          readOnly={readOnly}
        />
      )}

      {/* ── Feats ──────────────────────────────────────────────────────────── */}

      {subTab === "feats" && (
        <FeatureList
          items={data.feats ?? []}
          label="Feats"
          onAdd={() => addFeature("feats")}
          onChange={(id, p) => changeFeature("feats", id, p)}
          onRemove={id => removeFeature("feats", id)}
          theme={theme}
          card={card}
          readOnly={readOnly}
        />
      )}

      {/* ── Class Features ─────────────────────────────────────────────────── */}

      {subTab === "features" && (
        <FeatureList
          items={data.classFeatures ?? []}
          label="Class Features"
          onAdd={() => addFeature("classFeatures")}
          onChange={(id, p) => changeFeature("classFeatures", id, p)}
          onRemove={id => removeFeature("classFeatures", id)}
          theme={theme}
          card={card}
          readOnly={readOnly}
        />
      )}
    </div>
  )
}
