// ════════════════════════════════════════════════════════════════════════════
// ShareView.tsx — public, read-only character view at /share/:objectId/:token.
// No login required: fetches the one character object matching both the id
// in the URL and its own data.shareToken (see SettingsModal's "Share Link"),
// then renders the ordinary CharacterSheet in readOnly mode. The token check
// happening as an actual query filter (not just a client-side comparison
// after an unconditional fetch) matters — see supabase/share_link_rls.sql —
// so a guessed/enumerated object id alone can't pull data without the
// matching token too.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { supabase } from "./supabase"
import type { SidebarObject } from "@/components/shell/sidebar-utils"
import { CharacterSheet } from "@/components/character/CharacterSheet"

type Status = "loading" | "ok" | "invalid" | "error"

export default function ShareView() {
  const { objectId, token } = useParams<{ objectId: string; token: string }>()
  const [character, setCharacter] = useState<SidebarObject | null>(null)
  const [status, setStatus] = useState<Status>("loading")

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!objectId || !token) { setStatus("invalid"); return }
      const { data, error } = await supabase
        .from("objects")
        .select("*")
        .eq("id", objectId)
        .eq("type", "character")
        .filter("data->>shareToken", "eq", token)
        .maybeSingle()
      if (cancelled) return
      if (error) { console.error("share view load error:", error); setStatus("error"); return }
      if (!data) { setStatus("invalid"); return }
      setCharacter(data as SidebarObject)
      setStatus("ok")
    }
    load()
    return () => { cancelled = true }
  }, [objectId, token])

  if (status === "loading") {
    return (
      <div className="h-svh flex items-center justify-center bg-background text-xs text-muted-foreground/50">
        Loading…
      </div>
    )
  }

  if (status !== "ok" || !character) {
    return (
      <div className="h-svh flex items-center justify-center bg-background px-4">
        <div className="text-center">
          <p className="text-base font-semibold text-foreground mb-1">
            {status === "invalid" ? "Link not found" : "Something went wrong"}
          </p>
          <p className="text-sm text-muted-foreground">
            {status === "invalid"
              ? "This share link is invalid, or it's been revoked/regenerated since it was sent."
              : "Couldn't load this character — try again in a moment."}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-svh max-h-svh overflow-hidden flex flex-col bg-background">
      <div className="px-4 py-2 border-b border-border shrink-0 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-semibold">
          View-only shared character
        </span>
      </div>
      <div className="flex-1 min-h-0">
        <CharacterSheet character={character} readOnly />
      </div>
    </div>
  )
}
