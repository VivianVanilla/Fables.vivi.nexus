// ════════════════════════════════════════════════════════════════════════════
// send-chat-push — Supabase Edge Function. The whole server side of chat
// push notifications lives here; nothing else needs deploying anywhere.
//
// Wiring (see supabase/PUSH_NOTIFICATIONS.md for the full walkthrough):
//   Postgres: a Database Webhook on `messages` INSERT (Dashboard → Database
//   → Webhooks) POSTs the new row here as { type, table, record, ... }.
//   This function then:
//     1. Works out who should be notified (the DM recipient, or every other
//        party member for a channel message — party membership is read the
//        same way usePartyServer.ts does, via `objects` where
//        type='character' and data->>partyCode matches).
//     2. Looks up their registered devices in push_tokens (see
//        src/hooks/usePushNotifications.ts, which writes to it).
//     3. Sends one push per device via FCM's HTTP v1 API.
//
// Firebase only supplies the actual delivery pipe (that's just how Android
// background push physically works — see the app's chat notification
// design notes); everything about WHEN and WHO to notify is decided here,
// in Supabase, not in any Firebase-side function.
//
// Required secrets (`supabase secrets set NAME=value`):
//   FCM_SERVICE_ACCOUNT_JSON — the full Firebase service-account JSON key
//                              (Firebase Console → Project settings →
//                              Service accounts → Generate new private key),
//                              as one single-line JSON string.
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically into
// every Edge Function by Supabase — nothing to set for those.
// ════════════════════════════════════════════════════════════════════════════

import { createClient } from "npm:@supabase/supabase-js@2"

interface MessageRow {
  id: string
  party_code: string
  channel: string | null
  sender_id: string
  sender_name: string | null
  body: string | null
  recipient_id: string | null
  type: "message" | "share"
}

interface WebhookPayload {
  type: "INSERT"
  table: string
  record: MessageRow
}

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

// ── Google OAuth2 (service-account JWT-bearer flow) ─────────────────────────
// Deno's Web Crypto covers RS256 signing directly — no google-auth-library
// dependency needed for just this one exchange.

interface ServiceAccount { client_email: string; private_key: string; project_id: string }

let cachedToken: { value: string; expiresAt: number } | null = null

function base64url(bytes: Uint8Array | string): string {
  const bin = typeof bytes === "string" ? bytes : String.fromCharCode(...bytes)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

async function importSigningKey(pem: string): Promise<CryptoKey> {
  const stripped = pem.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s+/g, "")
  const der = Uint8Array.from(atob(stripped), c => c.charCodeAt(0))
  return crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"])
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (cachedToken && cachedToken.expiresAt > now + 60) return cachedToken.value

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const claim = base64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }))
  const signingInput = `${header}.${claim}`
  const key = await importSigningKey(sa.private_key)
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput)))
  const jwt = `${signingInput}.${base64url(signature)}`

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  })
  if (!res.ok) throw new Error(`OAuth2 token exchange failed: ${res.status} ${await res.text()}`)
  const json = await res.json() as { access_token: string; expires_in: number }
  cachedToken = { value: json.access_token, expiresAt: now + json.expires_in }
  return json.access_token
}

// ── Recipients ────────────────────────────────────────────────────────────

async function recipientUserIds(msg: MessageRow): Promise<string[]> {
  if (msg.recipient_id) return [msg.recipient_id]

  // Channel message — every other party member, same membership source
  // usePartyServer.ts's roster reads from (type='character' rows tagged
  // with this partyCode; owner_id is the member's user id).
  const { data, error } = await supabaseAdmin
    .from("objects")
    .select("owner_id")
    .eq("type", "character")
    .filter("data->>partyCode", "eq", msg.party_code)
  if (error) { console.error("roster lookup failed:", error); return [] }

  const ids = new Set((data ?? []).map(r => r.owner_id as string))
  ids.delete(msg.sender_id)
  return [...ids]
}

// ── Handler ───────────────────────────────────────────────────────────────

Deno.serve(async req => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 })

  const payload = await req.json() as WebhookPayload
  if (payload.table !== "messages" || payload.type !== "INSERT") {
    return new Response("ignored", { status: 200 })
  }
  const msg = payload.record

  const saJson = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON")
  if (!saJson) {
    console.error("FCM_SERVICE_ACCOUNT_JSON secret not set — see supabase/PUSH_NOTIFICATIONS.md")
    return new Response("not configured", { status: 200 })
  }
  const sa = JSON.parse(saJson) as ServiceAccount

  const userIds = await recipientUserIds(msg)
  if (userIds.length === 0) return new Response("no recipients", { status: 200 })

  const { data: tokens, error: tokenErr } = await supabaseAdmin
    .from("push_tokens")
    .select("token, user_id")
    .in("user_id", userIds)
  if (tokenErr) { console.error("token lookup failed:", tokenErr); return new Response("error", { status: 500 }) }
  if (!tokens || tokens.length === 0) return new Response("no devices", { status: 200 })

  const accessToken = await getAccessToken(sa)
  const title = msg.channel ? `#${msg.channel}` : (msg.sender_name ?? "New message")
  const body = msg.type === "share" ? `${msg.sender_name ?? "Someone"} shared something` : (msg.body ?? "New message")

  const staleTokens: string[] = []

  await Promise.all(tokens.map(async row => {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          token: row.token,
          notification: { title, body },
          data: { partyCode: msg.party_code, channel: msg.channel ?? "", senderId: msg.sender_id },
          android: { priority: "high" },
        },
      }),
    })
    if (!res.ok) {
      const errText = await res.text()
      // UNREGISTERED / invalid-argument on a token means the device
      // uninstalled the app or the token rotated — worth pruning so future
      // sends don't keep paying for a dead lookup.
      if (res.status === 404 || errText.includes("UNREGISTERED")) staleTokens.push(row.token)
      else console.error(`FCM send failed for token ${row.token}:`, res.status, errText)
    }
  }))

  if (staleTokens.length > 0) {
    await supabaseAdmin.from("push_tokens").delete().in("token", staleTokens)
  }

  return new Response("ok", { status: 200 })
})
