// ════════════════════════════════════════════════════════════════════════════
// usePushNotifications.ts — registers this device for chat push
// notifications and keeps its FCM token upserted into push_tokens.
//
// Native Android only (Capacitor.isNativePlatform()) — the web build keeps
// relying on the existing realtime-subscription unread badges (see
// party/unread.ts) instead; there's no service worker / Web Push wired up
// here, on purpose, to keep this pass scoped to the native app. See
// supabase/functions/send-chat-push for the other half: a Database Webhook
// on new `messages` rows reads this table (with the service role) and
// actually sends the push via FCM.
//
// Call once near the app root, after the user is signed in (needs
// supabase.auth session for the upsert's user_id).
// ════════════════════════════════════════════════════════════════════════════

import { useEffect } from "react"
import { Capacitor } from "@capacitor/core"
import { PushNotifications } from "@capacitor/push-notifications"
import { supabase } from "../supabase"

export function usePushNotifications(userId: string | null | undefined) {
  useEffect(() => {
    if (!userId || !Capacitor.isNativePlatform()) return
    let cancelled = false

    async function register() {
      const { receive } = await PushNotifications.checkPermissions()
      const granted = receive === "granted" ? receive : (await PushNotifications.requestPermissions()).receive
      if (granted !== "granted" || cancelled) return
      await PushNotifications.register()
    }

    const regSub = PushNotifications.addListener("registration", token => {
      // Fire-and-forget — a failed upsert here just means this device stays
      // silent for push until the next app launch retries it; nothing in
      // the UI depends on this succeeding synchronously.
      supabase
        .from("push_tokens")
        .upsert(
          { user_id: userId, token: token.value, platform: "android", updated_at: new Date().toISOString() },
          { onConflict: "user_id,token" }
        )
        .then(({ error }) => { if (error) console.error("push token upsert failed:", error) })
    })

    const errSub = PushNotifications.addListener("registrationError", err => {
      console.error("push registration failed:", err)
    })

    register()

    return () => {
      cancelled = true
      regSub.then(s => s.remove())
      errSub.then(s => s.remove())
    }
  }, [userId])
}
