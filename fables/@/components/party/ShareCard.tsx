// ════════════════════════════════════════════════════════════════════════════
// ShareCard.tsx — stylized chat-message rendering for a shared feature, spell,
// or familiar, with an "Add to Character" action for the recipient.
// ════════════════════════════════════════════════════════════════════════════

import { useState } from "react"
import { useUserContext } from "../../../src/contexts/UserContext"
import { safeParseJson, nanoid } from "../character-utils"
import type { SidebarObject } from "../sidebar-utils"
import type { CharacterData, Feature, SpellItem, FamiliarRef } from "../character-types"
import type { FeatureBucket, SharePayload } from "./partyTypes"

function normalizedPartyCode(code: string) {
  return code.trim().toUpperCase()
}

const BUCKET_LABEL: Record<FeatureBucket, string> = {
  racialTraits: "Racial Trait",
  feats: "Feat",
  classFeatures: "Class Feature",
  items: "Item",
  invocations: "Invocation",
}

function kindLabel(payload: SharePayload) {
  if (payload.kind === "feature") return BUCKET_LABEL[payload.bucket ?? "items"]
  if (payload.kind === "spell") return "Spell"
  return "Familiar"
}

export function ShareCard({ payload, canAdd, partyCode }: {
  payload: SharePayload
  canAdd: boolean
  partyCode: string
}) {
  const { objects, updateObject } = useUserContext()
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const item = payload.item as Record<string, unknown>
  const name = typeof item.name === "string" ? item.name : "Unnamed"
  const description = typeof item.description === "string" ? item.description
    : typeof item.notes === "string" ? item.notes : ""

  const myCharacters = (objects as SidebarObject[]).filter(o => {
    if (o.type !== "character") return false
    const d = safeParseJson(o.data) as { partyCode?: string }
    return !!d.partyCode && normalizedPartyCode(d.partyCode) === normalizedPartyCode(partyCode)
  })

  async function addTo(character: SidebarObject) {
    setBusy(true)
    try {
      const charData = safeParseJson(character.data) as CharacterData
      if (payload.kind === "feature") {
        const bucket = payload.bucket ?? "items"
        const existing = charData[bucket] ?? []
        const copy: Feature = { ...(item as unknown as Feature), id: nanoid() }
        await updateObject(character.id, { data: { ...charData, [bucket]: [...existing, copy] } as unknown as JSON })
      } else if (payload.kind === "spell") {
        const existing = charData.spellItems ?? []
        const copy: SpellItem = { ...(item as unknown as SpellItem), id: nanoid() }
        await updateObject(character.id, { data: { ...charData, spellItems: [...existing, copy] } as unknown as JSON })
      } else {
        const existing = charData.familiars ?? []
        const copy: FamiliarRef = { ...(item as unknown as FamiliarRef), id: nanoid() }
        await updateObject(character.id, { data: { ...charData, familiars: [...existing, copy] } as unknown as JSON })
      }
      setDone(true)
      setPicking(false)
    } catch (e) { console.error(e) }
    setBusy(false)
  }

  return (
    <div className="rounded-xl border border-violet-400/30 bg-violet-500/10 overflow-hidden max-w-[280px] w-full">
      <div className="px-3 py-1.5 bg-violet-500/15">
        <span className="text-[9px] uppercase tracking-widest font-bold text-violet-300">{kindLabel(payload)}</span>
      </div>
      <div className="px-3 py-2">
        <p className="text-sm font-semibold text-foreground">{name}</p>
        {description && <p className="text-xs text-foreground/60 mt-1 line-clamp-3">{description}</p>}
      </div>
      {canAdd && !done && (
        <div className="px-3 pb-2.5">
          {!picking ? (
            <button type="button" onClick={() => setPicking(true)}
              className="text-[10px] px-2.5 py-1 rounded-full bg-violet-400/20 hover:bg-violet-400/30 text-violet-200 font-semibold transition-colors">
              + Add to Character
            </button>
          ) : (
            <div className="flex flex-col gap-1">
              {myCharacters.length === 0 && (
                <p className="text-[10px] text-foreground/40 italic">No characters of yours are in this party.</p>
              )}
              {myCharacters.map(c => (
                <button key={c.id} type="button" disabled={busy} onClick={() => addTo(c)}
                  className="text-left text-[11px] px-2.5 py-1 rounded-lg bg-violet-400/15 hover:bg-violet-400/25 text-violet-100 disabled:opacity-40 transition-colors">
                  {c.name}
                </button>
              ))}
              <button type="button" onClick={() => setPicking(false)}
                className="text-left text-[10px] px-2.5 py-1 rounded-lg text-foreground/40 hover:text-foreground/60 transition-colors">
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
      {done && <div className="px-3 pb-2.5 text-[10px] text-green-400 font-semibold">✓ Added to character</div>}
    </div>
  )
}
