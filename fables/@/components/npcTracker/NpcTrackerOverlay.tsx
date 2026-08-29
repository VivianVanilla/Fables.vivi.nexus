// ════════════════════════════════════════════════════════════════════════════
// NpcTrackerOverlay.tsx — full-screen "shelf" of NPCs the party has met.
// One entry is expanded into a full card (art, details, last-seen, goal) at
// a time; the rest collapse to name-only spines below it, click to swap
// which one's open — a bookshelf, not an accordion-per-item list. Shared
// party resource: anyone can add/edit/delete any entry, same as map pins.
// ════════════════════════════════════════════════════════════════════════════

import { useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useNavigate } from "react-router-dom"
import { Plus, Pencil, Trash2, X, Check, ImagePlus, Loader2, BookOpen, MapPin, StickyNote } from "lucide-react"
import { Markdown } from "../ui/Markdown"
import { uploadUserImage, loadUserImages, type GalleryImage } from "../shared/imageGallery"
import { PortraitModal } from "../shared/PortraitModal"
import { MAP_PARTY_CODE } from "../shared/constants"
import { MapNotesPanel } from "../map/MapNotesPanel"
import { linkifyMentions } from "../shared/wikiLinks"
import { useObjects } from "../../../src/contexts/UserContext"
import { useNpcTrackers, linkifyNpcMentions, type NpcTracker, type NpcTrackerDraft } from "./useNpcTrackers"
import { NpcQuickViewModal } from "./NpcQuickViewModal"

const BLANK_DRAFT: NpcTrackerDraft = { name: "New NPC", subtitle: "", details: "", image_url: "", goal: "", location_pin_id: null }

export function NpcTrackerOverlay({
  partyCode, currentUserId, currentUserName, onClose, focusNpcId,
}: {
  partyCode: string
  currentUserId: string
  currentUserName: string
  onClose: () => void
  // Set when opened via "jump to this NPC's tracker" (see MapPinViewer's
  // "last seen here" list) — expands straight to that entry instead of
  // landing on the plain unopened shelf.
  focusNpcId?: string | null
}) {
  const { npcs, pins, notesForNpc, createNpc, updateNpc, deleteNpc, addNpcNote, editNpcNote, deleteNpcNote } = useNpcTrackers(partyCode, currentUserId)
  const navigate = useNavigate()
  // Detail Notes' [[Name]] mentions resolve against this party's NPCs (see
  // openQuickView below) as well as the viewer's own notes/characters —
  // scoped to their own objects (owner-scoped RLS) so this never exposes
  // another party member's private content, same as an unmatched mention.
  const linkableObjects = useObjects().filter(o => o.type === "note" || o.type === "character")
  const [detailNotesId, setDetailNotesId] = useState<string | null>(null)
  const [quickViewId, setQuickViewId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(focusNpcId ?? null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<NpcTrackerDraft>(BLANK_DRAFT)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [showImagePicker, setShowImagePicker] = useState(false)
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([])
  const [galleryLoading, setGalleryLoading] = useState(false)
  const imageInputRef = useRef<HTMLInputElement | null>(null)

  // Adjusted during render (React's sanctioned alternative to a
  // useEffect-based sync) rather than an effect — jumping here from a
  // different NPC's "last seen here" list re-mounts a *new* focusNpcId, and
  // this re-expands to it a render early instead of flashing whatever was
  // last expanded first.
  const [lastFocusNpcId, setLastFocusNpcId] = useState(focusNpcId)
  if (focusNpcId !== lastFocusNpcId) {
    setLastFocusNpcId(focusNpcId)
    if (focusNpcId) setExpandedId(focusNpcId)
  }

  const sorted = [...npcs].sort((a, b) => a.name.localeCompare(b.name))
  const expanded = sorted.find(n => n.id === expandedId) ?? null
  const showLocation = partyCode === MAP_PARTY_CODE
  const detailNotesNpc = sorted.find(n => n.id === detailNotesId) ?? null
  const quickViewNpc = sorted.find(n => n.id === quickViewId) ?? null

  // A `[[Name]]` mention (see linkifyNpcMentions) resolves to another NPC on
  // this same shelf — clicking it pops a small self-contained quick-view
  // modal on top rather than disturbing whatever's already open underneath
  // (the shelf, an expanded card, Detail Notes, …).
  function openQuickView(target: string) {
    if (!target.startsWith("npc:")) return
    const id = target.slice("npc:".length)
    if (sorted.some(n => n.id === id)) setQuickViewId(id)
  }

  // Detail Notes' version of the above — also handles "object:" links (a
  // note/character mentioned from an NPC's notes), which just navigates
  // straight to it rather than popping a modal.
  function handleDetailNotesLink(target: string) {
    if (target.startsWith("object:")) {
      navigate(`/dashboard?open=${encodeURIComponent(target.slice("object:".length))}`)
      return
    }
    openQuickView(target)
  }

  function startEdit(npc: NpcTracker) {
    setEditingId(npc.id)
    setDraft({ name: npc.name, subtitle: npc.subtitle ?? "", details: npc.details ?? "", image_url: npc.image_url ?? "", goal: npc.goal ?? "", location_pin_id: npc.location_pin_id })
  }

  function saveEdit() {
    if (!editingId || !draft.name.trim()) return
    updateNpc(editingId, { ...draft, name: draft.name.trim() })
    setEditingId(null)
  }

  async function addNpc() {
    const row = await createNpc(BLANK_DRAFT)
    if (!row) return
    setExpandedId(row.id)
    startEdit(row)
  }

  async function openImagePicker() {
    setShowImagePicker(true)
    setGalleryLoading(true)
    setGalleryImages(await loadUserImages(currentUserId))
    setGalleryLoading(false)
  }

  async function uploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingImage(true)
    const url = await uploadUserImage(currentUserId, file)
    setUploadingImage(false)
    e.target.value = ""
    if (url) setDraft(d => ({ ...d, image_url: url }))
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="px-4 py-3 border-b border-border shrink-0 flex items-center gap-2">
        <BookOpen className="size-4 text-muted-foreground" />
        <span className="text-sm font-bold text-foreground">NPC Tracker</span>
        <button type="button" onClick={addNpc}
          className="ml-3 flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg bg-foreground/8 hover:bg-foreground/15 text-foreground/80 transition-colors">
          <Plus className="size-3.5" /> New NPC
        </button>
        <div className="flex-1" />
        <button type="button" onClick={onClose} title="Close (Esc)"
          className="size-7 flex items-center justify-center rounded-lg bg-foreground/8 hover:bg-foreground/15 text-foreground/70 transition-colors">
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
          {sorted.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground/60 italic text-center mt-10">No NPCs tracked yet — add one to start the shelf.</p>
          )}

          {sorted.map(npc => {
            const isExpanded = expanded?.id === npc.id
            const isEditing = editingId === npc.id
            const isConfirmingDelete = confirmingDeleteId === npc.id

            if (!isExpanded) {
              const cityName = showLocation ? pins.find(p => p.id === npc.location_pin_id)?.name : undefined
              return (
                <button key={npc.id} type="button" onClick={() => setExpandedId(npc.id)}
                  className="flex flex-col items-center text-center gap-1.5 px-3 py-3 rounded-lg bg-foreground/5 hover:bg-foreground/10 border border-border transition-colors">
                  <div className="size-16 rounded-full overflow-hidden bg-foreground/10 flex items-center justify-center shrink-0">
                    {npc.image_url ? (
                      <img src={npc.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <BookOpen className="size-6 text-muted-foreground/30" />
                    )}
                  </div>
                  <span className="text-xs font-semibold text-foreground truncate w-full">{npc.name}</span>
                  {npc.subtitle && <span className="text-[10px] text-muted-foreground/60 truncate w-full">{npc.subtitle}</span>}
                  {cityName && (
                    <span className="flex items-center gap-1 text-[9px] text-violet-300/80 shrink-0">
                      <MapPin className="size-2.5" /> {cityName}
                    </span>
                  )}
                </button>
              )
            }

            return (
              <div key={npc.id} className="col-span-full rounded-xl bg-foreground/5 border border-border shadow-lg overflow-hidden">
                <div className="flex items-start gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <input autoFocus value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                        placeholder="Name"
                        className="w-full text-xl font-bold bg-foreground/8 rounded-lg px-2.5 py-1.5 outline-none text-foreground mb-1.5" />
                    ) : (
                      <h2 className="text-xl font-bold text-foreground">{npc.name}</h2>
                    )}
                    {isEditing ? (
                      <input value={draft.subtitle ?? ""} onChange={e => setDraft(d => ({ ...d, subtitle: e.target.value }))}
                        placeholder="Race, class, role…"
                        className="w-full text-sm italic bg-foreground/8 rounded-lg px-2.5 py-1.5 outline-none text-muted-foreground mb-2" />
                    ) : (
                      npc.subtitle && <p className="text-sm italic text-muted-foreground mb-2">{npc.subtitle}</p>
                    )}
                    {isEditing ? (
                      <textarea value={draft.details ?? ""} onChange={e => setDraft(d => ({ ...d, details: e.target.value }))}
                        placeholder="Details — appearance, personality, history… Type [[Name]] to link another NPC." rows={5}
                        className="w-full resize-none text-sm bg-foreground/8 rounded-lg px-2.5 py-1.5 outline-none text-foreground leading-relaxed" />
                    ) : npc.details ? (
                      <Markdown text={linkifyNpcMentions(npc.details, sorted)} tone="auto" size="sm" onInternalLink={openQuickView} />
                    ) : (
                      <p className="text-sm text-muted-foreground/40 italic">No details yet.</p>
                    )}
                    <button type="button" onClick={() => setDetailNotesId(npc.id)}
                      className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 mt-3 rounded-lg bg-foreground/8 hover:bg-foreground/15 text-foreground/70 transition-colors">
                      <StickyNote className="size-3.5" />
                      Detail Notes {notesForNpc(npc.id).length > 0 && `(${notesForNpc(npc.id).length})`}
                    </button>
                  </div>

                  <div className="w-40 shrink-0 flex flex-col gap-3">
                    <button type="button" onClick={isEditing ? openImagePicker : undefined} disabled={!isEditing}
                      className={`aspect-square w-full rounded-lg overflow-hidden bg-foreground/10 border border-border flex items-center justify-center ${isEditing ? "hover:border-foreground/40 cursor-pointer" : ""} transition-colors`}>
                      {(isEditing ? draft.image_url : npc.image_url) ? (
                        <img src={(isEditing ? draft.image_url : npc.image_url) ?? ""} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <ImagePlus className="size-5 text-muted-foreground/40" />
                      )}
                    </button>
                    {showLocation && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50 mb-0.5">Last Seen At</p>
                        {isEditing ? (
                          // Native <select> popups render with their own
                          // (usually light) system background regardless of
                          // page theme — force dark <option> text explicitly
                          // so it doesn't end up light-on-light there even
                          // though text-foreground reads fine on the closed,
                          // app-themed control itself.
                          <select value={draft.location_pin_id ?? ""} onChange={e => setDraft(d => ({ ...d, location_pin_id: e.target.value || null }))}
                            className="w-full text-xs bg-foreground/8 rounded-md px-2 py-1 outline-none text-foreground">
                            <option value="" className="text-black">— None —</option>
                            {pins.map(p => <option key={p.id} value={p.id} className="text-black">{p.name}</option>)}
                          </select>
                        ) : (
                          <p className="flex items-center gap-1 text-xs text-foreground/80">
                            {npc.location_pin_id && <MapPin className="size-3 text-violet-300/80 shrink-0" />}
                            {pins.find(p => p.id === npc.location_pin_id)?.name ?? "—"}
                          </p>
                        )}
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50 mb-0.5">Goal? How can they help?</p>
                      {isEditing ? (
                        <textarea value={draft.goal ?? ""} onChange={e => setDraft(d => ({ ...d, goal: e.target.value }))} rows={2}
                          className="w-full resize-none text-xs bg-foreground/8 rounded-md px-2 py-1 outline-none text-foreground" />
                      ) : (
                        <p className="text-xs text-foreground/80">{npc.goal || "—"}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-foreground/5">
                  <button type="button" onClick={() => setExpandedId(null)}
                    className="text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors">Collapse</button>
                  <div className="flex items-center gap-1.5">
                    {isEditing ? (
                      <>
                        <button type="button" onClick={() => setEditingId(null)}
                          className="text-[11px] px-2.5 py-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                        <button type="button" onClick={saveEdit} disabled={!draft.name.trim()}
                          className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg bg-violet-500/80 hover:bg-violet-500 text-white font-semibold disabled:opacity-40 transition-colors">
                          <Check className="size-3.5" /> Save
                        </button>
                      </>
                    ) : isConfirmingDelete ? (
                      <>
                        <span className="text-[11px] text-muted-foreground/70 mr-1">Delete this NPC?</span>
                        <button type="button" onClick={() => { deleteNpc(npc.id); setConfirmingDeleteId(null); setExpandedId(null) }}
                          className="text-[11px] px-2.5 py-1.5 rounded-lg bg-red-500/80 hover:bg-red-500 text-white font-semibold transition-colors">Delete</button>
                        <button type="button" onClick={() => setConfirmingDeleteId(null)}
                          className="text-[11px] px-2.5 py-1.5 rounded-lg bg-foreground/8 hover:bg-foreground/15 text-foreground/70 transition-colors">Cancel</button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => startEdit(npc)} title="Edit"
                          className="size-7 flex items-center justify-center rounded-lg hover:bg-foreground/10 text-foreground/60 hover:text-foreground transition-colors">
                          <Pencil className="size-3.5" />
                        </button>
                        <button type="button" onClick={() => setConfirmingDeleteId(npc.id)} title="Delete"
                          className="size-7 flex items-center justify-center rounded-lg hover:bg-red-500/15 text-foreground/60 hover:text-red-400 transition-colors">
                          <Trash2 className="size-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {showImagePicker && (
        <PortraitModal
          title="Choose NPC Art"
          currentPortrait={draft.image_url ?? undefined}
          galleryImages={galleryImages}
          galleryLoading={galleryLoading}
          onChoose={url => { setDraft(d => ({ ...d, image_url: url })); setShowImagePicker(false) }}
          onUploadClick={() => imageInputRef.current?.click()}
          onClose={() => setShowImagePicker(false)}
        />
      )}
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={uploadImage} />
      {uploadingImage && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 text-white text-xs shadow-xl">
          <Loader2 className="size-3.5 animate-spin" /> Uploading…
        </div>
      )}

      {/* Detail Notes — the cramped single "Details" textarea above is for a
          short blurb; this is the full sticky-note corkboard (same
          component pins/trackers use) for actual session-to-session notes,
          in its own full-screen layer so there's real room for it. */}
      {/* backdrop-blur-xs, not -sm, below — lighter compositing/blur cost, see Modal.tsx */}
      {detailNotesNpc && createPortal(
        <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-xs" onClick={() => setDetailNotesId(null)}>
          <div className="flex items-center justify-between px-5 py-3 shrink-0" onClick={e => e.stopPropagation()}>
            <span className="text-sm font-semibold text-white">Detail Notes — {detailNotesNpc.name}</span>
            <button type="button" onClick={() => setDetailNotesId(null)} className="text-white/60 hover:text-white text-lg leading-none px-1">✕</button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-5" onClick={e => e.stopPropagation()}>
            <MapNotesPanel
              notes={notesForNpc(detailNotesNpc.id)}
              currentUserId={currentUserId}
              placeholder={`Detail notes about ${detailNotesNpc.name}…`}
              onAddNote={content => addNpcNote(detailNotesNpc.id, currentUserName, content)}
              onEditNote={editNpcNote}
              onDeleteNote={deleteNpcNote}
              linkify={text => linkifyMentions(linkifyNpcMentions(text, sorted), linkableObjects, "object")}
              onInternalLink={handleDetailNotesLink}
            />
          </div>
        </div>,
        document.body
      )}

      {/* Quick-view popup for a clicked `[[Name]]` mention — rendered last so
          it paints on top of everything above, including Detail Notes when
          both happen to be open at once. */}
      {quickViewNpc && (
        <NpcQuickViewModal
          npc={quickViewNpc}
          npcs={sorted}
          locationName={showLocation ? pins.find(p => p.id === quickViewNpc.location_pin_id)?.name ?? null : null}
          onClose={() => setQuickViewId(null)}
          onSelectNpc={setQuickViewId}
        />
      )}
    </div>,
    document.body
  )
}
