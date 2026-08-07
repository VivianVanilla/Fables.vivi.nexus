// ════════════════════════════════════════════════════════════════════════════
// monsterCrypto.ts — client-side encryption for monsters marked "Private"
// (see monster.tsx's "Set to Private" toggle in EditStatsModal).
//
// Uses the Web Crypto API (AES-GCM 256) with a key derived deterministically
// from the owner's Supabase user id via PBKDF2 — nothing extra to remember,
// no passphrase prompt, and the derived key itself is never sent to or
// stored on the server, only the ciphertext is. That keeps someone casually
// browsing the raw `objects` table from reading a private monster's data at
// a glance. It is NOT a defense against someone who also has the app's
// source code, since the derivation has no secret beyond the user id
// (already sitting right next to the ciphertext as `owner_id`) and a fixed
// pepper baked into this file — a sufficiently motivated reader with both
// database and source access could reproduce the key. This is a privacy
// speed bump against casual/incidental access, not a guarantee against a
// determined attacker with full backend access.
// ════════════════════════════════════════════════════════════════════════════

const PEPPER = "fables-monster-vault-v1"

async function deriveKey(userId: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const baseKey = await crypto.subtle.importKey(
    "raw", enc.encode(`${userId}:${PEPPER}`), "PBKDF2", false, ["deriveKey"],
  )
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode(PEPPER), iterations: 100_000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )
}

function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let bin = ""
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
}

export interface EncryptedMonsterPayload {
  __encrypted: true
  iv: string
  ciphertext: string
}

export function isEncryptedMonsterPayload(v: unknown): v is EncryptedMonsterPayload {
  return !!v && typeof v === "object" && (v as Record<string, unknown>).__encrypted === true
}

export async function encryptMonsterData(userId: string, data: Record<string, unknown>): Promise<EncryptedMonsterPayload> {
  const key = await deriveKey(userId)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const enc = new TextEncoder()
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(data)))
  return { __encrypted: true, iv: toBase64(iv), ciphertext: toBase64(ciphertext) }
}

export async function decryptMonsterData(userId: string, payload: EncryptedMonsterPayload): Promise<Record<string, unknown>> {
  const key = await deriveKey(userId)
  const iv = fromBase64(payload.iv) as BufferSource
  const ciphertext = fromBase64(payload.ciphertext) as BufferSource
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext)
  return JSON.parse(new TextDecoder().decode(plaintext))
}
