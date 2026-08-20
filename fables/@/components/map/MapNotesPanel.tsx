// ════════════════════════════════════════════════════════════════════════════
// MapNotesPanel.tsx — shared "corkboard" of sticky notes, used by both
// MapPinViewer (notes on a city) and MapTrackerViewer (notes on a tracker,
// e.g. an NPC). A composer card up top plus a wrapping grid of posted notes
// below, each a colored card rather than a chat bubble. Images attach either
// by pasting or by picking from the party's shared image library (see
// imageGallery.ts) — same upload target either way, just a different entry
// point. Editing/deleting a note is open to the whole party (it's a shared
// board), reached via right-click or the "⋮" button rather than hover-only
// icons, so it still works on touch.
// ════════════════════════════════════════════════════════════════════════════

import { useRef, useState } from "react"
import { Pencil, Trash2, X, ImagePlus, Loader2, MoreVertical } from "lucide-react"
import { Markdown } from "../ui/Markdown"
import { uploadUserImage, loadUserImages, type GalleryImage } from "@/components/shared/imageGallery"
import { PortraitModal } from "@/components/shared/PortraitModal"
import { Modal } from "@/components/shared/ui/Modal"
import type { MapPinNote } from "./useMapBoard"

// `fade` mirrors `bg` (as a gradient "from" stop) so a long note's cutoff
// fades into its own card color instead of a mismatched one.
const NOTE_STYLES = [
  { bg: "bg-amber-200", fade: "from-amber-200" },
  { bg: "bg-rose-200", fade: "from-rose-200" },
  { bg: "bg-sky-200", fade: "from-sky-200" },
  { bg: "bg-lime-200", fade: "from-lime-200" },
  { bg: "bg-violet-200", fade: "from-violet-200" },
  { bg: "bg-orange-200", fade: "from-orange-200" },
  { bg: "bg-cyan-200", fade: "from-cyan-200" },
  { bg: "bg-fuchsia-200", fade: "from-fuchsia-200" },
]
const ROTATIONS = ["-rotate-2", "rotate-1", "-rotate-1", "rotate-2", "rotate-0", "rotate-2"]
function pick<T>(arr: T[], seed: string): T {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return arr[h % arr.length]
}

// A long note left unclipped would grow the card to match, and flex's
// default cross-axis stretch would then blow up every other card in that
// row to match it — the "ruins the board" case. Past this length, clip the
// preview and fade it out; the card is still a click away from the full
// text (see the expanded-note modal below).
const LONG_NOTE_THRESHOLD = 280

function insertImageMd(draft: string, url: string) {
  return draft + (draft && !draft.endsWith("\n") ? "\n" : "") + `![image](${url})`
}

export function MapNotesPanel({
  notes, currentUserId, placeholder, onAddNote, onEditNote, onDeleteNote, linkify, onInternalLink,
}: {
  notes: MapPinNote[]
  currentUserId: string
  placeholder: string
  onAddNote: (content: string) => void
  onEditNote: (id: string, content: string) => void
  onDeleteNote: (id: string) => void
  // Optional — lets a caller (e.g. NPC Tracker's Detail Notes) rewrite
  // `[[Name]]`-style mentions into clickable links before Markdown renders
  // them. Unused call sites (map pin/tracker notes) render notes as-is.
  linkify?: (text: string) => string
  onInternalLink?: (target: string) => void
}) {
  const [noteDraft, setNoteDraft] = useState("")
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [noteEditDraft, setNoteEditDraft] = useState("")
  const [confirmingDeleteNoteId, setConfirmingDeleteNoteId] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageTarget, setImageTarget] = useState<"compose" | string | null>(null)
  const [showImagePicker, setShowImagePicker] = useState(false)
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([])
  const [galleryLoading, setGalleryLoading] = useState(false)
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ noteId: string; x: number; y: number } | null>(null)
  const noteImageInputRef = useRef<HTMLInputElement | null>(null)

  const sortedNotes = [...notes].sort((a, b) => b.created_at.localeCompare(a.created_at))
  const expandedNote = sortedNotes.find(n => n.id === expandedNoteId) ?? null

  // Shared by both the small card and the expanded view — a click on an
  // <img> the note's markdown rendered opens that image full-size instead of
  // (or on top of) expanding the note itself.
  function handleContentClick(e: React.MouseEvent, note: MapPinNote) {
    const target = e.target as HTMLElement
    if (target.tagName === "IMG") {
      e.stopPropagation()
      setLightboxImage((target as HTMLImageElement).src)
      return
    }
    setExpandedNoteId(note.id)
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

  function renderNoteContent(note: MapPinNote) {
    const long = note.content.length > LONG_NOTE_THRESHOLD
    return (
      <div onClick={e => handleContentClick(e, note)}
        className={`cursor-pointer [&_img]:cursor-zoom-in ${long ? "relative max-h-52 overflow-y-auto" : ""}`}>
        <Markdown text={linkify ? linkify(note.content) : note.content} tone="paper" size="xs" onInternalLink={onInternalLink} />
        {/* Scrollbar chrome is hidden globally (see index.css) — content is
            still scrollable, just without a visible track/thumb. This hint
            fades with the rest of the content as soon as you start
            scrolling, rather than sitting pinned over it. */}
        {long && (
          <div className={`absolute inset-x-0 bottom-0 h-10 flex items-end justify-center pb-1 bg-gradient-to-t ${pick(NOTE_STYLES, note.id).fade} to-transparent pointer-events-none rounded-b-md`}>
            <span className="text-[10px] font-semibold text-zinc-700/70">Scroll for more…</span>
          </div>
        )}
      </div>
    )
  }

  // Right-click (or the always-visible "⋮" on touch) opens a small Edit/
  // Delete menu instead of hover-only icons, which don't exist on touch.
  function onCardContextMenu(e: React.MouseEvent, note: MapPinNote) {
    if (editingNoteId === note.id) return // let the textarea's native menu through
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ noteId: note.id, x: e.clientX, y: e.clientY })
  }
  function onMenuButton(e: React.MouseEvent, noteId: string) {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setContextMenu({ noteId, x: rect.right, y: rect.bottom + 4 })
  }

  // Paste an image straight from the clipboard — uploads it to the shared
  // gallery bucket and inlines it as markdown, same as the library-picker
  // path below just triggered differently.
  async function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>, setDraft: React.Dispatch<React.SetStateAction<string>>) {
    const file = Array.from(e.clipboardData.items).find(i => i.type.startsWith("image/"))?.getAsFile()
    if (!file) return
    e.preventDefault()
    setUploadingImage(true)
    try {
      const url = await uploadUserImage(currentUserId, file)
      if (url) setDraft(d => insertImageMd(d, url))
    } finally {
      setUploadingImage(false)
    }
  }

  async function openImagePicker(target: "compose" | string) {
    setImageTarget(target)
    setShowImagePicker(true)
    setGalleryLoading(true)
    setGalleryImages(await loadUserImages(currentUserId))
    setGalleryLoading(false)
  }

  function insertImage(url: string) {
    if (imageTarget === "compose") setNoteDraft(d => insertImageMd(d, url))
    else if (imageTarget) setNoteEditDraft(d => insertImageMd(d, url))
    setShowImagePicker(false)
  }

  async function uploadNoteImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingImage(true)
    const url = await uploadUserImage(currentUserId, file)
    setUploadingImage(false)
    e.target.value = ""
    if (url) insertImage(url)
  }

  return (
    <div className="max-w-3xl mx-auto py-2">
      {/* Composer — a proper multi-line card instead of a one-line chat bar,
          so what you're typing stays visible as you type it. Plain Enter
          inserts a newline like any note app; Ctrl/Cmd+Enter posts. */}
      <div className="rounded-lg border-2 border-dashed border-white/25 bg-zinc-50 p-3 mb-5 shadow-lg">
        <textarea
          value={noteDraft} onChange={e => setNoteDraft(e.target.value)}
          onPaste={e => handlePaste(e, setNoteDraft)}
          onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submitNote() } }}
          placeholder={placeholder}
          rows={4}
          className="w-full resize-none bg-transparent outline-none text-sm text-zinc-800 placeholder:text-zinc-400 leading-snug"
        />
        <div className="flex items-center justify-between mt-2">
          <button type="button" onClick={() => openImagePicker("compose")} disabled={uploadingImage}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-zinc-900/5 hover:bg-zinc-900/10 text-zinc-600 transition-colors disabled:opacity-50">
            {uploadingImage && imageTarget === "compose" ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
            Add image
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-400 hidden sm:inline">Ctrl+Enter to post</span>
            <button type="button" onClick={submitNote} disabled={!noteDraft.trim()}
              className="text-xs px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-semibold disabled:opacity-25 transition-colors">
              Post note
            </button>
          </div>
        </div>
      </div>

      {sortedNotes.length === 0 && (
        <p className="text-sm text-white/40 italic text-center mt-6">No notes here yet — be the first to leave one.</p>
      )}

      <div className="flex flex-wrap items-start gap-4 pb-4">
        {sortedNotes.map(note => {
          const isEditingNote = editingNoteId === note.id
          const isConfirmingDeleteNote = confirmingDeleteNoteId === note.id
          return (
            <div key={note.id} onContextMenu={e => onCardContextMenu(e, note)}
              className={`w-60 shrink-0 rounded-lg shadow-lg p-3 ${pick(NOTE_STYLES, note.id).bg} ${isEditingNote ? "rotate-0" : pick(ROTATIONS, note.id)} hover:rotate-0 hover:scale-[1.03] transition-transform`}>
              <div className="flex items-baseline gap-1.5 mb-1.5">
                <span className="text-xs font-bold text-zinc-800 truncate">{note.owner_name}</span>
                <span className="text-[10px] text-zinc-600/70 shrink-0 ml-auto">
                  {new Date(note.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
                {!isEditingNote && (
                  <button type="button" onClick={e => onMenuButton(e, note.id)} title="Note options"
                    className="text-zinc-600 hover:text-zinc-900 transition-colors shrink-0">
                    <MoreVertical className="size-3.5" />
                  </button>
                )}
              </div>
              {isEditingNote ? (
                <div>
                  <textarea
                    autoFocus value={noteEditDraft} onChange={e => setNoteEditDraft(e.target.value)}
                    onPaste={e => handlePaste(e, setNoteEditDraft)}
                    onKeyDown={e => { if (e.key === "Escape") setEditingNoteId(null) }}
                    rows={4}
                    className="w-full resize-none bg-black/5 rounded-md px-2 py-1.5 text-xs text-zinc-800 outline-none leading-snug"
                  />
                  <div className="flex items-center justify-between mt-1.5">
                    <button type="button" onClick={() => openImagePicker(note.id)} title="Add image" disabled={uploadingImage}
                      className="text-zinc-600 hover:text-zinc-900 transition-colors disabled:opacity-50">
                      {uploadingImage && imageTarget === note.id ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
                    </button>
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => setEditingNoteId(null)}
                        className="text-[10px] px-2 py-1 rounded-md text-zinc-500 hover:text-zinc-900 transition-colors">Cancel</button>
                      <button type="button" onClick={() => saveEditNote(note.id)} disabled={!noteEditDraft.trim()}
                        className="text-[10px] px-2 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white font-semibold disabled:opacity-30 transition-colors">Save</button>
                    </div>
                  </div>
                </div>
              ) : isConfirmingDeleteNote ? (
                <div>
                  {renderNoteContent(note)}
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-[10px] text-zinc-700">Delete note?</span>
                    <button type="button" onClick={() => { onDeleteNote(note.id); setConfirmingDeleteNoteId(null) }}
                      className="text-[10px] px-1.5 py-0.5 rounded-md bg-red-500/80 hover:bg-red-500 text-white font-semibold transition-colors">Delete</button>
                    <button type="button" onClick={() => setConfirmingDeleteNoteId(null)} title="Cancel"
                      className="text-zinc-600 hover:text-zinc-900 transition-colors">
                      <X className="size-3.5" />
                    </button>
                  </div>
                </div>
              ) : renderNoteContent(note)}
            </div>
          )
        })}
      </div>

      {showImagePicker && (
        <PortraitModal
          title="Choose Image"
          galleryImages={galleryImages}
          galleryLoading={galleryLoading}
          onChoose={insertImage}
          onUploadClick={() => noteImageInputRef.current?.click()}
          onClose={() => setShowImagePicker(false)}
        />
      )}
      <input ref={noteImageInputRef} type="file" accept="image/*" className="hidden" onChange={uploadNoteImage} />

      {/* Right-click / "⋮" menu — a backdrop first so a click anywhere else
          (including a second right-click) dismisses it. */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} onContextMenu={e => { e.preventDefault(); setContextMenu(null) }} />
          <div style={{ left: contextMenu.x, top: contextMenu.y }} className="fixed z-50 flex flex-col rounded-lg bg-zinc-900 border border-white/10 shadow-xl overflow-hidden py-1 min-w-36 -translate-x-full">
            <button type="button" onClick={() => {
              const n = notes.find(n => n.id === contextMenu.noteId)
              if (n) startEditNote(n)
              setExpandedNoteId(null) // reveal the card's edit mode instead of leaving the read-only expanded view showing
              setContextMenu(null)
            }} className="flex items-center gap-2 px-3 py-2 text-xs text-white/80 hover:bg-white/10 transition-colors text-left">
              <Pencil className="size-3.5" /> Edit note
            </button>
            <button type="button" onClick={() => {
              setConfirmingDeleteNoteId(contextMenu.noteId)
              setExpandedNoteId(null) // reveal the card's delete-confirm bar
              setContextMenu(null)
            }} className="flex items-center gap-2 px-3 py-2 text-xs text-red-300 hover:bg-red-500/10 transition-colors text-left">
              <Trash2 className="size-3.5" /> Delete note
            </button>
          </div>
        </>
      )}

      {/* Expanded note — the small cards are deliberately compact, so
          clicking one opens a much bigger, easier-to-read version. */}
      {expandedNote && (
        <Modal onClose={() => setExpandedNoteId(null)}>
          <div className={`w-[min(90vw,42rem)] max-h-[85vh] overflow-y-auto rounded-xl shadow-2xl p-6 ${pick(NOTE_STYLES, expandedNote.id).bg}`}>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-sm font-bold text-zinc-800">{expandedNote.owner_name}</span>
              <span className="text-xs text-zinc-600/70">
                {new Date(expandedNote.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
              <button type="button" onClick={e => onMenuButton(e, expandedNote.id)} title="Note options" className="ml-auto text-zinc-600 hover:text-zinc-900 transition-colors">
                <MoreVertical className="size-4" />
              </button>
              <button type="button" onClick={() => setExpandedNoteId(null)} className="text-zinc-600 hover:text-zinc-900 transition-colors">
                <X className="size-4" />
              </button>
            </div>
            <div onClick={e => handleContentClick(e, expandedNote)} className="[&_img]:cursor-zoom-in">
              <Markdown text={linkify ? linkify(expandedNote.content) : expandedNote.content} tone="paper" size="sm" onInternalLink={onInternalLink} />
            </div>
          </div>
        </Modal>
      )}

      {/* Image lightbox — reachable from either the small card or the
          expanded note above. */}
      {lightboxImage && (
        <Modal onClose={() => setLightboxImage(null)}>
          <img src={lightboxImage} alt="" className="max-w-[92vw] max-h-[92vh] rounded-lg shadow-2xl object-contain" />
        </Modal>
      )}
    </div>
  )
}
