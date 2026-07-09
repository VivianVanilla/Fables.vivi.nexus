// ════════════════════════════════════════════════════════════════════════════
// PartyServer.tsx — the "mini Discord" shell: a left rail (channels / Party
// Notes / private-message member list) plus a main pane that swaps between
// ChatPane and the PartyNotesCanvas. Replaces the old PartyChat.tsx and the
// per-note sharing system entirely — rendered from both the player's
// character-sheet Chat tab and the DM's campaign view Party Chat tab.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react"
import { Hash, Plus, X, Waypoints, Menu } from "lucide-react"
import { useUserContext } from "../../../src/contexts/UserContext"
import { safeParseJson, nanoid } from "../character-utils"
import type { SidebarObject } from "../sidebar-utils"
import { usePartyRoster, usePartyMessages } from "./usePartyServer"
import { ChatPane } from "./ChatPane"
import { PartyNotesCanvas } from "./PartyNotesCanvas"
import { markThreadSeen, isThreadUnread } from "./unread"
import { channelThreadKey, dmThreadKey, DEFAULT_CHANNEL, type Channel, type PartyMember } from "./partyTypes"

type ActiveView =
  | { type: "channel"; id: string }
  | { type: "dm"; userId: string; name: string }
  | { type: "canvas" }

export function PartyServer({
  partyCode, currentUserId, currentUserName, isDM,
  campaign = null, partyMembers,
}: {
  partyCode: string
  currentUserId: string
  currentUserName: string
  isDM: boolean
  campaign?: SidebarObject | null
  partyMembers?: PartyMember[]
}) {
  const { updateObject } = useUserContext()
  const { channels, members, dmUserId } = usePartyRoster(partyCode, { presetCampaign: campaign, presetMembers: partyMembers })
  const { messages, sendMessage, deleteMessage } = usePartyMessages(partyCode, currentUserId)

  const [activeView, setActiveView] = useState<ActiveView>({ type: "channel", id: DEFAULT_CHANNEL.id })
  const [addingChannel, setAddingChannel] = useState(false)
  const [newChannelName, setNewChannelName] = useState("")
  // Below `md`, the rail is a slide-over drawer instead of a permanent
  // sidebar — there isn't room for both it and the chat at once on a phone.
  const [railOpen, setRailOpen] = useState(false)

  // Player view: the roster is just the DM (players don't see each other's
  // characters as DM targets unless they're also in `members`). DM view: the
  // full player roster, already passed in from campaign-view.tsx.
  const dmTargets: PartyMember[] = isDM
    ? members.filter(m => m.userId !== currentUserId)
    : dmUserId && dmUserId !== currentUserId ? [{ userId: dmUserId, name: "Dungeon Master" }] : []

  function selectChannel(id: string) {
    setActiveView({ type: "channel", id })
    setRailOpen(false)
  }
  function selectDm(m: PartyMember) {
    setActiveView({ type: "dm", userId: m.userId, name: m.name })
    setRailOpen(false)
  }
  function selectCanvas() {
    setActiveView({ type: "canvas" })
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
    return messages.filter(m => m.recipient_id === null && (m.channel ?? DEFAULT_CHANNEL.id) === id)
  }
  function dmMessages(otherId: string) {
    return messages.filter(m => m.recipient_id !== null && (
      (m.sender_id === currentUserId && m.recipient_id === otherId) ||
      (m.sender_id === otherId && m.recipient_id === currentUserId)
    ))
  }
  function latestOf(list: { created_at: string }[]) {
    return list.length ? list[list.length - 1].created_at : null
  }

  function writeChannels(next: Channel[]) {
    if (!campaign) return
    const data = safeParseJson(campaign.data) as Record<string, unknown>
    updateObject(campaign.id, { data: { ...data, channels: next } as unknown as JSON }).catch(e => console.error(e))
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
    <div className="flex flex-1 min-h-0 relative">
      {/* Mobile backdrop — tap outside the drawer to close it */}
      {railOpen && (
        <div className="fixed inset-0 z-20 bg-black/30 md:hidden" onClick={() => setRailOpen(false)} />
      )}

      {/* Left rail — a permanent sidebar on md+, a slide-over drawer below that */}
      <div className={`
        w-44 shrink-0 border-r border-border flex flex-col bg-muted/30 overflow-hidden
        fixed md:relative inset-y-0 left-0 z-30 md:z-auto
        transition-transform duration-200 md:transition-none
        ${railOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        <div className="px-3 pt-3 pb-1.5 flex items-center justify-between shrink-0">
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
          <button type="button" onClick={selectCanvas}
            className={`w-full flex items-center gap-1.5 text-[12px] px-2 py-1.5 rounded-md transition-colors mt-1.5 ${activeView.type === "canvas" ? "bg-foreground/15 text-foreground font-semibold" : "text-foreground/60 hover:bg-foreground/8 hover:text-foreground"}`}>
            <Waypoints className="size-3.5 shrink-0 opacity-70" />
            Party Notes
          </button>
        </div>

        <div className="px-3 pt-2 pb-1.5 border-t border-border shrink-0">
          <span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground/50">Private Messages</span>
        </div>
        {/* DM list — also self-scrolling, independent of the channel list above */}
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-0.5 px-2 pb-3">
          {dmTargets.length === 0 && (
            <p className="text-[10px] text-muted-foreground/40 italic px-2 py-1">No one to message yet.</p>
          )}
          {dmTargets.map(m => {
            const unread = isThreadUnread(currentUserId, partyCode, dmThreadKey(m.userId), latestOf(dmMessages(m.userId)))
            const active = activeView.type === "dm" && activeView.userId === m.userId
            return (
              <button key={m.userId} type="button" onClick={() => selectDm(m)}
                className={`flex items-center gap-1.5 text-[12px] px-2 py-1 rounded-md transition-colors shrink-0 ${active ? "bg-foreground/15 text-foreground font-semibold" : "text-foreground/60 hover:bg-foreground/8 hover:text-foreground"}`}>
                <span className="truncate flex-1 min-w-0 text-left">{m.name}</span>
                {unread && !active && <span className="size-1.5 rounded-full bg-red-500 shrink-0" />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Main pane */}
      {activeView.type === "canvas" && (
        <PartyNotesCanvas partyCode={partyCode} currentUserId={currentUserId} isDM={isDM} members={members} dmUserId={dmUserId} leftAccessory={hamburger} />
      )}
      {activeView.type === "channel" && (
        <ChatPane
          messages={channelMessages(activeView.id)}
          currentUserId={currentUserId}
          partyCode={partyCode}
          canDelete={m => m.sender_id === currentUserId || isDM}
          onDelete={deleteMessage}
          onSend={input => sendMessage({ ...input, senderName: currentUserName, channel: activeView.id, recipientId: null, type: input.payload ? "share" : "message" })}
          placeholder={`Message #${channels.find(c => c.id === activeView.id)?.name ?? activeView.id}…`}
          emptyText="No messages yet — say hello to your party!"
          headerLabel={`# ${channels.find(c => c.id === activeView.id)?.name ?? activeView.id}`}
          leftAccessory={hamburger}
        />
      )}
      {activeView.type === "dm" && (
        <ChatPane
          messages={dmMessages(activeView.userId)}
          currentUserId={currentUserId}
          partyCode={partyCode}
          canDelete={m => m.sender_id === currentUserId || isDM}
          onDelete={deleteMessage}
          onSend={input => sendMessage({ ...input, senderName: currentUserName, channel: null, recipientId: activeView.userId, type: input.payload ? "share" : "message" })}
          placeholder={`Message ${activeView.name} privately…`}
          emptyText={`No private messages with ${activeView.name} yet.`}
          leftAccessory={hamburger}
          headerLabel={activeView.name}
        />
      )}
    </div>
  )
}
