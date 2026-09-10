// ════════════════════════════════════════════════════════════════════════════
// MysteriousPagesOverlay.tsx — full-screen notebook for the party: a flat
// ordered deck of pages (an uploaded image, or a block of markdown text),
// one shown at a time, flipped through with ‹ › / arrow keys / the
// thumbnail strip. Anyone in the party can add pages and pin sticky notes
// onto them — each note tethered to a point on the page by a thin colored
// line whose end you can drag. Shared party resource, same as the map / NPC
// Tracker; opened from the party rail (party/PartyServer.tsx), KOQK21 only.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  NotebookPen, X, Plus, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Trash2, ImagePlus, Type, StickyNote, Pencil, Loader2,
} from "lucide-react"
import { Markdown } from "../ui/Markdown"
import { MarkdownTextarea } from "../ui/MarkdownTextarea"
import { Modal } from "../shared/ui/Modal"
import { PortraitModal } from "../shared/PortraitModal"
import { uploadUserImage, loadUserImages, type GalleryImage } from "../shared/imageGallery"
import { useMysteriousPages, type MysteriousPage, type MysteriousPageNote } from "./useMysteriousPages"

const NOTE_COLORS = ["#fcd34d", "#fb7185", "#38bdf8", "#a3e635", "#c084fc", "#fb923c", "#2dd4bf", "#f472b6"]

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

function hexToRgba(hex: string, a: number) {
  const h = hex.replace("#", "")
  const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h
  const n = parseInt(full, 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

// Live position during a drag — overrides the row's stored coords for the
// one note being moved, so the line and card track the pointer smoothly.
type DragState = { id: string; mode: "note" | "anchor"; x: number; y: number }

export function MysteriousPagesOverlay({
  partyCode, currentUserId, currentUserName, onClose,
}: {
  partyCode: string
  currentUserId: string
  currentUserName: string
  onClose: () => void
}) {
  const {
    pages, notesForPage, loaded,
    createImagePage, createTextPage, updatePage, deletePage, reorderPage,
    addNote, updateNote, deleteNote,
  } = useMysteriousPages(partyCode, currentUserId)

  // Selection is by page id, not index — a deleted/reordered page then just
  // resolves to page 0 / stays put with no index-fixup effect needed.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [showImagePicker, setShowImagePicker] = useState(false)
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([])
  const [galleryLoading, setGalleryLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  // null = closed · "new" = creating a page · <id> = editing that page's text
  const [textComposer, setTextComposer] = useState<null | "new" | string>(null)
  const [textDraft, setTextDraft] = useState("")
  const [confirmDeletePage, setConfirmDeletePage] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState("")
  const [drag, setDrag] = useState<DragState | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)

  const pageIdx = Math.max(0, pages.findIndex(p => p.id === selectedId))
  const page: MysteriousPage | undefined = pages[pageIdx]
  const pageNotes = page ? notesForPage(page.id) : []

  // Reset per-page transient UI when the shown page changes — render-phase
  // adjustment (React's sanctioned alternative to an effect), same pattern
  // as NpcTrackerOverlay's focusNpcId sync.
  const [prevPageId, setPrevPageId] = useState(page?.id)
  if (page?.id !== prevPageId) {
    setPrevPageId(page?.id)
    setConfirmDeletePage(false)
    setEditingNoteId(null)
  }

  function goToPage(i: number) {
    const target = pages[Math.min(pages.length - 1, Math.max(0, i))]
    if (target) setSelectedId(target.id)
  }

  // Close the Add-Page menu on any outside click (deferred one tick so the
  // opening click doesn't immediately re-close it).
  useEffect(() => {
    if (!addMenuOpen) return
    const close = () => setAddMenuOpen(false)
    const t = setTimeout(() => document.addEventListener("click", close), 0)
    return () => { clearTimeout(t); document.removeEventListener("click", close) }
  }, [addMenuOpen])

  // Esc closes the overlay; ←/→ flip pages (never while typing / composing).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement
      const typing = t.tagName === "INPUT" || t.tagName === "TEXTAREA"
      if (e.key === "Escape" && !typing && textComposer == null) { onClose(); return }
      if (typing || textComposer != null) return
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
      setSelectedId(cur => {
        const i = Math.max(0, pages.findIndex(p => p.id === cur))
        const next = pages[Math.min(pages.length - 1, Math.max(0, i + (e.key === "ArrowLeft" ? -1 : 1)))]
        return next ? next.id : cur
      })
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [pages, textComposer, onClose])

  async function openImagePicker() {
    setAddMenuOpen(false)
    setShowImagePicker(true)
    setGalleryLoading(true)
    setGalleryImages(await loadUserImages(currentUserId))
    setGalleryLoading(false)
  }

  async function onImageChosen(url: string) {
    setShowImagePicker(false)
    const row = await createImagePage(url)
    if (row) setSelectedId(row.id)
  }

  async function onUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setUploading(true)
    const url = await uploadUserImage(currentUserId, file)
    setUploading(false)
    if (!url) return
    setShowImagePicker(false)
    const row = await createImagePage(url)
    if (row) setSelectedId(row.id)
  }

  async function submitText() {
    const body = textDraft.trim()
    if (!body) return
    if (textComposer === "new") {
      const row = await createTextPage(body)
      if (row) setSelectedId(row.id)
    } else if (textComposer) {
      await updatePage(textComposer, { text_content: body })
    }
    setTextComposer(null)
  }

  function commitTitle(value: string) {
    if (!page) return
    const t = value.trim()
    if (t !== (page.title ?? "")) updatePage(page.id, { title: t || null })
  }

  async function onAddNote() {
    if (!page) return
    const color = NOTE_COLORS[pageNotes.length % NOTE_COLORS.length]
    const row = await addNote(page.id, currentUserName, color)
    if (row) { setEditingNoteId(row.id); setNoteDraft("") }
  }

  // Normalized (0..1) position of a note's card / anchor, drag override applied.
  function notePos(n: MysteriousPageNote) {
    const d = drag && drag.id === n.id ? drag : null
    return {
      nx: d?.mode === "note" ? d.x : n.note_x,
      ny: d?.mode === "note" ? d.y : n.note_y,
      ax: d?.mode === "anchor" ? d.x : n.anchor_x,
      ay: d?.mode === "anchor" ? d.y : n.anchor_y,
    }
  }

  function startNoteDrag(e: React.PointerEvent, note: MysteriousPageNote, mode: "note" | "anchor") {
    if (editingNoteId === note.id) return
    e.preventDefault()
    const stage = stageRef.current
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    const toNorm = (cx: number, cy: number) => ({
      x: clamp01((cx - rect.left) / rect.width),
      y: clamp01((cy - rect.top) / rect.height),
    })
    const move = (ev: PointerEvent) => setDrag({ id: note.id, mode, ...toNorm(ev.clientX, ev.clientY) })
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      const p = toNorm(ev.clientX, ev.clientY)
      updateNote(note.id, mode === "note" ? { note_x: p.x, note_y: p.y } : { anchor_x: p.x, anchor_y: p.y })
      setDrag(null)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  const addButtons = (
    <>
      <button type="button" onClick={openImagePicker}
        className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-foreground/8 hover:bg-foreground/15 text-foreground/80 transition-colors">
        <ImagePlus className="size-3.5" /> Upload image
      </button>
      <button type="button" onClick={() => { setAddMenuOpen(false); setTextComposer("new"); setTextDraft("") }}
        className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-foreground/8 hover:bg-foreground/15 text-foreground/80 transition-colors">
        <Type className="size-3.5" /> Text page
      </button>
    </>
  )

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0 flex items-center gap-2">
        <NotebookPen className="size-4 text-muted-foreground" />
        <span className="text-sm font-bold text-foreground">Mysterious Pages</span>

        <div className="relative ml-3">
          <button type="button" onClick={() => setAddMenuOpen(o => !o)}
            className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg bg-foreground/8 hover:bg-foreground/15 text-foreground/80 transition-colors">
            <Plus className="size-3.5" /> Add Page
          </button>
          {addMenuOpen && (
            <div className="absolute left-0 top-full mt-1 z-10 flex flex-col gap-1 p-1 w-40 rounded-lg border border-border bg-background shadow-xl">
              {addButtons}
            </div>
          )}
        </div>

        <div className="flex-1" />
        {pages.length > 0 && (
          <span className="text-[11px] text-muted-foreground tabular-nums">{pageIdx + 1} / {pages.length}</span>
        )}
        <button type="button" onClick={onClose} title="Close (Esc)"
          className="size-7 flex items-center justify-center rounded-lg bg-foreground/8 hover:bg-foreground/15 text-foreground/70 transition-colors">
          <X className="size-4" />
        </button>
      </div>

      {/* Stage */}
      <div className="flex-1 min-h-0 flex items-center justify-center overflow-auto p-4">
        {!loaded ? (
          <p className="text-sm text-muted-foreground/60 italic">Loading…</p>
        ) : pages.length === 0 ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <NotebookPen className="size-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground/60 italic">No pages yet — add an image or some text to start the book.</p>
            <div className="flex gap-2">{addButtons}</div>
          </div>
        ) : page ? (
          <div className="flex flex-col items-center gap-3">
            <input
              key={page.id}
              defaultValue={page.title ?? ""}
              onBlur={e => commitTitle(e.currentTarget.value)}
              onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur() }}
              placeholder="Untitled page"
              className="text-center text-sm font-semibold bg-transparent text-foreground/80 outline-none border-b border-transparent focus:border-border px-2 py-0.5 w-64 placeholder:text-muted-foreground/40"
            />

            {/* w-fit so this box hugs the page content exactly (the image at
                its rendered size, or the fixed-width text card) — the notes
                layer below is absolute inset-0 against it. */}
            <div ref={stageRef} className="relative w-fit">
              {page.kind === "image" && page.image_url ? (
                <img src={page.image_url} alt={page.title ?? ""} draggable={false}
                  className="block max-h-[calc(100vh-13rem)] max-w-[calc(100vw-2rem)] w-auto h-auto rounded-lg select-none" />
              ) : (
                <div className="rounded-lg bg-[#f5f3ec] text-zinc-800 shadow-lg p-6 w-[min(640px,calc(100vw-2rem))] max-h-[calc(100vh-13rem)] overflow-auto">
                  {page.text_content?.trim()
                    ? <Markdown text={page.text_content} tone="paper" />
                    : <p className="text-sm italic text-zinc-500">Empty page — use “Edit Text” below.</p>}
                </div>
              )}

              {/* connector lines — one SVG in normalized 0..1 space stretched
                  over the whole page box; non-scaling stroke keeps them thin */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
                viewBox="0 0 1 1" preserveAspectRatio="none">
                {pageNotes.map(n => {
                  const { nx, ny, ax, ay } = notePos(n)
                  return <line key={n.id} x1={nx} y1={ny} x2={ax} y2={ay}
                    stroke={n.color} strokeWidth={1.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                })}
              </svg>

              {/* draggable anchor dots (the end the line points at) */}
              {pageNotes.map(n => {
                const { ax, ay } = notePos(n)
                return (
                  <div key={`a-${n.id}`}
                    onPointerDown={e => startNoteDrag(e, n, "anchor")}
                    title="Drag to re-point"
                    className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow cursor-move touch-none"
                    style={{ left: `${ax * 100}%`, top: `${ay * 100}%`, backgroundColor: n.color }} />
                )
              })}

              {/* sticky notes */}
              {pageNotes.map(n => {
                const { nx, ny } = notePos(n)
                return (
                  <PageNote key={n.id} note={n} x={nx} y={ny}
                    editing={editingNoteId === n.id}
                    draft={noteDraft} setDraft={setNoteDraft}
                    onStartDrag={e => startNoteDrag(e, n, "note")}
                    onEdit={() => { setEditingNoteId(n.id); setNoteDraft(n.content) }}
                    onSave={() => { updateNote(n.id, { content: noteDraft }); setEditingNoteId(null) }}
                    onCancel={() => setEditingNoteId(null)}
                    onColor={c => updateNote(n.id, { color: c })}
                    onDelete={() => deleteNote(n.id)}
                  />
                )
              })}
            </div>
          </div>
        ) : null}
      </div>

      {/* Footer — page tools + thumbnail strip */}
      {pages.length > 0 && page && (
        <div className="border-t border-border shrink-0 px-4 py-2 flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={() => goToPage(pageIdx - 1)} disabled={pageIdx === 0}
              className="size-8 flex items-center justify-center rounded-lg bg-foreground/8 hover:bg-foreground/15 disabled:opacity-30 text-foreground/70">
              <ChevronLeft className="size-4" />
            </button>

            <button type="button" onClick={onAddNote}
              className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg bg-foreground/8 hover:bg-foreground/15 text-foreground/80">
              <StickyNote className="size-3.5" /> Note
            </button>
            {page.kind === "text" && (
              <button type="button" onClick={() => { setTextComposer(page.id); setTextDraft(page.text_content ?? "") }}
                className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg bg-foreground/8 hover:bg-foreground/15 text-foreground/80">
                <Pencil className="size-3.5" /> Edit Text
              </button>
            )}

            <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60 pl-1">
              Move
              <button type="button" onClick={() => reorderPage(page.id, -1)} disabled={pageIdx === 0} title="Move page earlier"
                className="size-7 flex items-center justify-center rounded-lg bg-foreground/8 hover:bg-foreground/15 disabled:opacity-30 text-foreground/70">
                <ChevronsLeft className="size-3.5" />
              </button>
              <button type="button" onClick={() => reorderPage(page.id, 1)} disabled={pageIdx === pages.length - 1} title="Move page later"
                className="size-7 flex items-center justify-center rounded-lg bg-foreground/8 hover:bg-foreground/15 disabled:opacity-30 text-foreground/70">
                <ChevronsRight className="size-3.5" />
              </button>
            </div>

            {confirmDeletePage ? (
              <span className="flex items-center gap-1.5 text-[11px]">
                <span className="text-muted-foreground/70">Delete page?</span>
                <button type="button" onClick={() => { deletePage(page.id); setConfirmDeletePage(false) }}
                  className="px-2 py-1 rounded-lg bg-red-500/80 hover:bg-red-500 text-white font-semibold">Delete</button>
                <button type="button" onClick={() => setConfirmDeletePage(false)}
                  className="px-2 py-1 rounded-lg bg-foreground/8 hover:bg-foreground/15 text-foreground/70">Cancel</button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmDeletePage(true)} title="Delete page"
                className="size-8 flex items-center justify-center rounded-lg hover:bg-red-500/15 text-foreground/60 hover:text-red-400">
                <Trash2 className="size-3.5" />
              </button>
            )}

            <div className="flex-1" />
            <button type="button" onClick={() => goToPage(pageIdx + 1)} disabled={pageIdx === pages.length - 1}
              className="size-8 flex items-center justify-center rounded-lg bg-foreground/8 hover:bg-foreground/15 disabled:opacity-30 text-foreground/70">
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {pages.map((p, i) => (
              <button key={p.id} type="button" onClick={() => setSelectedId(p.id)}
                className={`shrink-0 size-12 rounded-md overflow-hidden border-2 flex items-center justify-center bg-foreground/5 transition-colors ${i === pageIdx ? "border-primary" : "border-transparent hover:border-foreground/30"}`}>
                {p.kind === "image" && p.image_url
                  ? <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                  : <Type className="size-4 text-muted-foreground/50" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Image picker */}
      {showImagePicker && (
        <PortraitModal
          title="Choose Page Image"
          galleryImages={galleryImages}
          galleryLoading={galleryLoading}
          onChoose={onImageChosen}
          onUploadClick={() => imageInputRef.current?.click()}
          onClose={() => setShowImagePicker(false)}
        />
      )}
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={onUploadFile} />
      {uploading && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 text-white text-xs shadow-xl">
          <Loader2 className="size-3.5 animate-spin" /> Uploading…
        </div>
      )}

      {/* Text page composer */}
      {textComposer != null && (
        <Modal onClose={() => setTextComposer(null)}>
          <div className="bg-zinc-900 border border-white/15 rounded-2xl shadow-2xl w-[min(560px,calc(100vw-2rem))] max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
              <p className="text-sm font-bold text-white">{textComposer === "new" ? "New Text Page" : "Edit Text Page"}</p>
              <button type="button" onClick={() => setTextComposer(null)}
                className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white">✕</button>
            </div>
            <div className="p-4 flex flex-col gap-3 overflow-y-auto">
              <MarkdownTextarea
                value={textDraft} onChange={setTextDraft} autoFocus userId={currentUserId} rows={12}
                placeholder="Write or paste the page's text… markdown supported."
                className="w-full resize-none bg-white/5 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-white/30 leading-relaxed"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setTextComposer(null)}
                  className="px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white">Cancel</button>
                <button type="button" onClick={submitText} disabled={!textDraft.trim()}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-500/80 hover:bg-violet-500 text-white disabled:opacity-40">
                  {textComposer === "new" ? "Add Page" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>,
    document.body,
  )
}

function PageNote({
  note, x, y, editing, draft, setDraft,
  onStartDrag, onEdit, onSave, onCancel, onColor, onDelete,
}: {
  note: MysteriousPageNote
  x: number
  y: number
  editing: boolean
  draft: string
  setDraft: (v: string) => void
  onStartDrag: (e: React.PointerEvent) => void
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  onColor: (c: string) => void
  onDelete: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div
      className="absolute w-44 -translate-x-1/2 -translate-y-1/2 rounded-lg shadow-xl border text-zinc-800"
      style={{ left: `${x * 100}%`, top: `${y * 100}%`, backgroundColor: hexToRgba(note.color, 0.18), borderColor: note.color }}
    >
      <div
        onPointerDown={editing ? undefined : onStartDrag}
        className={`h-5 rounded-t-lg flex items-center justify-between px-1.5 ${editing ? "" : "cursor-move touch-none"}`}
        style={{ backgroundColor: note.color }}
      >
        <span className="text-[9px] font-semibold text-zinc-900/70 truncate">{note.owner_name}</span>
        {!editing && !confirmDelete && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button type="button" onClick={onEdit} title="Edit"
              className="size-4 flex items-center justify-center rounded hover:bg-black/10 text-zinc-900/60">
              <Pencil className="size-2.5" />
            </button>
            <button type="button" onClick={() => setConfirmDelete(true)} title="Delete"
              className="size-4 flex items-center justify-center rounded hover:bg-black/10 text-zinc-900/60">
              <Trash2 className="size-2.5" />
            </button>
          </div>
        )}
      </div>

      <div className="p-2 text-xs">
        {editing ? (
          <div className="flex flex-col gap-1.5">
            <textarea
              value={draft} onChange={e => setDraft(e.target.value)} autoFocus rows={4}
              placeholder="Note… (markdown ok)"
              className="w-full resize-none bg-white/70 rounded px-1.5 py-1 text-xs text-zinc-800 outline-none border border-zinc-900/15"
            />
            <div className="flex items-center gap-1 flex-wrap">
              {NOTE_COLORS.map(c => (
                <button key={c} type="button" onClick={() => onColor(c)}
                  className={`size-3.5 rounded-full border ${note.color === c ? "border-zinc-800" : "border-white/60"}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
            <div className="flex justify-end gap-1">
              <button type="button" onClick={onCancel} className="px-1.5 py-0.5 rounded text-[10px] text-zinc-600 hover:text-zinc-900">Cancel</button>
              <button type="button" onClick={onSave} className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-800 text-white">Save</button>
            </div>
          </div>
        ) : confirmDelete ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-zinc-700">Delete this note?</span>
            <div className="flex justify-end gap-1">
              <button type="button" onClick={() => setConfirmDelete(false)} className="px-1.5 py-0.5 rounded text-[10px] text-zinc-600">Cancel</button>
              <button type="button" onClick={onDelete} className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-500 text-white">Delete</button>
            </div>
          </div>
        ) : note.content.trim() ? (
          <div className="max-h-32 overflow-auto">
            <Markdown text={note.content} tone="paper" size="xs" />
          </div>
        ) : (
          <p className="text-[10px] italic text-zinc-500">Empty note — ✎ to write.</p>
        )}
      </div>
    </div>
  )
}
