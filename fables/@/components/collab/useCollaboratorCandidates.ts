// ════════════════════════════════════════════════════════════════════════════
// useCollaboratorCandidates.ts — "people I play with", for note invite menus
//
// A candidate is anyone whose character shares a party code with one of MY
// OWN characters — the closest thing this app has to "people I play with."
// Shared by NoteView's Collaborators menu and the character sheet's linked
// InlineNote menu so both invite from the same list.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react"
import { useUserContext } from "../../../src/contexts/UserContext"
import { supabase } from "../../../src/supabase"
import { safeParseJson } from "../character-utils"

export interface PartyMemberOption {
  userId: string
  label: string
}

export function useCollaboratorCandidates(enabled: boolean) {
  const { user, objects } = useUserContext()
  const [candidates, setCandidates] = useState<PartyMemberOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled) return
    setLoading(true)
    const myPartyCodes = Array.from(new Set(
      objects
        .filter(o => o.type === "character")
        .map(o => (safeParseJson(o.data) as { partyCode?: string }).partyCode)
        .filter((c): c is string => !!c)
    ))
    if (myPartyCodes.length === 0) { setCandidates([]); setLoading(false); return }

    supabase.from("objects").select("id, name, owner_id, data")
      .eq("type", "character")
      .in("data->>partyCode", myPartyCodes)
      .then(({ data: rows, error }) => {
        if (error) { console.error(error); setLoading(false); return }
        const seen = new Set<string>()
        const opts: PartyMemberOption[] = []
        for (const row of (rows ?? []) as { id: string; name: string; owner_id: string }[]) {
          if (row.owner_id === user?.id || seen.has(row.owner_id)) continue
          seen.add(row.owner_id)
          opts.push({ userId: row.owner_id, label: row.name })
        }
        setCandidates(opts)
        setLoading(false)
      })
  }, [enabled, objects, user?.id])

  return { candidates, loading }
}
