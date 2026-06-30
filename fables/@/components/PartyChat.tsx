// ════════════════════════════════════════════════════════════════════════════
// PartyChat.tsx — real-time party chat with DM private message system
// ════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from "react"
import { ImageIcon } from "lucide-react"
import { supabase } from "../../src/supabase"

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  id: string
  created_at: string
  party_code: string
  sender_id: string
  sender_name: string | null
  body: string | null
  image_url: string | null
  recipient_id: string | null
  type: string
}

interface PartyMember {
  userId: string
  name: string
}

interface PartyChatProps {
  partyCode: string
  currentUserId: string
  currentUserName: string
  isDM?: boolean
  partyMembers?: PartyMember[]
  dmUserId?: string   // player only: the DM's UUID so they can initiate DMs
}

type ChatTab = "party" | "dms"

const BUCKET = "fableimages"

// ── Bubble ────────────────────────────────────────────────────────────────────

function Bubble({ msg, isMe }: { msg: Message; isMe: boolean }) {
  return (
    <div className={`flex flex-col gap-0.5 ${isMe ? "items-start" : "items-end"}`}>
      <span className="text-[10px] text-white/35 px-1">{msg.sender_name ?? "Unknown"}</span>
      <div className={`rounded-2xl px-3 py-2 max-w-[78%] break-words ${
        msg.recipient_id !== null
          ? "bg-purple-500/20 border border-purple-500/30 text-white"
          : isMe
            ? "bg-white/12 text-white"
            : "bg-white/20 text-white"
      }`}>
        {msg.image_url && (
          <img src={msg.image_url} alt="shared"
            className="rounded-xl max-w-full mb-1.5 max-h-52 object-cover" />
        )}
        {msg.body && <p className="text-sm leading-snug">{msg.body}</p>}
      </div>
      <span className="text-[9px] text-white/20 px-1">
        {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </span>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function PartyChat({
  partyCode,
  currentUserId,
  currentUserName,
  isDM = false,
  partyMembers = [],
  dmUserId,
}: PartyChatProps) {
  const [messages,     setMessages]     = useState<Message[]>([])
  const [chatTab,      setChatTab]      = useState<ChatTab>("party")
  const [dmTarget,     setDmTarget]     = useState<PartyMember | null>(partyMembers[0] ?? null)
  const [text,         setText]         = useState("")
  const [sending,      setSending]      = useState(false)
  const [showPicker,   setShowPicker]   = useState(false)
  const [pickerImages, setPickerImages] = useState<string[]>([])
  const [pickerLoading,setPickerLoading]= useState(false)

  const partyBottomRef = useRef<HTMLDivElement>(null)
  const dmBottomRef    = useRef<HTMLDivElement>(null)

  // ── Load history ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!partyCode || !currentUserId) return
    supabase
      .from("messages")
      .select("*")
      .eq("party_code", partyCode)
      .order("created_at", { ascending: true })
      .limit(200)
      .then(({ data, error }) => {
        if (error) console.error("chat load error:", error)
        if (data) setMessages(data as Message[])
      })
  }, [partyCode, currentUserId])

  // ── Realtime ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!partyCode || !currentUserId) return
    const ch = supabase
      .channel(`party-chat:${partyCode}:${currentUserId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `party_code=eq.${partyCode}`,
      }, payload => {
        const msg = payload.new as Message
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [partyCode, currentUserId])

  // ── Auto-scroll ───────────────────────────────────────────────────────────

  useEffect(() => {
    partyBottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, chatTab])

  useEffect(() => {
    dmBottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, dmTarget, chatTab])

  // ── Send ──────────────────────────────────────────────────────────────────

  async function send(body: string | null, imageUrl?: string, recipientId?: string | null) {
    if (!body && !imageUrl) return
    if (!currentUserId) return
    setSending(true)
    const { error } = await supabase.from("messages").insert({
      party_code:   partyCode,
      sender_id:    currentUserId,
      sender_name:  currentUserName,
      body:         body || null,
      image_url:    imageUrl ?? null,
      recipient_id: recipientId ?? null,
      type:         "message",
    })
    if (error) console.error("send error:", error)
    setSending(false)
  }

  // ── Image picker ──────────────────────────────────────────────────────────

  const loadPickerImages = useCallback(async () => {
    setPickerLoading(true)
    const { data } = await supabase.storage.from(BUCKET).list(currentUserId, { limit: 100 })
    if (data) {
      setPickerImages(
        data
          .filter(f => f.name !== ".emptyFolderPlaceholder")
          .map(f => supabase.storage.from(BUCKET).getPublicUrl(`${currentUserId}/${f.name}`).data.publicUrl)
      )
    }
    setPickerLoading(false)
  }, [currentUserId])

  async function openPicker() { setShowPicker(true); await loadPickerImages() }

  async function pickImage(url: string) {
    setShowPicker(false)
    if (chatTab === "dms") {
      const rid = isDM ? (dmTarget?.userId ?? null) : (dmUserId ?? null)
      await send(null, url, rid)
    } else {
      await send(null, url, null)
    }
  }

  // ── Derived lists ─────────────────────────────────────────────────────────

  const partyMessages = messages.filter(m => m.type === "message" && m.recipient_id === null)

  function getDmMessages(targetUserId: string) {
    return messages.filter(m =>
      m.type === "message" && m.recipient_id !== null && (
        (m.sender_id === currentUserId && m.recipient_id === targetUserId) ||
        (m.sender_id === targetUserId  && m.recipient_id === currentUserId)
      )
    )
  }

  const allMyDms = messages.filter(m =>
    m.type === "message" && m.recipient_id !== null && (
      m.sender_id === currentUserId || m.recipient_id === currentUserId
    )
  )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col flex-1 min-h-0 relative">

      {/* Tab bar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-white/10 shrink-0">
        {(["party", "dms"] as ChatTab[]).map(tab => (
          <button key={tab} type="button" onClick={() => setChatTab(tab)}
            className={`px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide transition-colors ${
              chatTab === tab ? "bg-white/20 text-white" : "text-white/35 hover:text-white/70 hover:bg-white/8"
            }`}>
            {tab === "party" ? "Party Chat" : "Private Messages"}
          </button>
        ))}
      </div>

      {/* ── Party Chat tab ─────────────────────────────────────────────────── */}
      {chatTab === "party" && (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-2 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
            {partyMessages.length === 0 && (
              <p className="text-xs text-white/25 italic text-center mt-10">
                No messages yet — say hello to your party!
              </p>
            )}
            {partyMessages.map(msg => (
              <Bubble key={msg.id} msg={msg} isMe={msg.sender_id === currentUserId} />
            ))}
            <div ref={partyBottomRef} />
          </div>

          <ChatInput
            text={text} onText={setText}
            onSend={() => { send(text.trim() || null, undefined, null); setText("") }}
            onImageClick={openPicker}
            disabled={sending}
          />
        </>
      )}

      {/* ── DMs tab — DM view ─────────────────────────────────────────────── */}
      {chatTab === "dms" && isDM && (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Player picker dropdown */}
          <div className="px-3 py-2 border-b border-white/10 shrink-0">
            {partyMembers.length === 0 ? (
              <p className="text-xs text-white/30 italic">No players in party yet</p>
            ) : (
              <select
                value={dmTarget?.userId ?? ""}
                onChange={e => setDmTarget(partyMembers.find(p => p.userId === e.target.value) ?? null)}
                className="w-full bg-white/10 text-white text-xs rounded-lg px-2 py-1.5 outline-none"
              >
                <option value="" disabled>Select a player…</option>
                {partyMembers.map(m => (
                  <option key={m.userId} value={m.userId}>{m.name}{getDmMessages(m.userId).length > 0 ? " ·" : ""}</option>
                ))}
              </select>
            )}
          </div>

          {dmTarget ? (
            <>
              <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-2 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
                {getDmMessages(dmTarget.userId).length === 0 && (
                  <p className="text-xs text-white/25 italic text-center mt-10">No messages with {dmTarget.name} yet.</p>
                )}
                {getDmMessages(dmTarget.userId).map(msg => (
                  <Bubble key={msg.id} msg={msg} isMe={msg.sender_id === currentUserId} />
                ))}
                <div ref={dmBottomRef} />
              </div>
              <ChatInput
                text={text} onText={setText}
                placeholder={`Message ${dmTarget.name} privately…`}
                onSend={() => { send(text.trim() || null, undefined, dmTarget.userId); setText("") }}
                onImageClick={openPicker}
                disabled={sending}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-white/25 italic">
              Select a player above
            </div>
          )}
        </div>
      )}

      {/* ── DMs tab — player view ─────────────────────────────────────────── */}
      {chatTab === "dms" && !isDM && (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-2 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
            {allMyDms.length === 0 && (
              <p className="text-xs text-white/25 italic text-center mt-10">
                No private messages yet.
              </p>
            )}
            {allMyDms.map(msg => (
              <Bubble key={msg.id} msg={msg} isMe={msg.sender_id === currentUserId} />
            ))}
            <div ref={dmBottomRef} />
          </div>
          {dmUserId ? (
            <ChatInput
              text={text} onText={setText}
              placeholder="Message DM privately…"
              onSend={() => { send(text.trim() || null, undefined, dmUserId); setText("") }}
              onImageClick={openPicker}
              disabled={sending}
            />
          ) : (
            <div className="px-3 py-3 border-t border-white/10 text-center text-xs text-white/25 italic shrink-0">
              No campaign linked — ask your DM for the party code
            </div>
          )}
        </>
      )}

      {/* Image picker overlay */}
      {showPicker && (
        <div className="absolute inset-0 z-20 flex flex-col bg-black/90 rounded-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
            <span className="text-sm font-semibold text-white">Pick an image</span>
            <button type="button" onClick={() => setShowPicker(false)}
              className="text-white/50 hover:text-white text-lg leading-none">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {pickerLoading && <p className="text-xs text-white/40 text-center mt-8">Loading…</p>}
            {!pickerLoading && pickerImages.length === 0 && (
              <p className="text-xs text-white/30 italic text-center mt-8 px-4">
                No images found. Upload via the sidebar background picker first.
              </p>
            )}
            <div className="grid grid-cols-3 gap-2">
              {pickerImages.map(url => (
                <button key={url} type="button" onClick={() => pickImage(url)}
                  className="aspect-square rounded-xl overflow-hidden hover:ring-2 hover:ring-white/50 transition-all">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Shared input bar ──────────────────────────────────────────────────────────

function ChatInput({
  text, onText, onSend, onImageClick, disabled = false, placeholder = "Message party…",
}: {
  text: string
  onText: (v: string) => void
  onSend: () => void
  onImageClick: () => void
  disabled?: boolean
  placeholder?: string
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 border-t border-white/10 shrink-0">
      <button type="button" onClick={onImageClick} title="Send an uploaded image"
        className="size-8 flex items-center justify-center rounded-xl bg-white/8 hover:bg-white/15 text-white/50 hover:text-white transition-colors shrink-0">
        <ImageIcon className="size-4" />
      </button>
      <input
        value={text}
        onChange={e => onText(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend() } }}
        placeholder={placeholder}
        className="flex-1 bg-white/8 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:bg-white/12 transition-colors"
      />
      <button type="button" onClick={onSend}
        disabled={disabled || !text.trim()}
        className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold disabled:opacity-25 transition-colors shrink-0">
        Send
      </button>
    </div>
  )
}
