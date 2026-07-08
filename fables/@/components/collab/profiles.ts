// ════════════════════════════════════════════════════════════════════════════
// profiles.ts — username directory (public.profiles table)
//
// Replaces the old "party members sharing a code" approach for finding people
// to invite — that only worked if both sides had already linked matching
// characters, which was fragile. Usernames are a flat, direct lookup instead.
//
// Requires a `profiles` table + RLS in Supabase — see the SQL block shared
// alongside this change. Every function here degrades to a harmless no-op
// (empty results / logged error) if that table doesn't exist yet.
// ════════════════════════════════════════════════════════════════════════════

import { supabase } from "../../../src/supabase"

export interface Profile {
  id: string
  username: string
}

function slugifyUsername(base: string): string {
  return base.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20) || "player"
}

// Called once per session (see UserContext.tsx) so every logged-in user has a
// username without needing to visit Profile Settings first.
export async function ensureProfile(userId: string, email?: string | null): Promise<Profile | null> {
  const { data: existing, error: readErr } = await supabase
    .from("profiles").select("id, username").eq("id", userId).maybeSingle()
  if (readErr) { console.error("profiles: read failed (table missing?)", readErr); return null }
  if (existing) return existing as Profile

  const base = slugifyUsername(email?.split("@")[0] ?? "player")
  let username = base
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await supabase.from("profiles").insert({ id: userId, username })
    if (!error) return { id: userId, username }
    username = `${base}${Math.floor(Math.random() * 10000)}`
  }
  return null
}

export async function searchUsernames(query: string, excludeUserId?: string): Promise<Profile[]> {
  if (!query.trim()) return []
  const { data, error } = await supabase
    .from("profiles").select("id, username")
    .ilike("username", `%${query.trim()}%`)
    .limit(8)
  if (error) { console.error(error); return [] }
  return ((data ?? []) as Profile[]).filter(p => p.id !== excludeUserId)
}

export async function updateUsername(userId: string, username: string): Promise<{ error?: string }> {
  const clean = slugifyUsername(username)
  if (!clean) return { error: "Enter a valid username (letters, numbers, underscores)." }
  const { error } = await supabase.from("profiles").upsert({ id: userId, username: clean })
  if (error) return { error: error.message.includes("duplicate") ? "That username is taken." : error.message }
  return {}
}

export async function getUsernames(userIds: string[]): Promise<Record<string, string>> {
  if (userIds.length === 0) return {}
  const { data, error } = await supabase.from("profiles").select("id, username").in("id", userIds)
  if (error) { console.error(error); return {} }
  const map: Record<string, string> = {}
  for (const row of (data ?? []) as Profile[]) map[row.id] = row.username
  return map
}
