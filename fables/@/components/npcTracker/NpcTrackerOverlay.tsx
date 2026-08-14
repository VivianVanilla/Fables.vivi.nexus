// ════════════════════════════════════════════════════════════════════════════
// NpcTrackerOverlay.tsx — full-screen "shelf" of NPCs the party has met.
// One entry is expanded into a full card (art, details, last-seen, goal) at
// a time; the rest collapse to name-only spines below it, click to swap
// which one's open — a bookshelf, not an accordion-per-item list. Shared
// party resource: anyone can add/edit/delete any entry, same as map pins.
// ════════════════════════════════════════════════════════════════════════════

import { useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Plus, Pencil, Trash2, X, Check, ImagePlus, Loader2, BookOpen } from "lucide-react"
import { Markdown } from "../ui/Markdown"
import { uploadUserImage, loadUserImages, type GalleryImage } from "../shared/imageGallery"
import { PortraitModal } from "../shared/PortraitModal"
import { useNpcTrackers, type NpcTracker, type NpcTrackerDraft } from "./useNpcTrackers"

const BLANK_DRAFT: NpcTrackerDraft = { name: "New NPC", subtitle: "", details: "", image_url: "", last_seen: "", goal: "" }

export function NpcTrackerOverlay({
  partyCode, currentUserId, onClose,
}: {
  partyCode: string
  currentUserId: string
  onClose: () => void
}) {
  const { npcs, createNpc, updateNpc, deleteNpc } = useNpcTrackers(partyCode, currentUserId)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<NpcTrackerDraft>(BLANK_DRAFT)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [showImagePicker, setShowImagePicker] = useState(false)
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([])
  const [galleryLoading, setGalleryLoading] = useState(false)
  const imageInputRef = useRef<HTMLInputElement | null>(null)

  const sorted = [...npcs].sort((a, b) => a.name.localeCompare(b.name))
  const expanded = sorted.find(n => n.id === expandedId) ?? null

  function startEdit(npc: NpcTracker) {
    setEditingId(npc.id)
    setDraft({ name: npc.name, subtitle: npc.subtitle ?? "", details: npc.details ?? "", image_url: npc.image_url ?? "", last_seen: npc.last_seen ?? "", goal: npc.goal ?? "" })
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
        <div className="max-w-2xl mx-auto flex flex-col gap-3">
          {sorted.length === 0 && (
            <p className="text-sm text-muted-foreground/60 italic text-center mt-10">No NPCs tracked yet — add one to start the shelf.</p>
          )}

          {sorted.map(npc => {
            const isExpanded = expanded?.id === npc.id
            const isEditing = editingId === npc.id
            const isConfirmingDelete = confirmingDeleteId === npc.id

            if (!isExpanded) {
              return (
                <button key={npc.id} type="button" onClick={() => setExpandedId(npc.id)}
                  className="w-full text-left px-4 py-2.5 rounded-lg bg-foreground/5 hover:bg-foreground/10 border border-border transition-colors flex items-center gap-2.5">
                  {npc.image_url && (
                    <img src={npc.image_url} alt="" className="size-6 rounded-full object-cover shrink-0" />
                  )}
                  <span className="text-sm font-semibold text-foreground truncate">{npc.name}</span>
                  {npc.subtitle && <span className="text-xs text-muted-foreground/60 truncate">— {npc.subtitle}</span>}
                </button>
              )
            }

            return (
              <div key={npc.id} className="rounded-xl bg-foreground/5 border border-border shadow-lg overflow-hidden">
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
                        placeholder="Details — appearance, personality, history…" rows={5}
                        className="w-full resize-none text-sm bg-foreground/8 rounded-lg px-2.5 py-1.5 outline-none text-foreground leading-relaxed" />
                    ) : npc.details ? (
                      <Markdown text={npc.details} tone="auto" size="sm" />
                    ) : (
                      <p className="text-sm text-muted-foreground/40 italic">No details yet.</p>
                    )}
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
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50 mb-0.5">Where were they seen last?</p>
                      {isEditing ? (
                        <input value={draft.last_seen ?? ""} onChange={e => setDraft(d => ({ ...d, last_seen: e.target.value }))}
                          className="w-full text-xs bg-foreground/8 rounded-md px-2 py-1 outline-none text-foreground" />
                      ) : (
                        <p className="text-xs text-foreground/80">{npc.last_seen || "—"}</p>
                      )}
                    </div>
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
    </div>,
    document.body
  )
}
