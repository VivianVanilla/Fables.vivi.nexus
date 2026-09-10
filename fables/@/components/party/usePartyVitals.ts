// ════════════════════════════════════════════════════════════════════════════
// usePartyVitals.ts — every party member's current HP, live, for the party
// chat rail's roster panel. Party members can already SELECT each other's
// character rows (see usePartyServer's roster query), so this just reads
// them directly and keeps them current with the same broad
// `type=eq.character` realtime subscription CampaignView's roster uses —
// `objects` has no partyCode column to filter on server-side, so the party
// check runs client-side on each payload.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react"
import { supabase } from "../../../src/supabase"
import { safeParseJson } from "@/components/shared/utils"
import { useChannelSuffix } from "./partyTypes"
import { useOnResume } from "@/components/shared/useOnResume"
import type { CharacterData, CharacterForm } from "@/components/shared/types"

export interface PartyVital {
  characterId: string
  ownerId: string
  name: string
  hp: number
  maxHp: number
  tempHp: number
}

interface CharRow { id: string; owner_id: string; name: string; data: unknown }

// Mirrors CharacterSheet.tsx's HP math for the Wild Shape-style form pool
// (a form with its own formMaxHp tracks HP separately); plain characters
// just read hp / maxHp+maxHpMod.
function vitalOf(row: CharRow): PartyVital {
  const d = safeParseJson(row.data) as CharacterData
  const forms = d.forms ?? []
  const activeIds = d.multiFormMode ? (d.activeFormIds ?? []) : (d.activeFormId ? [d.activeFormId] : [])
  const poolForm = activeIds
    .map(id => forms.find(f => f.id === id))
    .find((f): f is CharacterForm => !!f && f.formMaxHp != null)
  if (poolForm) {
    return { characterId: row.id, ownerId: row.owner_id, name: row.name, hp: d.formHp ?? poolForm.formMaxHp!, maxHp: poolForm.formMaxHp!, tempHp: 0 }
  }
  return {
    characterId: row.id, ownerId: row.owner_id, name: row.name,
    hp: d.hp ?? 0, maxHp: Math.max(0, (d.maxHp ?? 0) + (d.maxHpMod ?? 0)), tempHp: d.tempHp ?? 0,
  }
}

export function usePartyVitals(partyCode: string) {
  const [vitals, setVitals] = useState<PartyVital[]>([])
  const suffix = useChannelSuffix()
  const genRef = useRef(0)

  function fetchVitals() {
    if (!partyCode) return
    const gen = genRef.current
    supabase.from("objects").select("id, owner_id, name, data")
      .eq("type", "character").filter("data->>partyCode", "eq", partyCode)
      .then(({ data, error }) => {
        if (gen !== genRef.current) return
        if (error) { console.error("party vitals load error:", error); return }
        if (data) setVitals((data as CharRow[]).map(vitalOf))
      })
  }

  useEffect(() => {
    genRef.current++
    fetchVitals()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { genRef.current++ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyCode])

  useOnResume(fetchVitals)

  useEffect(() => {
    if (!partyCode) return
    const ch = supabase
      .channel(`party-vitals:${partyCode}:${suffix}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "objects", filter: "type=eq.character" },
        payload => {
          const row = payload.new as CharRow
          const d = safeParseJson(row.data) as CharacterData
          setVitals(prev => {
            const has = prev.some(v => v.characterId === row.id)
            if (d.partyCode !== partyCode) return has ? prev.filter(v => v.characterId !== row.id) : prev
            const next = vitalOf(row)
            return has ? prev.map(v => v.characterId === row.id ? next : v) : [...prev, next]
          })
        })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "objects", filter: "type=eq.character" },
        payload => {
          const row = payload.new as CharRow
          if ((safeParseJson(row.data) as CharacterData).partyCode !== partyCode) return
          setVitals(prev => prev.some(v => v.characterId === row.id) ? prev : [...prev, vitalOf(row)])
        })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "objects", filter: "type=eq.character" },
        payload => {
          const old = payload.old as { id?: string }
          if (old.id) setVitals(prev => prev.filter(v => v.characterId !== old.id))
        })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [partyCode, suffix])

  return vitals
}
