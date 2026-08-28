// ════════════════════════════════════════════════════════════════════════════
// unread.ts — local "last seen" tracking for the Party Server's red-dot
// notifications. Two granularities:
//   - per-thread (a specific channel or DM) — drives the sidebar dots
//   - per-party (any thread at all) — drives the outer Chat-tab badge, via
//     usePartyLatestMessageAt below, without needing the whole panel mounted.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react"
import { supabase } from "../../../src/supabase"
import { useOnResume } from "@/components/shared/useOnResume"
import { useChannelSuffix } from "./partyTypes"

const THREAD_PREFIX = "fables:seen:thread:"
const PARTY_PREFIX  = "fables:seen:party:"

function threadKey(userId: string, partyCode: string, thread: string) {
  return `${THREAD_PREFIX}${userId}:${partyCode}:${thread}`
}
function partyKey(userId: string, partyCode: string) {
  return `${PARTY_PREFIX}${userId}:${partyCode}`
}

export function markThreadSeen(userId: string, partyCode: string, thread: string) {
  const now = String(Date.now())
  try {
    localStorage.setItem(threadKey(userId, partyCode, thread), now)
    localStorage.setItem(partyKey(userId, partyCode), now)
  } catch { /* localStorage unavailable — badges just won't clear */ }
}

export function isThreadUnread(userId: string, partyCode: string, thread: string, latestIso: string | null | undefined): boolean {
  if (!latestIso) return false
  let seen = 0
  try { seen = Number(localStorage.getItem(threadKey(userId, partyCode, thread)) ?? 0) } catch { /* noop */ }
  return new Date(latestIso).getTime() > seen
}

export function isPartyUnread(userId: string, partyCode: string, latestIso: string | null | undefined): boolean {
  if (!latestIso) return false
  let seen = 0
  try { seen = Number(localStorage.getItem(partyKey(userId, partyCode)) ?? 0) } catch { /* noop */ }
  return new Date(latestIso).getTime() > seen
}

interface LatestRow {
  created_at: string
  sender_id: string
  recipient_id: string | null
}

// Lightweight — for a tab-bar badge dot that shouldn't require mounting the
// full Party Server. Tracks the newest message relevant to this user (any
// public channel message, or any DM they sent/received) via one initial
// query plus a realtime INSERT subscription.
export function usePartyLatestMessageAt(partyCode: string, currentUserId: string): string | null {
  const [latest, setLatest] = useState<string | null>(null)
  const suffix = useChannelSuffix()
  // Guards against a slow/late response applying after partyCode/
  // currentUserId changed or the hook unmounted — same concern
  // usePartyMessages' genRef addresses, see that file's comment.
  const genRef = useRef(0)

  function fetchLatest() {
    if (!partyCode || !currentUserId) return
    const gen = genRef.current
    supabase
      .from("messages")
      .select("created_at, sender_id, recipient_id")
      .eq("party_code", partyCode)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data, error }) => {
        if (gen !== genRef.current || error || !data) return
        const relevant = (data as LatestRow[]).find(
          m => m.recipient_id === null || m.sender_id === currentUserId || m.recipient_id === currentUserId
        )
        setLatest(relevant?.created_at ?? null)
      })
  }

  // Catches up on anything missed while the realtime socket was actually
  // disconnected (routine on mobile — see useOnResume.ts).
  useOnResume(fetchLatest)

  useEffect(() => {
    genRef.current++
    if (!partyCode || !currentUserId) return
    fetchLatest()

    const ch = supabase
      .channel(`party-badge:${partyCode}:${currentUserId}:${suffix}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "messages",
        filter: `party_code=eq.${partyCode}`,
      }, payload => {
        const m = payload.new as LatestRow
        if (m.recipient_id === null || m.sender_id === currentUserId || m.recipient_id === currentUserId) {
          setLatest(prev => (!prev || m.created_at > prev) ? m.created_at : prev)
        }
      })
      .subscribe()

    // Deliberately reads genRef.current at cleanup time, not a value
    // captured when the effect ran — genRef isn't a DOM/node ref, just a
    // monotonic counter, so there's no stale-node concern here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { genRef.current++; supabase.removeChannel(ch) }
    // fetchLatest is deliberately omitted — it's a plain function redefined
    // every render, not stateful; re-running this effect (and resubscribing
    // the channel) for identity churn alone would be wasteful.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyCode, currentUserId, suffix])

  return latest
}
