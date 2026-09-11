// ════════════════════════════════════════════════════════════════════════════
// PartyServer.tsx — the "mini Discord" shell: a left rail (channels /
// private-message member list) plus a main pane that swaps between channel
// and DM ChatPanes. Replaces the old PartyChat.tsx and the per-note sharing
// system entirely — rendered from both the player's character-sheet Chat tab
// and the DM's campaign view Party Chat tab. (The old Party Notes canvas that
// used to live here was retired in favor of the Hjolland map — see
// @/components/map/MapOverlay.tsx, opened below via a rail button rather
// than the F4 hotkey that turned out unreliable across browsers.)
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react"
import { Hash, Plus, X, Menu, Mountain, BookOpen, NotebookPen, Eye, EyeOff } from "lucide-react"
import { useUserContext } from "../../../src/contexts/UserContext"
import { supabase } from "../../../src/supabase"
import { safeParseJson, nanoid } from "@/components/shared/utils"
import { MAP_PARTY_CODES } from "@/components/shared/constants"
import type { SidebarObject } from "@/components/shell/sidebar-utils"
import { usePartyRoster, usePartyMessages } from "./usePartyServer"
import { usePartyVitals } from "./usePartyVitals"
import { useOnResume } from "@/components/shared/useOnResume"
import { ChatPane } from "./ChatPane"
import { MapOverlay } from "../map/MapOverlay"
import { NpcTrackerOverlay } from "../npcTracker/NpcTrackerOverlay"
import { MysteriousPagesOverlay } from "../mysteriousPages/MysteriousPagesOverlay"
import { markThreadSeen, isThreadUnread } from "./unread"
import { channelThreadKey, dmThreadKey, DEFAULT_CHANNEL, useChannelSuffix, type Channel, type PartyMember } from "./partyTypes"

type ActiveView =
  | { type: "channel"; id: string }
  | { type: "dm"; userId: string; name: string }

const hpColor = (pct: number) => (pct > 50 ? "#22c55e" : pct > 25 ? "#eab308" : "#ef4444")

export function PartyServer({
  partyCode, currentUserId, currentUserName, isDM,
  campaign = null, partyMembers, accentColor,
}: {
  partyCode: string
  currentUserId: string
  currentUserName: string
  isDM: boolean
  campaign?: SidebarObject | null
  partyMembers?: PartyMember[]
  // The hosting character sheet's theme accent (hex) — tints the rail
  // header when Party Chat is opened from a player's sheet. Unset when the
  // DM opens it from the campaign view (no single character's theme to use).
  accentColor?: string
}) {
  const { updateObject } = useUserContext()
  // `activeCampaign` resolves to the prop when the DM opens this from the
  // campaign view, or to the row usePartyRoster fetches when a player opens
  // it from their sheet (the prop is undefined there). Everything below reads
  // `activeCampaign`, not the raw `campaign` prop — using the prop directly
  // is why discreet mode did nothing on the player side.
  const { channels, members, dmUserId, campaign: activeCampaign } =
    usePartyRoster(partyCode, { presetCampaign: campaign, presetMembers: partyMembers })
  const { messages, sendMessage, deleteMessage, editMessage } = usePartyMessages(partyCode, currentUserId)
  const vitals = usePartyVitals(partyCode)
  const suffix = useChannelSuffix()

  // "Discreet" characters (map campaign, DM-controlled). Stored on the
  // campaign object; the DM's copy updates through context immediately,
  // other players get it via this realtime sub since usePartyRoster fetches
  // the campaign row only once and nothing else subscribes to it.
  const campaignDiscreet = ((safeParseJson(activeCampaign?.data) as { discreetCharacterIds?: string[] })?.discreetCharacterIds) ?? []
  const [liveDiscreet, setLiveDiscreet] = useState<string[] | null>(null)
  const discreetIds = isDM ? campaignDiscreet : (liveDiscreet ?? campaignDiscreet)

  useEffect(() => {
    const campaignId = activeCampaign?.id
    if (!campaignId) return
    const ch = supabase
      .channel(`party-campaign:${campaignId}:${suffix}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "objects", filter: `id=eq.${campaignId}` },
        payload => {
          const d = safeParseJson((payload.new as { data: unknown }).data) as { discreetCharacterIds?: string[] }
          setLiveDiscreet(d.discreetCharacterIds ?? [])
        })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [activeCampaign?.id, suffix])

  // Safety net for the realtime sub above (campaign-row events to a
  // non-owner player can be dropped while the socket was down) — re-pull the
  // discreet list whenever the tab/app comes back into view.
  useOnResume(() => {
    const campaignId = activeCampaign?.id
    if (!campaignId || isDM) return
    supabase.from("objects").select("data").eq("id", campaignId).maybeSingle().then(({ data: row }) => {
      if (!row) return
      const d = safeParseJson((row as { data: unknown }).data) as { discreetCharacterIds?: string[] }
      setLiveDiscreet(d.discreetCharacterIds ?? [])
    })
  })

  const myCharacterId = members.find(m => m.userId === currentUserId)?.characterId
  const iAmDiscreet = !!myCharacterId && discreetIds.includes(myCharacterId)
  const showDiscreetToggle = isDM && MAP_PARTY_CODES.includes(partyCode)

  function toggleDiscreet(characterId: string) {
    if (!activeCampaign) return
    const cd = safeParseJson(activeCampaign.data) as Record<string, unknown>
    const cur = (cd.discreetCharacterIds as string[] | undefined) ?? []
    const next = cur.includes(characterId) ? cur.filter(id => id !== characterId) : [...cur, characterId]
    updateObject(activeCampaign.id, { data: { ...cd, discreetCharacterIds: next } as unknown as JSON }).catch(e => console.error(e))
  }

  const [activeView, setActiveView] = useState<ActiveView>({ type: "channel", id: DEFAULT_CHANNEL.id })
  const [addingChannel, setAddingChannel] = useState(false)
  const [newChannelName, setNewChannelName] = useState("")
  // Below `md`, the rail is a slide-over drawer instead of a permanent
  // sidebar — there isn't room for both it and the chat at once on a phone.
  const [railOpen, setRailOpen] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [npcTrackerOpen, setNpcTrackerOpen] = useState(false)
  const [pagesOpen, setPagesOpen] = useState(false)

  // Everyone in the party can DM everyone else — the rest of the player
  // roster (from `members`, minus yourself) plus the DM, unless you *are*
  // the DM (in which case `dmUserId === currentUserId` and it's skipped) or
  // the DM is already one of the party's own characters. A Discreet player
  // can only reach the DM, and is hidden from everyone else's DM list.
  const dmEntry = dmUserId && dmUserId !== currentUserId && !members.some(m => m.userId === dmUserId)
    ? [{ userId: dmUserId, name: "Dungeon Master" }]
    : []
  const dmTargets: PartyMember[] = iAmDiscreet
    ? (dmUserId && dmUserId !== currentUserId ? [{ userId: dmUserId, name: "Dungeon Master" }] : [])
    : [
        ...members.filter(m => m.userId !== currentUserId && (isDM || !discreetIds.includes(m.characterId ?? ""))),
        ...dmEntry,
      ]

  // A Discreet player is hidden from the other players entirely — not just
  // their HP and their name in the roster, but their messages too, so the
  // party can't tell they're around. The DM sees everything; the discreet
  // player still sees their own messages.
  const discreetUserIds = new Set(
    members.filter(m => m.characterId && discreetIds.includes(m.characterId)).map(m => m.userId),
  )
  const hideDiscreet = !isDM && discreetUserIds.size > 0
  const isHiddenSender = (senderId: string) =>
    hideDiscreet && senderId !== currentUserId && discreetUserIds.has(senderId)

  function selectChannel(id: string) {
    setActiveView({ type: "channel", id })
    setRailOpen(false)
  }
  function selectDm(m: PartyMember) {
    setActiveView({ type: "dm", userId: m.userId, name: m.name })
    setRailOpen(false)
  }

  // Whichever thread is currently focused counts as "seen" — re-marked every
  // time the view switches AND every time new messages land while it's still
  // the active thread, so the red dot only ever shows for messages you
  // genuinely haven't looked at yet.
  useEffect(() => {
    if (activeView.type === "channel") markThreadSeen(currentUserId, partyCode, channelThreadKey(activeView.id))
    else if (activeView.type === "dm") markThreadSeen(currentUserId, partyCode, dmThreadKey(activeView.userId))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, messages, currentUserId, partyCode])

  function channelMessages(id: string) {
    return messages.filter(m => m.recipient_id === null && (m.channel ?? DEFAULT_CHANNEL.id) === id
      && !isHiddenSender(m.sender_id))
  }
  function dmMessages(otherId: string) {
    return messages.filter(m => m.recipient_id !== null && !isHiddenSender(m.sender_id) && (
      (m.sender_id === currentUserId && m.recipient_id === otherId) ||
      (m.sender_id === otherId && m.recipient_id === currentUserId)
    ))
  }
  function latestOf(list: { created_at: string }[]) {
    return list.length ? list[list.length - 1].created_at : null
  }

  function writeChannels(next: Channel[]) {
    if (!activeCampaign) return
    const data = safeParseJson(activeCampaign.data) as Record<string, unknown>
    updateObject(activeCampaign.id, { data: { ...data, channels: next } as unknown as JSON }).catch(e => console.error(e))
  }

  function submitNewChannel() {
    const label = newChannelName.trim()
    if (!label) { setAddingChannel(false); return }
    const id = label.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || nanoid()
    if (!channels.some(c => c.id === id)) writeChannels([...channels, { id, name: label }])
    setNewChannelName("")
    setAddingChannel(false)
  }

  function removeChannel(id: string) {
    if (id === DEFAULT_CHANNEL.id) return
    writeChannels(channels.filter(c => c.id !== id))
    if (activeView.type === "channel" && activeView.id === id) selectChannel(DEFAULT_CHANNEL.id)
  }

  const hamburger = (
    <button type="button" onClick={() => setRailOpen(true)} title="Menu"
      className="md:hidden size-7 -ml-1 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors shrink-0">
      <Menu className="size-4" />
    </button>
  )

  return (
    <div className="flex flex-1 min-h-0 min-w-0 relative overflow-hidden">
      {/* Mobile backdrop — tap outside the drawer to close it */}
      {railOpen && (
        <div className="fixed inset-0 z-20 bg-black/30 md:hidden" onClick={() => setRailOpen(false)} />
      )}

      {/* Left rail — a permanent sidebar on md+, a slide-over drawer below that */}
      <div className={`
        w-44 shrink-0 border-r border-border flex flex-col bg-card overflow-hidden
        fixed md:relative inset-y-0 left-0 z-30 md:z-auto
        transition-transform duration-200 md:transition-none
        ${railOpen ? "shadow-2xl md:shadow-none" : ""}
        ${railOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        <div className="px-3 pt-3 pb-1.5 flex items-center justify-between shrink-0 " style={accentColor ? { color: accentColor } : undefined}>
          <span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground/50">Party Chat</span>
          {isDM && (
            <button type="button" onClick={() => setAddingChannel(v => !v)} title="Add channel"
              className="text-muted-foreground/50 hover:text-foreground transition-colors">
              <Plus className="size-3.5" />
            </button>
          )}
        </div>
        {addingChannel && (
          <div className="px-2 pb-1.5 flex items-center gap-1 shrink-0">
            <input
              autoFocus value={newChannelName} onChange={e => setNewChannelName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") submitNewChannel(); if (e.key === "Escape") setAddingChannel(false) }}
              placeholder="channel-name"
              className="flex-1 min-w-0 text-[11px] rounded-md bg-foreground/10 px-1.5 py-1 outline-none placeholder:text-muted-foreground/40"
            />
            <button type="button" onClick={submitNewChannel} className="text-muted-foreground hover:text-foreground text-xs">✓</button>
          </div>
        )}

        {/* Channel list — self-scrolling so a long list doesn't push Party Notes / DMs out of view */}
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-0.5 px-2 pb-2">
          {channels.map(ch => {
            const unread = isThreadUnread(currentUserId, partyCode, channelThreadKey(ch.id), latestOf(channelMessages(ch.id)))
            const active = activeView.type === "channel" && activeView.id === ch.id
            return (
              <div key={ch.id} className="group flex items-center gap-1 shrink-0">
                <button type="button" onClick={() => selectChannel(ch.id)}
                  className={`flex-1 min-w-0 flex items-center gap-1 text-[12px] px-2 py-1 rounded-md transition-colors ${active ? "bg-foreground/15 text-foreground font-semibold" : "text-foreground/60 hover:bg-foreground/8 hover:text-foreground"}`}>
                  <Hash className="size-3 shrink-0 opacity-50" />
                  <span className="truncate">{ch.name}</span>
                  {unread && !active && <span className="size-1.5 rounded-full bg-red-500 shrink-0 ml-auto" />}
                </button>
                {isDM && ch.id !== DEFAULT_CHANNEL.id && (
                  <button type="button" onClick={() => removeChannel(ch.id)} title="Delete channel"
                    className="hidden group-hover:block text-muted-foreground/40 hover:text-red-400 transition-colors shrink-0">
                    <X className="size-3" />
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <div className="px-3 pt-1 pb-1.5 shrink-0 border-t border-border flex flex-col gap-0.5">
          <button type="button" onClick={() => setNpcTrackerOpen(true)}
            className="w-full flex items-center gap-1.5 text-[12px] px-2 py-1.5 rounded-md transition-colors mt-1.5 text-foreground/60 hover:bg-foreground/8 hover:text-foreground">
            <BookOpen className="size-3.5 shrink-0 opacity-70" />
            NPC Tracker
          </button>
        </div>

        {MAP_PARTY_CODES.includes(partyCode) && (
          <div className="px-3 pt-1 pb-1.5 shrink-0 border-t border-border flex flex-col gap-0.5">
            <button type="button" onClick={() => setMapOpen(true)}
              className="w-full flex items-center gap-1.5 text-[12px] px-2 py-1.5 rounded-md transition-colors mt-1.5 text-foreground/60 hover:bg-foreground/8 hover:text-foreground">
              <Mountain className="size-3.5 shrink-0 opacity-70" />
              Mountain Range Map
            </button>
            <button type="button" onClick={() => setPagesOpen(true)}
              className="w-full flex items-center gap-1.5 text-[12px] px-2 py-1.5 rounded-md transition-colors text-foreground/60 hover:bg-foreground/8 hover:text-foreground">
              <NotebookPen className="size-3.5 shrink-0 opacity-70" />
              Mysterious Pages
            </button>
          </div>
        )}

        {/* Private Messages doubles as the party roster — each member row
            carries their live HP bar (see usePartyVitals) so we're not
            listing the same names twice. */}
        <div className="px-3 pt-2 pb-1.5 border-t border-border shrink-0">
          <span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground/50">Party · Private Messages</span>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-0.5 px-2 pb-3">
          {dmTargets.length === 0 && (
            <p className="text-[10px] text-muted-foreground/40 italic px-2 py-1">No one to message yet.</p>
          )}
          {dmTargets.map(m => {
            const unread = isThreadUnread(currentUserId, partyCode, dmThreadKey(m.userId), latestOf(dmMessages(m.userId)))
            const active = activeView.type === "dm" && activeView.userId === m.userId
            const v = m.characterId ? vitals.find(x => x.characterId === m.characterId) : undefined
            const discreet = !!m.characterId && discreetIds.includes(m.characterId)
            const pct = v && v.maxHp > 0 ? Math.min(100, (v.hp / v.maxHp) * 100) : 0
            const tempPct = v && v.maxHp > 0 ? Math.min(100, (v.tempHp / v.maxHp) * 100) : 0
            return (
              <div key={m.userId}
                className={`flex items-center gap-1 rounded-md shrink-0 transition-colors ${discreet ? "opacity-50" : ""} ${active ? "bg-foreground/15" : "hover:bg-foreground/8"}`}>
                <button type="button" onClick={() => selectDm(m)}
                  className="flex-1 min-w-0 flex flex-col gap-0.5 px-2 py-1 text-left">
                  <span className="flex items-center gap-1.5">
                    <span className={`truncate flex-1 min-w-0 text-[12px] ${active ? "text-foreground font-semibold" : "text-foreground/60"}`}>{m.name}</span>
                    {discreet && <span className="text-[8px] uppercase tracking-wide text-amber-400/80 shrink-0">discreet</span>}
                    {v && (
                      <span className="text-[10px] tabular-nums text-muted-foreground shrink-0">
                        {v.hp}/{v.maxHp}{v.tempHp > 0 && <span className="text-cyan-400"> +{v.tempHp}</span>}
                      </span>
                    )}
                    {unread && !active && <span className="size-1.5 rounded-full bg-red-500 shrink-0" />}
                  </span>
                  {v && (
                    <span className="h-1 rounded-full bg-foreground/10 overflow-hidden relative block">
                      <span className="absolute inset-y-0 left-0 rounded-full block" style={{ width: `${pct}%`, backgroundColor: hpColor(pct) }} />
                      {tempPct > 0 && (
                        <span className="absolute inset-y-0 rounded-full bg-cyan-400/70 block" style={{ left: `${pct}%`, width: `${tempPct}%` }} />
                      )}
                    </span>
                  )}
                </button>
                {showDiscreetToggle && m.characterId && (
                  <button type="button" onClick={() => toggleDiscreet(m.characterId!)}
                    title={discreet ? "Set Active — visible to the party" : "Set Discreet — hidden from the party"}
                    className="size-6 mr-1 flex items-center justify-center rounded text-muted-foreground/40 hover:text-foreground shrink-0 transition-colors">
                    {discreet ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Main pane */}
      {activeView.type === "channel" && (
        <ChatPane
          messages={channelMessages(activeView.id)}
          currentUserId={currentUserId}
          partyCode={partyCode}
          canDelete={m => m.sender_id === currentUserId || isDM}
          onDelete={deleteMessage}
          onEdit={editMessage}
          onSend={input => sendMessage({ ...input, senderName: currentUserName, channel: activeView.id, recipientId: null, type: input.payload ? "share" : "message" })}
          placeholder={`Message #${channels.find(c => c.id === activeView.id)?.name ?? activeView.id}…`}
          emptyText="No messages yet — say hello to your party!"
          headerLabel={`# ${channels.find(c => c.id === activeView.id)?.name ?? activeView.id}`}
          leftAccessory={hamburger}
          disabledNotice={iAmDiscreet ? "The DM has set you to Discreet — you can't post in party channels right now." : undefined}
        />
      )}
      {activeView.type === "dm" && (
        <ChatPane
          messages={dmMessages(activeView.userId)}
          currentUserId={currentUserId}
          partyCode={partyCode}
          canDelete={m => m.sender_id === currentUserId || isDM}
          onDelete={deleteMessage}
          onEdit={editMessage}
          onSend={input => sendMessage({ ...input, senderName: currentUserName, channel: null, recipientId: activeView.userId, type: input.payload ? "share" : "message" })}
          placeholder={`Message ${activeView.name} privately…`}
          emptyText={`No private messages with ${activeView.name} yet.`}
          leftAccessory={hamburger}
          headerLabel={activeView.name}
        />
      )}

      {mapOpen && (
        <MapOverlay
          partyCode={partyCode}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          onClose={() => setMapOpen(false)}
        />
      )}

      {npcTrackerOpen && (
        <NpcTrackerOverlay
          partyCode={partyCode}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          onClose={() => setNpcTrackerOpen(false)}
        />
      )}

      {pagesOpen && (
        <MysteriousPagesOverlay
          partyCode={partyCode}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          onClose={() => setPagesOpen(false)}
        />
      )}
    </div>
  )
}
