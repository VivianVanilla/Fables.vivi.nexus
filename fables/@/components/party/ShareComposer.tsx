// ════════════════════════════════════════════════════════════════════════════
// ShareComposer.tsx — popover for attaching one of your own
// features/spells/familiars to an outgoing chat message, so a player can
// send something to the DM (or anyone else in the thread) fast for review.
// Purely a picker — nothing gets built from scratch here.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from "react"
import { useUserContext } from "../../../src/contexts/UserContext"
import { safeParseJson } from "../character-utils"
import type { SidebarObject } from "../sidebar-utils"
import type { CharacterData, Feature } from "../character-types"
import type { FeatureBucket, SharePayload } from "./partyTypes"

function normalizedPartyCode(code: string) {
  return code.trim().toUpperCase()
}

const FEATURE_BUCKETS: { id: FeatureBucket; label: string }[] = [
  { id: "racialTraits", label: "Racial Traits" },
  { id: "feats", label: "Feats" },
  { id: "classFeatures", label: "Class Features" },
  { id: "items", label: "Items" },
  { id: "invocations", label: "Invocations" },
]

export function ShareComposer({ partyCode, onAttach, onClose }: {
  partyCode: string
  onAttach: (payload: SharePayload) => void
  onClose: () => void
}) {
  const { objects } = useUserContext()
  const [search, setSearch] = useState("")

  const myCharacters = useMemo(() => (objects as SidebarObject[]).filter(o => {
    if (o.type !== "character") return false
    const d = safeParseJson(o.data) as { partyCode?: string }
    return !!d.partyCode && normalizedPartyCode(d.partyCode) === normalizedPartyCode(partyCode)
  }), [objects, partyCode])

  const [sourceId, setSourceId] = useState<string | null>(myCharacters[0]?.id ?? null)

  // `objects` can still be loading the first time this popover is opened —
  // pick a default source character as soon as one becomes available
  // instead of latching permanently onto whatever was there at mount.
  useEffect(() => {
    if (!sourceId && myCharacters.length > 0) setSourceId(myCharacters[0].id)
  }, [myCharacters, sourceId])

  const source = myCharacters.find(c => c.id === sourceId) ?? null
  const sourceData = source ? (safeParseJson(source.data) as CharacterData) : null

  function pickFeature(bucket: FeatureBucket, feature: Feature) {
    onAttach({ kind: "feature", bucket, item: feature as unknown as Record<string, unknown> })
    onClose()
  }

  const q = search.trim().toLowerCase()

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 max-h-[60vh] flex flex-col rounded-xl border border-border bg-card shadow-xl overflow-hidden z-30">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border shrink-0">
        <span className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-foreground">
          Send to DM
        </span>
        <div className="flex-1" />
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs px-1">✕</button>
      </div>

      <div className="flex flex-col flex-1 min-h-0">
        {myCharacters.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 italic text-center py-6 px-3">
            You have no character in this party to share from.
          </p>
        ) : (
          <>
            {myCharacters.length > 1 && (
              <select value={sourceId ?? ""} onChange={e => setSourceId(e.target.value)}
                className="mx-2 mt-2 rounded-lg bg-muted text-xs px-2 py-1 outline-none shrink-0">
                {myCharacters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              className="mx-2 mt-2 rounded-lg bg-muted text-xs px-2 py-1.5 outline-none placeholder:text-muted-foreground/50 shrink-0" />
            <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2 flex flex-col gap-2">
              {sourceData && FEATURE_BUCKETS.map(({ id, label }) => {
                const list = (sourceData[id] ?? []).filter(f => !q || f.name.toLowerCase().includes(q))
                if (list.length === 0) return null
                return (
                  <div key={id}>
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground/60 font-semibold px-1 mb-0.5">{label}</p>
                    {list.map(f => (
                      <button key={f.id} type="button" onClick={() => pickFeature(id, f)}
                        className="w-full text-left text-xs px-2 py-1.5 rounded-lg hover:bg-foreground/10 text-foreground/80 transition-colors">
                        {f.name || "Unnamed"}
                      </button>
                    ))}
                  </div>
                )
              })}
              {sourceData && (() => {
                const spells = (sourceData.spellItems ?? []).filter(s => !q || s.name.toLowerCase().includes(q))
                if (spells.length === 0) return null
                return (
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground/60 font-semibold px-1 mb-0.5">Spells</p>
                    {spells.map(s => (
                      <button key={s.id} type="button"
                        onClick={() => { onAttach({ kind: "spell", item: s as unknown as Record<string, unknown> }); onClose() }}
                        className="w-full text-left text-xs px-2 py-1.5 rounded-lg hover:bg-foreground/10 text-foreground/80 transition-colors">
                        {s.name || "Unnamed"}
                      </button>
                    ))}
                  </div>
                )
              })()}
              {sourceData && (() => {
                const fams = (sourceData.familiars ?? []).filter(f => !q || (f.nickname ?? "").toLowerCase().includes(q))
                if (fams.length === 0) return null
                return (
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground/60 font-semibold px-1 mb-0.5">Familiars</p>
                    {fams.map(f => (
                      <button key={f.id} type="button"
                        onClick={() => { onAttach({ kind: "familiar", item: f as unknown as Record<string, unknown> }); onClose() }}
                        className="w-full text-left text-xs px-2 py-1.5 rounded-lg hover:bg-foreground/10 text-foreground/80 transition-colors">
                        {f.nickname || "Familiar"}
                      </button>
                    ))}
                  </div>
                )
              })()}
              {sourceData && FEATURE_BUCKETS.every(({ id }) => (sourceData[id] ?? []).length === 0)
                && (sourceData.spellItems ?? []).length === 0 && (sourceData.familiars ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground/50 italic text-center py-6 px-3">
                  Nothing on this character yet to send.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
