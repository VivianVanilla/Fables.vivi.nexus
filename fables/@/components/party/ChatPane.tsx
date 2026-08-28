// ════════════════════════════════════════════════════════════════════════════
// ChatPane.tsx — Discord-style message list + composer. Used for both public
// channels and private (DM) threads; the caller pre-filters `messages` and
// supplies the send/delete callbacks.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState, useCallback } from "react"
import { ImageIcon, Paperclip, Trash2, Copy, Pencil } from "lucide-react"
import { loadUserImages } from "@/components/shared/imageGallery"
import { Markdown } from "../ui/Markdown"
import { ShareCard } from "./ShareCard"
import { ShareComposer } from "./ShareComposer"
import type { Message, SharePayload } from "./partyTypes"

const LONG_PRESS_MS = 500

interface MessageMenuState { x: number; y: number; msg: Message }

function initials(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "?"
}

function avatarColor(seed: string) {
  const colors = ["bg-rose-500", "bg-orange-500", "bg-amber-500", "bg-lime-500", "bg-emerald-500", "bg-teal-500", "bg-cyan-500", "bg-blue-500", "bg-violet-500", "bg-fuchsia-500"]
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return colors[h % colors.length]
}

function Row({ msg, showHeader, isEditing, onSaveEdit, onCancelEdit, onOpenMenu }: {
  msg: Message
  showHeader: boolean
  isEditing: boolean
  onSaveEdit: (body: string) => void
  onCancelEdit: () => void
  onOpenMenu: (x: number, y: number) => void
}) {
  const [hover, setHover] = useState(false)
  const touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Uncontrolled — the textarea only exists in the DOM while isEditing (see
  // the conditional render below), so it naturally remounts with a fresh
  // defaultValue every time editing starts, with no effect needed to sync it.
  const editRef = useRef<HTMLTextAreaElement>(null)
  const name = msg.sender_name ?? "Unknown"

  function handleTouchStart(e: React.TouchEvent) {
    const touch = e.touches[0]
    const x = touch.clientX, y = touch.clientY
    touchTimer.current = setTimeout(() => {
      touchTimer.current = null
      navigator.vibrate?.(10)
      onOpenMenu(x, y)
    }, LONG_PRESS_MS)
  }
  function cancelTouch() {
    if (touchTimer.current) { clearTimeout(touchTimer.current); touchTimer.current = null }
  }
  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    onOpenMenu(e.clientX, e.clientY)
  }

  function saveEdit() {
    const body = editRef.current?.value.trim() ?? ""
    if (body) onSaveEdit(body)
    else onCancelEdit()
  }

  return (
    <div
      className="group flex items-start gap-2.5 px-3 py-0.5 hover:bg-foreground/[0.03] rounded-lg relative select-none"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchMove={cancelTouch}
      onTouchEnd={cancelTouch}
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
        {isEditing ? (
          <div className="flex flex-col gap-1.5 mt-1">
            <textarea
              ref={editRef} autoFocus defaultValue={msg.body ?? ""}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit() }
                if (e.key === "Escape") onCancelEdit()
              }}
              rows={2}
              className="w-full resize-none bg-foreground/8 rounded-lg px-2.5 py-1.5 text-sm text-foreground outline-none focus:bg-foreground/12 transition-colors"
            />
            <div className="flex items-center gap-2">
              <button type="button" onClick={saveEdit}
                className="text-[11px] px-2.5 py-1 rounded-full bg-foreground/15 hover:bg-foreground/25 text-foreground font-semibold transition-colors">
                Save
              </button>
              <button type="button" onClick={onCancelEdit}
                className="text-[11px] px-2.5 py-1 rounded-full text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
              <span className="text-[10px] text-muted-foreground/40">Enter to save · Esc to cancel</span>
            </div>
          </div>
        ) : msg.type === "share" && msg.payload ? (
          <div className="mt-1"><ShareCard payload={msg.payload} /></div>
        ) : (
          <>
            {msg.image_url && (
              <img src={msg.image_url} alt="attachment" className="rounded-lg max-w-xs max-h-64 object-cover mt-1 mb-0.5" />
            )}
            {msg.body && <Markdown text={msg.body} tone="auto" className="wrap-break-word" />}
          </>
        )}
      </div>
    </div>
  )
}

export function ChatPane({
  messages, currentUserId, partyCode,
  canDelete, onDelete, onEdit, onSend, placeholder, emptyText, headerLabel, leftAccessory,
}: {
  messages: Message[]
  currentUserId: string
  partyCode: string
  canDelete: (m: Message) => boolean
  onDelete: (id: string) => void
  onEdit: (id: string, body: string) => void
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
  const [menu, setMenu] = useState<MessageMenuState | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function openMessageMenu(x: number, y: number, msg: Message) {
    // Keeps the menu on-screen in a panel that's often under 400px wide
    // (the mobile compact view especially) — a menu opened near the right
    // edge would otherwise render partly off-screen.
    const MENU_WIDTH = 150
    setMenu({ x: Math.min(x, window.innerWidth - MENU_WIDTH - 8), y, msg })
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Grows with the message up to a cap, then scrolls internally — lets you
  // paste a whole paragraph (a long in-character moment, say) and actually
  // see what you're sending instead of it staying pinned to one line.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [text])

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
    <div className="flex flex-col flex-1 min-h-0 min-w-0 relative overflow-hidden">
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
              isEditing={editingId === msg.id}
              onSaveEdit={body => { onEdit(msg.id, body); setEditingId(null) }}
              onCancelEdit={() => setEditingId(null)}
              onOpenMenu={(x, y) => openMessageMenu(x, y, msg)}
            />
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="relative px-3 py-2.5 border-t border-border shrink-0">
        {showComposer && (
          <ShareComposer partyCode={partyCode} onAttach={attachShare} onClose={() => setShowComposer(false)} />
        )}
        <div className="flex items-end gap-2">
          <button type="button" onClick={() => setShowComposer(v => !v)} title="Attach a feature, spell, or familiar"
            className="size-8 flex items-center justify-center rounded-xl bg-foreground/8 hover:bg-foreground/15 text-muted-foreground hover:text-foreground transition-colors shrink-0 mb-[3px]">
            <Paperclip className="size-4" />
          </button>
          <button type="button" onClick={openPicker} title="Send a profile image"
            className="size-8 flex items-center justify-center rounded-xl bg-foreground/8 hover:bg-foreground/15 text-muted-foreground hover:text-foreground transition-colors shrink-0 mb-[3px]">
            <ImageIcon className="size-4" />
          </button>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit() } }}
            placeholder={placeholder}
            rows={1}
            className="flex-1 resize-none max-h-40 overflow-y-auto bg-foreground/8 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:bg-foreground/12 transition-colors leading-snug"
          />
          <button type="button" onClick={submit} disabled={!text.trim()}
            className="px-3 py-2 rounded-xl bg-foreground/15 hover:bg-foreground/25 text-foreground text-xs font-semibold disabled:opacity-25 transition-colors shrink-0 mb-[3px]">
            Send
          </button>
        </div>
        <p className="text-[9px] text-muted-foreground/30 px-1 pt-1">Markdown supported · Shift+Enter for a new line</p>
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

      {/* Message menu — right-click on desktop, long-press on touch (see
          Row's onContextMenu/onTouchStart above). Replaces the old
          always-visible delete button, which had no reliable hover state on
          touch and just sat permanently on top of every message. */}
      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} onContextMenu={e => { e.preventDefault(); setMenu(null) }} />
          <div style={{ left: menu.x, top: menu.y }} className="fixed z-50 flex flex-col rounded-lg bg-popover border border-border shadow-xl overflow-hidden py-1 min-w-36">
            {menu.msg.body && (
              <button type="button"
                onClick={() => { navigator.clipboard.writeText(menu.msg.body ?? ""); setMenu(null) }}
                className="flex items-center gap-2 px-3 py-2 text-xs text-foreground/80 hover:bg-foreground/10 transition-colors text-left">
                <Copy className="size-3.5" /> Copy text
              </button>
            )}
            {menu.msg.sender_id === currentUserId && menu.msg.type === "message" && menu.msg.body != null && (
              <button type="button" onClick={() => { setEditingId(menu.msg.id); setMenu(null) }}
                className="flex items-center gap-2 px-3 py-2 text-xs text-foreground/80 hover:bg-foreground/10 transition-colors text-left">
                <Pencil className="size-3.5" /> Edit
              </button>
            )}
            {canDelete(menu.msg) && (
              <button type="button" onClick={() => { onDelete(menu.msg.id); setMenu(null) }}
                className="flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors text-left">
                <Trash2 className="size-3.5" /> Delete
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
