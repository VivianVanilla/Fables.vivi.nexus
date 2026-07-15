// ════════════════════════════════════════════════════════════════════════════
// usePartyServer.ts — data layer for the Party Server: roster/channels
// (backed by the campaign object's `data.channels`) and messages (backed by
// the `messages` table, with realtime INSERT/DELETE sync).
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react"
import { supabase } from "../../../src/supabase"
import { safeParseJson, nanoid } from "../character-utils"
import type { SidebarObject } from "../sidebar-utils"
import { DEFAULT_CHANNEL, useChannelSuffix, type Channel, type Message, type PartyMember, type SharePayload } from "./partyTypes"

// ── Roster (campaign + members + channels) ───────────────────────────────────

export function usePartyRoster(
  partyCode: string,
  opts?: { presetCampaign?: SidebarObject | null; presetMembers?: PartyMember[] }
) {
  const [fetchedCampaign, setFetchedCampaign] = useState<SidebarObject | null>(null)
  const [fetchedMembers, setFetchedMembers] = useState<PartyMember[]>([])

  const needCampaign = !opts?.presetCampaign
  const needMembers = !opts?.presetMembers

  useEffect(() => {
    if (!needCampaign || !partyCode) return
    let cancelled = false
    supabase
      .from("objects")
      .select("*")
      .eq("type", "campaign")
      .filter("data->>partyCode", "eq", partyCode)
      .limit(1)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) { console.error("campaign fetch error:", error); return }
        if (data?.[0]) setFetchedCampaign(data[0] as SidebarObject)
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyCode, needCampaign])

  useEffect(() => {
    if (!needMembers || !partyCode) return
    let cancelled = false
    supabase
      .from("objects")
      .select("*")
      .eq("type", "character")
      .filter("data->>partyCode", "eq", partyCode)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) { console.error("party roster fetch error:", error); return }
        const chars = (data ?? []) as SidebarObject[]
        setFetchedMembers(chars.map(c => ({ userId: c.owner_id, name: c.name, characterId: c.id })))
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyCode, needMembers])

  const campaign = opts?.presetCampaign ?? fetchedCampaign
  const members = opts?.presetMembers ?? fetchedMembers
  const dmUserId = campaign?.owner_id ?? null

  const campaignData = safeParseJson(campaign?.data) as { channels?: Channel[] }
  const channels = campaignData.channels && campaignData.channels.length ? campaignData.channels : [DEFAULT_CHANNEL]

  return { campaign, members, dmUserId, channels }
}

// ── Messages (fetch + realtime + send/delete) ────────────────────────────────

export function usePartyMessages(partyCode: string, currentUserId: string) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loaded, setLoaded] = useState(false)
  const suffix = useChannelSuffix()

  useEffect(() => {
    if (!partyCode || !currentUserId) return
    let cancelled = false
    supabase
      .from("messages")
      .select("*")
      .eq("party_code", partyCode)
      .order("created_at", { ascending: true })
      .limit(500)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) console.error("chat load error:", error)
        if (data) setMessages(data as Message[])
        setLoaded(true)
      })
    return () => { cancelled = true }
  }, [partyCode, currentUserId])

  useEffect(() => {
    if (!partyCode || !currentUserId) return
    const ch = supabase
      .channel(`party-server:${partyCode}:${currentUserId}:${suffix}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "messages",
        filter: `party_code=eq.${partyCode}`,
      }, payload => {
        const msg = payload.new as Message
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
      })
      .on("postgres_changes", {
        event: "DELETE", schema: "public", table: "messages",
        filter: `party_code=eq.${partyCode}`,
      }, payload => {
        const old = payload.old as Partial<Message>
        if (old?.id) setMessages(prev => prev.filter(m => m.id !== old.id))
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [partyCode, currentUserId, suffix])

  async function sendMessage(input: {
    senderName: string
    body?: string | null
    imageUrl?: string | null
    recipientId?: string | null
    channel?: string | null
    type?: "message" | "share"
    payload?: SharePayload | null
  }) {
    if (!currentUserId) return
    if (!input.body && !input.imageUrl && !input.payload) return

    // Show the message the instant you hit send instead of waiting on the
    // insert round-trip — that wait is what made sending feel slow. A
    // temp id (never a real uuid, so it can't collide with the real row)
    // marks it as pending until the insert resolves and swaps it in below.
    const tempId = `pending:${nanoid()}`
    const optimistic: Message = {
      id: tempId,
      created_at: new Date().toISOString(),
      party_code: partyCode,
      channel: input.channel ?? null,
      sender_id: currentUserId,
      sender_name: input.senderName,
      body: input.body ?? null,
      image_url: input.imageUrl ?? null,
      recipient_id: input.recipientId ?? null,
      type: input.type ?? "message",
      payload: input.payload ?? null,
    }
    setMessages(prev => [...prev, optimistic])

    const { data, error } = await supabase.from("messages").insert({
      party_code: partyCode,
      sender_id: currentUserId,
      sender_name: input.senderName,
      body: input.body ?? null,
      image_url: input.imageUrl ?? null,
      recipient_id: input.recipientId ?? null,
      channel: input.channel ?? null,
      type: input.type ?? "message",
      payload: input.payload ?? null,
    }).select().single()
    if (error) {
      console.error("send error:", error)
      setMessages(prev => prev.filter(m => m.id !== tempId))
      return
    }
    // Don't rely solely on the realtime INSERT echo to show our own message —
    // it can lag or (depending on the messages table's realtime RLS policy)
    // never fire back to the sender at all. Swap the optimistic row for the
    // real one now; the realtime handler above already dedupes by id if the
    // echo does arrive afterward.
    const msg = data as Message
    setMessages(prev => {
      const withoutTemp = prev.filter(m => m.id !== tempId)
      return withoutTemp.some(m => m.id === msg.id) ? withoutTemp : [...withoutTemp, msg]
    })
  }

  async function deleteMessage(id: string) {
    const prev = messages
    setMessages(m => m.filter(msg => msg.id !== id))
    const { error } = await supabase.from("messages").delete().eq("id", id)
    if (error) { console.error("delete error:", error); setMessages(prev) }
  }

  return { messages, loaded, sendMessage, deleteMessage }
}
