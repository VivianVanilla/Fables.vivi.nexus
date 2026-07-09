// ════════════════════════════════════════════════════════════════════════════
// ChatPane.tsx — Discord-style message list + composer. Used for both public
// channels and private (DM) threads; the caller pre-filters `messages` and
// supplies the send/delete callbacks.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState, useCallback } from "react"
import { ImageIcon, Paperclip, Trash2 } from "lucide-react"
import { loadUserImages } from "../imageGallery"
import { ShareCard } from "./ShareCard"
import { ShareComposer } from "./ShareComposer"
import type { Message, SharePayload } from "./partyTypes"

function initials(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "?"
}

function avatarColor(seed: string) {
  const colors = ["bg-rose-500", "bg-orange-500", "bg-amber-500", "bg-lime-500", "bg-emerald-500", "bg-teal-500", "bg-cyan-500", "bg-blue-500", "bg-violet-500", "bg-fuchsia-500"]
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return colors[h % colors.length]
}

function Row({ msg, showHeader, canDelete, onDelete }: {
  msg: Message
  showHeader: boolean
  canDelete: boolean
  onDelete: () => void
}) {
  const [hover, setHover] = useState(false)
  const name = msg.sender_name ?? "Unknown"

  return (
    <div
      className="group flex items-start gap-2.5 px-3 py-0.5 hover:bg-foreground/[0.03] rounded-lg relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="w-8 shrink-0 flex justify-center">
        {showHeader ? (
          <div className={`size-8 rounded-full ${avatarColor(msg.sender_id)} flex items-center justify-center text-[11px] font-bold text-white mt-0.5`}>
            {initials(name)}
          </div>
        ) : hover ? (
          <span className="text-[9px] text-muted-foreground/40 mt-1.5">
            {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        ) : null}
      </div>
      <div className="flex-1 min-w-0 py-0.5">
        {showHeader && (
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-foreground">{name}</span>
            <span className="text-[10px] text-muted-foreground/40">
              {new Date(msg.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        )}
        {msg.type === "share" && msg.payload ? (
          <div className="mt-1"><ShareCard payload={msg.payload} /></div>
        ) : (
          <>
            {msg.image_url && (
              <img src={msg.image_url} alt="attachment" className="rounded-lg max-w-xs max-h-64 object-cover mt-1 mb-0.5" />
            )}
            {msg.body && <p className="text-sm leading-snug text-foreground/90 wrap-break-word">{msg.body}</p>}
          </>
        )}
      </div>
      {canDelete && (
        // Always visible on touch devices — :hover/mouseenter never fires
        // reliably from a tap, so a hover-only affordance is effectively
        // unreachable on mobile.
        <button type="button" onClick={onDelete} title="Delete message"
          className="absolute top-1 right-2 size-6 flex items-center justify-center rounded-md bg-card border border-border text-muted-foreground hover:text-red-400 hover:border-red-400/40 transition-colors opacity-0 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100">
          <Trash2 className="size-3.5" />
        </button>
      )}
    </div>
  )
}

export function ChatPane({
  messages, currentUserId, partyCode,
  canDelete, onDelete, onSend, placeholder, emptyText, headerLabel, leftAccessory,
}: {
  messages: Message[]
  currentUserId: string
  partyCode: string
  canDelete: (m: Message) => boolean
  onDelete: (id: string) => void
  onSend: (input: { body?: string | null; imageUrl?: string | null; payload?: SharePayload | null }) => void
  placeholder: string
  emptyText: string
  headerLabel: string
  leftAccessory?: React.ReactNode
}) {
  const [text, setText] = useState("")
  const [showPicker, setShowPicker] = useState(false)
  const [pickerImages, setPickerImages] = useState<string[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)
  const [showComposer, setShowComposer] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const loadPickerImages = useCallback(async () => {
    setPickerLoading(true)
    const imgs = await loadUserImages(currentUserId)
    setPickerImages(imgs.map(i => i.publicUrl))
    setPickerLoading(false)
  }, [currentUserId])

  async function openPicker() { setShowPicker(true); await loadPickerImages() }

  async function pickImage(url: string) {
    setShowPicker(false)
    onSend({ imageUrl: url })
  }

  function attachShare(payload: SharePayload) {
    onSend({ payload })
  }

  function submit() {
    const body = text.trim()
    if (!body) return
    onSend({ body })
    setText("")
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 relative">
      <div className="px-3.5 py-2.5 border-b border-border shrink-0 flex items-center gap-2">
        {leftAccessory}
        <span className="text-sm font-bold text-foreground">{headerLabel}</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto py-2 flex flex-col">
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground/40 italic text-center mt-10">{emptyText}</p>
        )}
        {messages.map((msg, i) => {
          const prev = messages[i - 1]
          const showHeader = !prev || prev.sender_id !== msg.sender_id ||
            (new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime()) > 5 * 60 * 1000
          return (
            <Row
              key={msg.id}
              msg={msg}
              showHeader={showHeader}
              canDelete={canDelete(msg)}
              onDelete={() => onDelete(msg.id)}
            />
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="relative px-3 py-2.5 border-t border-border shrink-0">
        {showComposer && (
          <ShareComposer partyCode={partyCode} onAttach={attachShare} onClose={() => setShowComposer(false)} />
        )}
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setShowComposer(v => !v)} title="Attach a feature, spell, or familiar"
            className="size-8 flex items-center justify-center rounded-xl bg-foreground/8 hover:bg-foreground/15 text-muted-foreground hover:text-foreground transition-colors shrink-0">
            <Paperclip className="size-4" />
          </button>
          <button type="button" onClick={openPicker} title="Send a profile image"
            className="size-8 flex items-center justify-center rounded-xl bg-foreground/8 hover:bg-foreground/15 text-muted-foreground hover:text-foreground transition-colors shrink-0">
            <ImageIcon className="size-4" />
          </button>
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit() } }}
            placeholder={placeholder}
            className="flex-1 bg-foreground/8 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:bg-foreground/12 transition-colors"
          />
          <button type="button" onClick={submit} disabled={!text.trim()}
            className="px-3 py-2 rounded-xl bg-foreground/15 hover:bg-foreground/25 text-foreground text-xs font-semibold disabled:opacity-25 transition-colors shrink-0">
            Send
          </button>
        </div>
      </div>

      {showPicker && (
        <div className="absolute inset-0 z-20 flex flex-col bg-card/98 backdrop-blur rounded-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <span className="text-sm font-semibold text-foreground">Pick a profile image</span>
            <button type="button" onClick={() => setShowPicker(false)}
              className="text-muted-foreground hover:text-foreground text-lg leading-none">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {pickerLoading && <p className="text-xs text-muted-foreground/50 text-center mt-8">Loading…</p>}
            {!pickerLoading && pickerImages.length === 0 && (
              <p className="text-xs text-muted-foreground/40 italic text-center mt-8 px-4">
                No profile images yet — upload one from Profile Settings first.
              </p>
            )}
            <div className="grid grid-cols-3 gap-2">
              {pickerImages.map(url => (
                <button key={url} type="button" onClick={() => pickImage(url)}
                  className="aspect-square rounded-xl overflow-hidden hover:ring-2 hover:ring-foreground/50 transition-all">
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
