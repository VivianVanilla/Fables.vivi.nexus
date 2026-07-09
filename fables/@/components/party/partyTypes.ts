// ════════════════════════════════════════════════════════════════════════════
// partyTypes.ts — shared shapes for the Party Server (chat, DMs, share cards).
// The `messages` table itself has no generated type (see userInfo.ts) — this
// mirrors the same ad-hoc-interface convention the old PartyChat.tsx used.
// ════════════════════════════════════════════════════════════════════════════

import { useRef } from "react"

// Supabase's RealtimeClient.channel(topic) dedupes by topic string — a
// second call with the same topic returns the SAME already-subscribed
// channel object instead of a fresh one, and .on() throws on an
// already-joined channel. That collision is real whenever the same party
// hook mounts twice for the same party+user at once (e.g. a DM viewing a
// party member's character sheet mounts a badge hook both from CampaignView
// itself and from the nested CharacterSheet). A random per-mount suffix
// keeps every hook instance's topic unique so they never collide.
export function useChannelSuffix() {
  const ref = useRef<string | null>(null)
  if (!ref.current) ref.current = Math.random().toString(36).slice(2, 8)
  return ref.current
}

export interface PartyMember {
  userId: string
  name: string
  characterId?: string
}

export interface Channel {
  id: string
  name: string
}

export const DEFAULT_CHANNEL: Channel = { id: "general", name: "general" }

export type ShareKind = "feature" | "spell" | "familiar"

export type FeatureBucket = "racialTraits" | "feats" | "classFeatures" | "items" | "invocations"

export interface SharePayload {
  kind: ShareKind
  bucket?: FeatureBucket   // only for kind === "feature" — which array to append into
  item: Record<string, unknown>
}

export interface Message {
  id: string
  created_at: string
  party_code: string
  channel: string | null       // set for public channel messages, null for DMs
  sender_id: string
  sender_name: string | null
  body: string | null
  image_url: string | null
  recipient_id: string | null  // set for DMs, null for public channel messages
  type: "message" | "share"
  payload: SharePayload | null
}

// dataTransfer type used to drag a personal note from the sidebar onto the
// Party Notes canvas — see app-sidebar.tsx (source) and PartyNotesCanvas.tsx (target).
export const NOTE_DRAG_TYPE = "x-fable-note"

export function dmThreadKey(otherUserId: string) {
  return `dm:${otherUserId}`
}

export function channelThreadKey(channelId: string) {
  return `channel:${channelId}`
}
