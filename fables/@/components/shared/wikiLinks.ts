// ════════════════════════════════════════════════════════════════════════════
// wikiLinks.ts — [[Name]] mention parsing shared between the NPC Tracker and
// character/workspace notes. Rewrites a match into a "#internal:<scheme>:<id>"
// pseudo-link that Markdown.tsx's onInternalLink intercepts instead of
// navigating (leading "#" matters — see useNpcTrackers.ts's original comment
// on why a bare "internal:" scheme gets stripped by react-markdown's link
// sanitizer). Unmatched mentions are left as literal "[[Name]]" text rather
// than silently dropped, so a bad/typo'd link stays visible instead of
// vanishing.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../../src/supabase"
import { useObjects } from "../../../src/contexts/UserContext"
import type { NpcTracker } from "../npcTracker/useNpcTrackers"

const WIKI_LINK_RE = /\[\[([^[\]]+)\]\]/g

export function linkifyMentions(text: string, targets: { id: string; name: string }[], scheme: string): string {
  return text.replace(WIKI_LINK_RE, (match, rawName: string) => {
    const name = rawName.trim()
    const target = targets.find(t => t.name.toLowerCase() === name.toLowerCase())
    return target ? `[${name}](#internal:${scheme}:${target.id})` : match
  })
}

// Cross-linking for a notes surface: [[Name]] resolves against the current
// party's NPCs (if partyCode is known — e.g. a character's notes) and/or the
// signed-in user's own notes/characters (always, via the same "objects" list
// the sidebar reads from). Deliberately scoped to *your own* objects even
// inside party-shared NPC Tracker notes — the objects table is owner-scoped
// (RLS), so a link to someone else's private character would just fail to
// resolve anyway; this only ever links to something you can actually open.
export function useWikiLinks(partyCode: string | null | undefined) {
  const navigate = useNavigate()
  const objects = useObjects()
  const [npcs, setNpcs] = useState<Pick<NpcTracker, "id" | "name">[]>([])
  const [quickViewNpc, setQuickViewNpc] = useState<NpcTracker | null>(null)

  useEffect(() => {
    if (!partyCode) { setNpcs([]); return }
    let cancelled = false
    supabase.from("npc_trackers").select("id, name").eq("party_code", partyCode)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) { console.error("wikiLinks: npc load error:", error); return }
        if (data) setNpcs(data)
      })
    return () => { cancelled = true }
  }, [partyCode])

  const linkableObjects = objects.filter(o => o.type === "note" || o.type === "character")

  function linkify(text: string): string {
    return linkifyMentions(linkifyMentions(text, npcs, "npc"), linkableObjects, "object")
  }

  // Also used as NpcQuickViewModal's onSelectNpc — a link clicked *inside*
  // the popup (to a different NPC on the same shelf) swaps which one it's
  // showing the same way the initial click did, rather than needing a
  // second code path.
  async function selectNpc(id: string) {
    const { data, error } = await supabase.from("npc_trackers").select("*").eq("id", id).maybeSingle()
    if (error) { console.error("wikiLinks: npc fetch error:", error); return }
    if (data) setQuickViewNpc(data as NpcTracker)
  }

  async function onInternalLink(target: string) {
    if (target.startsWith("npc:")) { selectNpc(target.slice("npc:".length)); return }
    if (target.startsWith("object:")) {
      navigate(`/dashboard?open=${encodeURIComponent(target.slice("object:".length))}`)
    }
  }

  return { linkify, onInternalLink, npcs, quickViewNpc, selectNpc, closeQuickView: () => setQuickViewNpc(null) }
}
