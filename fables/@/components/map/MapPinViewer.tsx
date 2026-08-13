// ════════════════════════════════════════════════════════════════════════════
// MapPinViewer.tsx — full-screen viewer for a single map pin ("ping"), opened
// by clicking a pin on MapOverlay. Shows the pin's city name (renamable by
// its owner or the DM) and a scrollable list of notes anyone in the party can
// add to. Styling/interaction modeled on the old CanvasNodeViewer + the
// ChatPane message list.
// ════════════════════════════════════════════════════════════════════════════

import { useState } from "react"
import { Pencil, Trash2, Check, X, Palette, Loader2 } from "lucide-react"
import { Markdown } from "../ui/Markdown"
import { uploadUserImage } from "../imageGallery"
import { PIN_COLORS, type MapPin, type MapPinNote } from "./useMapBoard"

function initials(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "?"
}
function avatarColor(seed: string) {
  const colors = ["bg-rose-500", "bg-orange-500", "bg-amber-500", "bg-lime-500", "bg-emerald-500", "bg-teal-500", "bg-cyan-500", "bg-blue-500", "bg-violet-500", "bg-fuchsia-500"]
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return colors[h % colors.length]
}

export function MapPinViewer({
  pin, notes, currentUserId, isDM, onClose, onRename, onChangeColor, onDeletePin, onAddNote, onEditNote, onDeleteNote,
}: {
  pin: MapPin
  notes: MapPinNote[]
  currentUserId: string
  isDM: boolean
  onClose: () => void
  onRename: (name: string) => void
  onChangeColor: (color: string) => void
  onDeletePin: () => void
  onAddNote: (content: string) => void
  onEditNote: (id: string, content: string) => void
  onDeleteNote: (id: string) => void
}) {
  const canManagePin = pin.owner_id === currentUserId || isDM
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(pin.name)
  const [pickingColor, setPickingColor] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [noteDraft, setNoteDraft] = useState("")
  const [uploadingImage, setUploadingImage] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [noteEditDraft, setNoteEditDraft] = useState("")
  const [confirmingDeleteNoteId, setConfirmingDeleteNoteId] = useState<string | null>(null)

  const sortedNotes = [...notes].sort((a, b) => a.created_at.localeCompare(b.created_at))

  function saveName() {
    const next = nameDraft.trim()
    if (next && next !== pin.name) onRename(next)
    setEditingName(false)
  }

  function submitNote() {
    const body = noteDraft.trim()
    if (!body) return
    onAddNote(body)
    setNoteDraft("")
  }

  function startEditNote(note: MapPinNote) {
    setConfirmingDeleteNoteId(null)
    setEditingNoteId(note.id)
    setNoteEditDraft(note.content)
  }

  function saveEditNote(id: string) {
    const body = noteEditDraft.trim()
    if (!body) return
    onEditNote(id, body)
    setEditingNoteId(null)
  }

  // Paste an image straight from the clipboard into a note — uploads it to
  // the same shared bucket the rest of the app's image pickers use (see
  // imageGallery.ts) and inserts it as a markdown image, which the shared
  // <Markdown> renderer already supports (GFM images).
  async function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const file = Array.from(e.clipboardData.items).find(i => i.type.startsWith("image/"))?.getAsFile()
    if (!file) return
    e.preventDefault()
    setUploadingImage(true)
    try {
      const url = await uploadUserImage(currentUserId, file)
      if (url) setNoteDraft(d => d + (d && !d.endsWith("\n") ? "\n" : "") + `![image](${url})`)
    } finally {
      setUploadingImage(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="flex items-center justify-between px-5 py-3 shrink-0" onClick={e => e.stopPropagation()}>
        {editingName ? (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus value={nameDraft} onChange={e => setNameDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setNameDraft(pin.name); setEditingName(false) } }}
              className="text-sm font-semibold bg-white/10 text-white rounded-lg px-2.5 py-1.5 outline-none"
            />
            <button type="button" onClick={saveName} className="size-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"><Check className="size-4" /></button>
            <button type="button" onClick={() => { setNameDraft(pin.name); setEditingName(false) }} className="size-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"><X className="size-4" /></button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">{pin.name}</span>
            {canManagePin && (
              <button type="button" onClick={() => setEditingName(true)} title="Rename"
                className="text-white/50 hover:text-white transition-colors">
                <Pencil className="size-3.5" />
              </button>
            )}
          </div>
        )}
        <div className="flex items-center gap-1.5 relative">
          {canManagePin && (
            <>
              <button type="button" onClick={() => setPickingColor(v => !v)} title="Pin color"
                className="size-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors">
                <Palette className="size-4" style={{ color: pin.color }} />
              </button>
              {pickingColor && (
                <div className="absolute top-full right-0 mt-1.5 flex items-center gap-1.5 p-2 rounded-xl bg-zinc-900 border border-white/10 shadow-xl z-10">
                  {PIN_COLORS.map(color => (
                    <button key={color} type="button" onClick={() => { onChangeColor(color); setPickingColor(false) }} title={color}
                      style={{ backgroundColor: color }}
                      className={`size-5 rounded-full transition-transform ${pin.color === color ? "ring-2 ring-offset-2 ring-offset-zinc-900 ring-white scale-110" : "hover:scale-110"}`} />
                  ))}
                </div>
              )}
            </>
          )}
          {canManagePin && (
            confirmingDelete ? (
              <div className="flex items-center gap-1 text-xs">
                <span className="text-white/70 mr-0.5">Delete pin?</span>
                <button type="button" onClick={onDeletePin}
                  className="px-2 py-1 rounded-lg bg-red-500/80 hover:bg-red-500 text-white font-semibold transition-colors">Delete</button>
                <button type="button" onClick={() => setConfirmingDelete(false)}
                  className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 transition-colors">Cancel</button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmingDelete(true)} title="Remove pin"
                className="size-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-red-500/30 text-white/70 hover:text-red-200 transition-colors">
                <Trash2 className="size-4" />
              </button>
            )
          )}
          <button type="button" onClick={onClose} className="ml-1 text-white/60 hover:text-white text-lg leading-none px-1">✕</button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5" onClick={e => e.stopPropagation()}>
        <div className="max-w-xl mx-auto py-2">
          {sortedNotes.length === 0 && (
            <p className="text-sm text-white/40 italic text-center mt-10">No notes here yet — be the first to leave one.</p>
          )}
          <div className="flex flex-col gap-3 pb-4">
            {sortedNotes.map(note => {
              const canManageNote = note.owner_id === currentUserId || isDM
              const isEditingNote = editingNoteId === note.id
              const isConfirmingDeleteNote = confirmingDeleteNoteId === note.id
              return (
                <div key={note.id} className="group flex items-start gap-2.5">
                  <div className={`size-7 shrink-0 rounded-full ${avatarColor(note.owner_id)} flex items-center justify-center text-[10px] font-bold text-white mt-0.5`}>
                    {initials(note.owner_name)}
                  </div>
                  <div className="flex-1 min-w-0 bg-zinc-900 rounded-xl px-3 py-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold text-white">{note.owner_name}</span>
                      <span className="text-[10px] text-white/35">
                        {new Date(note.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {canManageNote && !isEditingNote && (
                        isConfirmingDeleteNote ? (
                          <div className="ml-auto flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] text-white/60">Delete note?</span>
                            <button type="button" onClick={() => { onDeleteNote(note.id); setConfirmingDeleteNoteId(null) }}
                              className="text-[10px] px-1.5 py-0.5 rounded-md bg-red-500/80 hover:bg-red-500 text-white font-semibold transition-colors">Delete</button>
                            <button type="button" onClick={() => setConfirmingDeleteNoteId(null)} title="Cancel"
                              className="text-white/40 hover:text-white transition-colors">
                              <X className="size-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="ml-auto flex items-center gap-1.5 opacity-0 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100 transition-opacity">
                            <button type="button" onClick={() => startEditNote(note)} title="Edit note"
                              className="text-white/30 hover:text-white transition-colors">
                              <Pencil className="size-3.5" />
                            </button>
                            <button type="button" onClick={() => setConfirmingDeleteNoteId(note.id)} title="Delete note"
                              className="text-white/30 hover:text-red-300 transition-colors">
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        )
                      )}
                    </div>
                    {isEditingNote ? (
                      <div className="mt-1">
                        <textarea
                          autoFocus value={noteEditDraft} onChange={e => setNoteEditDraft(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEditNote(note.id) }
                            if (e.key === "Escape") setEditingNoteId(null)
                          }}
                          rows={1}
                          className="w-full resize-none max-h-32 overflow-y-auto bg-white/10 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:bg-white/15 transition-colors leading-snug"
                        />
                        <div className="flex justify-end gap-2 mt-1">
                          <button type="button" onClick={() => setEditingNoteId(null)}
                            className="text-[10px] px-2 py-1 rounded-lg text-white/50 hover:text-white transition-colors">Cancel</button>
                          <button type="button" onClick={() => saveEditNote(note.id)} disabled={!noteEditDraft.trim()}
                            className="text-[10px] px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white font-semibold disabled:opacity-30 transition-colors">Save</button>
                        </div>
                      </div>
                    ) : (
                      <Markdown text={note.content} tone="dark" size="sm" />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="px-5 py-3 border-t border-white/10 shrink-0" onClick={e => e.stopPropagation()}>
        <div className="max-w-xl mx-auto flex items-end gap-2">
          <textarea
            value={noteDraft} onChange={e => setNoteDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitNote() } }}
            onPaste={handlePaste}
            placeholder={`Leave a note at ${pin.name}… (paste an image to attach it)`}
            rows={1}
            className="flex-1 resize-none max-h-32 overflow-y-auto bg-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:bg-white/15 transition-colors leading-snug"
          />
          <button type="button" onClick={submitNote} disabled={!noteDraft.trim() || uploadingImage}
            className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold disabled:opacity-25 transition-colors shrink-0 flex items-center gap-1.5">
            {uploadingImage && <Loader2 className="size-3.5 animate-spin" />}
            {uploadingImage ? "Uploading…" : "Add"}
          </button>
        </div>
      </div>
    </div>
  )
}
