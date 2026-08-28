// ════════════════════════════════════════════════════════════════════════════
// useOnResume.ts — re-runs a fetch whenever the app/tab comes back into
// view: native Android foreground (Capacitor App 'resume'), a backgrounded
// browser tab regaining focus (visibilitychange), and the network coming
// back after a drop (online).
//
// Every realtime hook in the app (party chat, NPC trackers, the map board,
// campaign view) subscribes once on mount and otherwise trusts
// postgres_changes events to keep it current. Supabase's realtime socket
// does auto-reconnect its own transport, but nothing guarantees it replays
// rows that changed while the socket was actually down — mobile makes this
// far more common than it was on web-only (Android suspends the WebView's
// connections whenever the app is backgrounded, which is routine, not an
// edge case). Re-running the same initial fetch each hook already has is
// the cheap, safe fix: worst case it's a redundant no-op refetch.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef } from "react"
import { Capacitor } from "@capacitor/core"
import { App as CapacitorApp } from "@capacitor/app"

export function useOnResume(callback: () => void) {
  // Ref indirection so callers can pass an inline closure without this
  // effect needing to re-subscribe (and briefly drop) its listeners every
  // time that closure's identity changes across a render. Written from its
  // own effect (not directly during render) — a plain, dependency-less
  // effect still runs after every render, same effect, but ref writes
  // during render itself are never allowed.
  const cbRef = useRef(callback)
  useEffect(() => { cbRef.current = callback })

  useEffect(() => {
    function fire() { cbRef.current() }
    function onVisibility() { if (document.visibilityState === "visible") fire() }

    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("online", fire)

    let sub: { remove: () => void } | undefined
    let cancelled = false
    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener("resume", fire).then(s => { if (!cancelled) sub = s; else s.remove() })
    }

    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("online", fire)
      sub?.remove()
    }
  }, [])
}
