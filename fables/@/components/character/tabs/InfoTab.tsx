// ════════════════════════════════════════════════════════════════════════════
// InfoTab.tsx — Info tab with Notes / Traits / Feats / Features / Armor & Items / Profs
// ════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useMemo } from "react"
import { createPortal } from "react-dom"
import * as Y from "yjs"
import type { userInfo } from "@/types/userInfo"
import type { CharacterData, Feature, FavoriteRef, ProficiencyEntry, LinkedNoteRef } from "../../character-types"
import type { Theme } from "../../character-themes"
import { nanoid, profBonus, safeParseJson } from "../../character-utils"
import { useUserContext } from "../../../../src/contexts/UserContext"
import { Markdown } from "../../ui/Markdown"
import { MarkdownTextarea } from "../../ui/MarkdownTextarea"
import { PopTransition } from "../ui/PopTransition"
import { FeatureEntry, type SuggestionSource } from "../entries/FeatureEntry"
import { connectNoteChannel, applyTextDiff, encodeDocState, applyEncodedState } from "../../collab/noteSync"
import { useCollaboratorCandidates } from "../../collab/useCollaboratorCandidates"

// ── Types ─────────────────────────────────────────────────────────────────────

export type InfoSubTab = "overview" | "raceFeats" | "features" | "items" | "profs"

interface InfoTabProps {
  data: CharacterData
  update: (patch: Partial<CharacterData>) => void
  onChangeFeature: (id: string, patch: Partial<Feature>) => void
  onRemoveFeature: (id: string) => void
  onLinkToggle: (featureId: string, otherId: string) => void
  theme: Theme
  card: string
  readOnly: boolean
  userId?: string | null
  objects: userInfo.Objects[]
  createObject: (payload: { name: string; type: string; parent_id?: string | null; data?: Record<string, unknown> }) => Promise<userInfo.Objects>
  updateObject: (id: string, updates: userInfo.ObjectsUpdate) => Promise<userInfo.Objects>
  favorites: FavoriteRef[]
  onToggleFavorite: (id: string, label: string) => void
  onAddItemToEquipment: (feature: Feature) => void
  equipmentLinkedIds: Set<string>
  subTab: InfoSubTab
  onSubTabChange: (tab: InfoSubTab) => void
}

// ── Sub-component: FeatureList ────────────────────────────────────────────────

interface FeatureListProps {
  items: Feature[]
  allFeatures: Feature[]
  label: string
  onAdd: () => void
  onChange: (id: string, patch: Partial<Feature>) => void
  onRemove: (id: string) => void
  onLinkToggle: (featureId: string, otherId: string) => void
  theme: Theme
  card: string
  readOnly: boolean
  pb: number
  suggestionSource?: SuggestionSource
  userId?: string | null
  favorites: FavoriteRef[]
  onToggleFavorite: (id: string, label: string) => void
  onAddToEquipment?: (feature: Feature) => void
  equipmentLinkedIds?: Set<string>
  showAttunement?: boolean
  showItemExtras?: boolean
}

const MAX_ATTUNEMENTS = 3

export function FeatureList({ items, allFeatures, label, onAdd, onChange, onRemove, onLinkToggle, theme, card, readOnly, pb, suggestionSource, userId, favorites, onToggleFavorite, onAddToEquipment, equipmentLinkedIds, showAttunement, showItemExtras }: FeatureListProps) {
  const attunedCount = showAttunement ? items.filter(f => f.attuned).length : 0

  return (
    <div className={`${card} p-3 flex flex-col gap-2 flex-1 min-h-0`}>
      <div className="flex items-center justify-between shrink-0 gap-2">
        <span className="text-[10px] uppercase tracking-widest text-white/50 font-semibold">{label}</span>
        {showAttunement && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${
            attunedCount > MAX_ATTUNEMENTS ? "bg-red-500/20 text-red-300" : "bg-purple-500/15 text-purple-300"
          }`}>
            Attuned {attunedCount}/{MAX_ATTUNEMENTS}
          </span>
        )}
        {!readOnly && (
          <button type="button" onClick={onAdd}
            className="text-sm px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors ml-auto">
            + Add
          </button>
        )}
      </div>
      <div className="flex flex-col gap-1.5 overflow-auto flex-1">
        {items.length === 0 && (
          <p className="text-[10px] text-white/25 italic text-center py-6">
            {readOnly ? "None" : "None yet — click Add"}
          </p>
        )}
        {items.map(f => (
          <FeatureEntry
            key={f.id}
            feature={f}
            allFeatures={allFeatures.filter(a => a.id !== f.id && a.trackable)}
            theme={theme}
            readOnly={readOnly}
            pb={pb}
            suggestionSource={suggestionSource}
            userId={userId}
            isFavorite={favorites.some(fav => fav.refId === f.id)}
            onToggleFavorite={() => onToggleFavorite(f.id, f.name)}
            onAddToEquipment={onAddToEquipment}
            inEquipment={equipmentLinkedIds?.has(f.id)}
            showAttunement={showAttunement}
            showItemExtras={showItemExtras}
            onChange={patch => onChange(f.id, patch)}
            onRemove={() => onRemove(f.id)}
            onLinkToggle={otherId => onLinkToggle(f.id, otherId)}
          />
        ))}
      </div>
    </div>
  )
}

// ── Sub-component: ContainerItemsList — generic items, with folder-like containers ────

interface ContainerItemsListProps {
  items: Feature[]  // full generic-items array (for parent/child resolution)
  allFeatures: Feature[]
  onAdd: (parentId?: string) => void
  onChange: (id: string, patch: Partial<Feature>) => void
  onRemove: (id: string) => void
  onLinkToggle: (featureId: string, otherId: string) => void
  theme: Theme
  card: string
  readOnly: boolean
  pb: number
  userId?: string | null
  favorites: FavoriteRef[]
  onToggleFavorite: (id: string, label: string) => void
}

function ContainerItemsList({ items, allFeatures, onAdd, onChange, onRemove, onLinkToggle, theme, card, readOnly, pb, userId, favorites, onToggleFavorite }: ContainerItemsListProps) {
  const roots = items.filter(i => !i.parentId)

  // A container can't be dropped into itself or into one of its own descendants
  function isSelfOrDescendant(candidateId: string, movingId: string): boolean {
    let current: Feature | undefined = items.find(i => i.id === candidateId)
    const visited = new Set<string>()
    while (current) {
      if (current.id === movingId) return true
      if (visited.has(current.id)) break
      visited.add(current.id)
      current = current.parentId ? items.find(i => i.id === current!.parentId) : undefined
    }
    return false
  }

  function handleDrop(targetId: string | undefined, e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (readOnly) return
    const raw = e.dataTransfer.getData("x-fable-ref")
    if (!raw) return
    let ref: { refId?: string; refType?: string }
    try { ref = JSON.parse(raw) } catch { return }
    if (ref.refType !== "feature" || !ref.refId) return
    if (!items.some(i => i.id === ref.refId)) return // only reparent items that live in this generic-items list
    if (targetId && (ref.refId === targetId || isSelfOrDescendant(targetId, ref.refId))) return // no self/cycle
    onChange(ref.refId, { parentId: targetId })
  }

  function renderItem(f: Feature, depth: number) {
    const children     = items.filter(c => c.parentId === f.id)
    const childWeight  = children.reduce((sum, c) => sum + (c.weight ?? 0) * (c.amount ?? 1), 0)
    const overCapacity = f.maxWeight != null && childWeight > f.maxWeight
    return (
      <div key={f.id} className="flex flex-col gap-1.5" style={{ marginLeft: depth * 16 }}>
        <FeatureEntry
          feature={f}
          allFeatures={allFeatures.filter(a => a.id !== f.id && a.trackable)}
          theme={theme}
          readOnly={readOnly}
          pb={pb}
          suggestionSource="item"
          userId={userId}
          isFavorite={favorites.some(fav => fav.refId === f.id)}
          onToggleFavorite={() => onToggleFavorite(f.id, f.name)}
          showItemExtras
          onChange={patch => onChange(f.id, patch)}
          onRemove={() => onRemove(f.id)}
          onLinkToggle={otherId => onLinkToggle(f.id, otherId)}
        />
        <PopTransition show={!!f.isContainer}>
          <div className="ml-4 border-l border-white/10 pl-2 flex flex-col gap-1.5 rounded-r-lg transition-colors"
            onDragOver={e => { if (!readOnly) e.preventDefault() }}
            onDrop={e => handleDrop(f.id, e)}>
            {f.maxWeight != null && (
              <span className={`text-[9px] px-2 py-0.5 rounded-full self-start ${overCapacity ? "bg-red-500/20 text-red-300" : "bg-white/10 text-white/40"}`}>
                {childWeight % 1 === 0 ? childWeight : childWeight.toFixed(1)}/{f.maxWeight} lb
              </span>
            )}
            {children.map(c => renderItem(c, depth + 1))}
            {children.length === 0 && (
              <p className="text-[10px] text-white/20 italic text-center py-2 border border-dashed border-white/10 rounded-lg">
                Drag items here
              </p>
            )}
          </div>
        </PopTransition>
      </div>
    )
  }

  return (
    <div className={`${card} p-3 flex flex-col gap-2 flex-1 min-h-0`}
      onDragOver={e => { if (!readOnly) e.preventDefault() }}
      onDrop={e => handleDrop(undefined, e)}>
      <div className="flex items-center justify-between shrink-0">
        <span className="text-[10px] uppercase tracking-widest text-white/50 font-semibold">Items</span>
        {!readOnly && (
          <button type="button" onClick={() => onAdd()}
            className="text-sm px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors">
            + Add
          </button>
        )}
      </div>
      <div className="flex flex-col gap-1.5 overflow-auto flex-1">
        {roots.length === 0 && (
          <p className="text-[10px] text-white/25 italic text-center py-6">
            {readOnly ? "None" : "None yet — click Add"}
          </p>
        )}
        {roots.map(f => renderItem(f, 0))}
      </div>
    </div>
  )
}

// ── Sub-component: ProficiencyList — entry-based, replaces the old free-text textarea ─

function toProfEntries(value: ProficiencyEntry[] | string | undefined): ProficiencyEntry[] {
  if (Array.isArray(value)) return value
  if (typeof value === "string" && value.trim()) {
    return value.split(/[,\n]/).map(s => s.trim()).filter(Boolean).map(name => ({ id: nanoid(), name }))
  }
  return []
}

function ProficiencyList({ label, value, onChange, readOnly, card }: {
  label: string
  value: ProficiencyEntry[] | string | undefined
  onChange: (entries: ProficiencyEntry[]) => void
  readOnly: boolean
  card: string
}) {
  const entries = toProfEntries(value)

  function addEntry()                        { onChange([...entries, { id: nanoid(), name: "" }]) }
  function changeEntry(id: string, name: string) { onChange(entries.map(e => e.id === id ? { ...e, name } : e)) }
  function removeEntry(id: string)           { onChange(entries.filter(e => e.id !== id)) }

  return (
    <div className={`${card} p-3 flex flex-col gap-2`}>
      <div className="flex items-center justify-between shrink-0">
        <span className="text-[10px] uppercase tracking-widest text-white/50 font-semibold">{label}</span>
        {!readOnly && (
          <button type="button" onClick={addEntry}
            className="text-sm px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors">
            + Add
          </button>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        {entries.length === 0 && (
          <p className="text-[10px] text-white/25 italic text-center py-3">
            {readOnly ? "None" : "None yet — click Add"}
          </p>
        )}
        {entries.map(entry => (
          <div key={entry.id} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5">
            <input value={entry.name} disabled={readOnly} placeholder="e.g. Longswords"
              onChange={e => changeEntry(entry.id, e.target.value)}
              className="flex-1 min-w-0 bg-transparent outline-none text-xs text-white/80 placeholder:text-white/20 disabled:opacity-60" />
            {!readOnly && (
              <button type="button" onClick={() => removeEntry(entry.id)}
                className="text-white/20 hover:text-red-400 text-xs shrink-0 transition-colors">✕</button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Sub-component: Linked Notes ───────────────────────────────────────────────

function getDescendantNotes(objects: userInfo.Objects[], folderId: string): userInfo.Objects[] {
  const direct     = objects.filter(o => o.parent_id === folderId)
  const notes      = direct.filter(o => o.type === "note")
  const subfolders = direct.filter(o => o.type === "folder")
  return [...notes, ...subfolders.flatMap(f => getDescendantNotes(objects, f.id))]
}

// Dropdowns triggered from inside a note row need to escape that row's
// `overflow-hidden` (used for its own rounded corners) or they render clipped
// — invisible on an empty/short note. Position is computed from the trigger's
// screen rect and the menu itself is portaled to <body> as `position: fixed`,
// so it always pops out above everything regardless of any ancestor's overflow.
function usePopoverPosition(open: boolean, triggerRef: React.RefObject<HTMLElement | null>) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  useEffect(() => {
    if (!open || !triggerRef.current) { setPos(null); return }
    const rect = triggerRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + 4, right: Math.max(4, window.innerWidth - rect.right) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  return pos
}

// Unlinking used to be a bare "✕" — easy to hit by accident while scanning the
// list. It now lives behind a small edit menu so unlinking is a deliberate
// two-click action instead of a hair-trigger one.
function LinkMenu({ onUnlink, itemLabel }: { onUnlink: () => void; itemLabel: string }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const pos = usePopoverPosition(open, triggerRef)

  return (
    <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
      <button type="button" ref={triggerRef}
        onClick={() => setOpen(v => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        title="Edit link"
        className="text-white/30 hover:text-white text-xs size-5 flex items-center justify-center rounded hover:bg-white/10 transition-colors">
        ✎
      </button>
      {open && pos && createPortal(
        <div style={{ position: "fixed", top: pos.top, right: pos.right }}
          className="z-50 bg-zinc-900 border border-white/15 rounded-lg shadow-xl overflow-hidden w-36 animate-in fade-in zoom-in-95 duration-150">
          <button type="button" onMouseDown={e => { e.preventDefault(); setOpen(false); onUnlink() }}
            className="w-full text-left px-3 py-2 text-xs text-red-300 hover:bg-red-500/10 transition-colors whitespace-nowrap">
            Unlink {itemLabel}
          </button>
        </div>,
        document.body
      )}
    </div>
  )
}

// Combined note menu — Edit/Preview toggle, Collaborators invite, and Unlink
// all live behind one trigger instead of three separate buttons. Mirrors
// NoteView.tsx's standalone Collaborators menu so a linked note inside the
// character sheet gets the exact same live-collaboration + invite features
// as opening the note on its own.
function NoteMenu({ editing, expanded, onEditClick, isOwner, collaboratorIds, onToggleCollaborator, onUnlink, readOnly }: {
  editing: boolean
  expanded: boolean
  onEditClick: () => void
  isOwner: boolean
  collaboratorIds: string[]
  onToggleCollaborator: (userId: string) => void
  onUnlink?: () => void
  readOnly: boolean
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const pos = usePopoverPosition(open, triggerRef)
  const { candidates, loading } = useCollaboratorCandidates(open && isOwner)

  return (
    <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
      <button type="button" ref={triggerRef}
        onClick={() => setOpen(v => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        title="Note options"
        className={`text-xs size-6 flex items-center justify-center rounded-lg transition-colors ${collaboratorIds.length > 0 ? "text-purple-300 hover:bg-purple-500/10" : "text-white/40 hover:text-white hover:bg-white/10"}`}>
        {collaboratorIds.length > 0 ? "👥" : "⋮"}
      </button>
      {open && pos && createPortal(
        <div style={{ position: "fixed", top: pos.top, right: pos.right }}
          className="z-50 bg-zinc-900 border border-white/15 rounded-lg shadow-xl overflow-hidden w-56 animate-in fade-in zoom-in-95 duration-150"
          onMouseDown={e => e.preventDefault()}>
          {!readOnly && (
            <button type="button" onClick={() => { onEditClick(); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-xs text-white/80 hover:bg-white/10 transition-colors">
              {expanded && editing ? "👁 Preview" : "✎ Edit"}
            </button>
          )}
          {isOwner && (
            <div className="border-t border-white/10">
              <p className="px-3 pt-2 pb-1 text-[9px] uppercase tracking-widest text-white/30 font-semibold">Invite collaborators</p>
              <div className="max-h-32 overflow-y-auto flex flex-col">
                {loading && <p className="px-3 py-1.5 text-[11px] text-white/30">Loading…</p>}
                {!loading && candidates.length === 0 && (
                  <p className="px-3 py-1.5 text-[11px] text-white/30 italic">No party members found — link one of your characters to a party first.</p>
                )}
                {candidates.map(c => (
                  <button key={c.userId} type="button" onClick={() => onToggleCollaborator(c.userId)}
                    className="w-full text-left px-3 py-1.5 text-[11px] text-white/70 hover:bg-white/10 transition-colors flex items-center justify-between">
                    {c.label}
                    {collaboratorIds.includes(c.userId) && <span className="text-purple-300">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
          {!isOwner && collaboratorIds.length > 0 && (
            <p className="px-3 py-2 text-[10px] text-purple-300/70 border-t border-white/10">You're collaborating on this note</p>
          )}
          {onUnlink && (
            <button type="button" onMouseDown={e => { e.preventDefault(); setOpen(false); onUnlink() }}
              className="w-full text-left px-3 py-2 text-xs text-red-300 hover:bg-red-500/10 transition-colors border-t border-white/10">
              Unlink note
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}

// Full live-collaborative note editor, embedded inline in the character sheet.
// Backed by the same Yjs CRDT + Supabase broadcast relay as the standalone
// NoteView page (see ./collab/noteSync.ts) — a linked note behaves identically
// whether you open it here or from the sidebar.
function InlineNote({ note, expanded, onToggle, onRemove, readOnly, autoEdit, onAutoEditConsumed }: {
  note: userInfo.Objects
  expanded: boolean
  onToggle: () => void
  onRemove?: () => void
  readOnly: boolean
  autoEdit?: boolean
  onAutoEditConsumed?: () => void
}) {
  const { user, updateObject, updateSharedObject } = useUserContext()
  const initialData = safeParseJson(note.data) as { content?: string; ydocState?: string; collaboratorIds?: string[] }
  const isOwner = note.owner_id === user?.id

  const [content, setContent] = useState(initialData.content ?? "")
  const [editing, setEditing] = useState(!!autoEdit)
  const [collaboratorIds, setCollaboratorIds] = useState(initialData.collaboratorIds ?? [])
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const ydoc = useMemo(() => {
    const doc = new Y.Doc()
    if (initialData.ydocState) applyEncodedState(doc, initialData.ydocState)
    else if (initialData.content) doc.getText("content").insert(0, initialData.content)
    return doc
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id])
  const ytext = ydoc.getText("content")

  // Newly-created notes open straight into edit mode, once — mirrors the
  // auto-edit-on-add pattern used for newly added spells.
  useEffect(() => {
    if (autoEdit) onAutoEditConsumed?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setContent(ytext.toString())
    const observer = () => setContent(ytext.toString())
    ytext.observe(observer)
    const disconnect = connectNoteChannel(note.id, ydoc)
    return () => { ytext.unobserve(observer); disconnect() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id])

  function scheduleSave(nextCollaboratorIds: string[] = collaboratorIds) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const patch = { content: ytext.toString(), ydocState: encodeDocState(ydoc), collaboratorIds: nextCollaboratorIds }
      try {
        if (isOwner) await updateObject(note.id, { data: patch as unknown as JSON })
        else await updateSharedObject(note.id, { data: patch as unknown as JSON })
      } catch (e) { console.error(e) }
    }, 700)
  }

  function handleChange(next: string) {
    applyTextDiff(ytext, next)  // triggers the observer above, which sets `content`
    scheduleSave()
  }

  function handleToggleCollaborator(userId: string) {
    const next = collaboratorIds.includes(userId)
      ? collaboratorIds.filter(id => id !== userId)
      : [...collaboratorIds, userId]
    setCollaboratorIds(next)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    updateObject(note.id, { data: { content: ytext.toString(), ydocState: encodeDocState(ydoc), collaboratorIds: next } as unknown as JSON })
      .catch(e => console.error(e))
  }

  function handleEditClick() {
    if (!expanded) onToggle()
    setEditing(expanded ? v => !v : true)
  }

  return (
    <div className="rounded-lg bg-white/5 border border-white/10 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-white/10 transition-colors" onClick={onToggle}>
        <span className="text-[10px] text-white/30 w-3 shrink-0">{expanded ? "▼" : "▶"}</span>
        <span className="text-xs text-white/70 flex-1 min-w-0 truncate">{note.name}</span>
        <NoteMenu
          editing={editing}
          expanded={expanded}
          onEditClick={handleEditClick}
          isOwner={isOwner}
          collaboratorIds={collaboratorIds}
          onToggleCollaborator={handleToggleCollaborator}
          onUnlink={onRemove}
          readOnly={readOnly}
        />
      </div>
      {expanded && (
        <div className="px-3 pb-2 max-h-64 overflow-y-auto">
          {editing && !readOnly ? (
            <MarkdownTextarea
              value={content}
              onChange={handleChange}
              autoFocus
              placeholder={`# Note title\n\nStart writing… Supports **bold**, *italic*, \`code\`, and - lists.`}
              className="w-full min-h-32 bg-transparent outline-none text-xs text-white/80 placeholder:text-white/20 resize-none leading-relaxed font-mono"
              wrapperClassName="flex flex-col gap-1"
              variant="light"
            />
          ) : (
            content.trim()
              ? <Markdown text={content} tone="dark" size="xs" />
              : <p className="text-[10px] text-white/20 italic">{readOnly ? "Empty note." : "Empty note — click ⋮ then Edit to start writing."}</p>
          )}
        </div>
      )}
      {collaboratorIds.length > 0 && (
        <div className="px-3 pb-1.5 -mt-0.5">
          <span className="text-[9px] text-purple-300/60">Live-syncing with {collaboratorIds.length} collaborator{collaboratorIds.length === 1 ? "" : "s"}</span>
        </div>
      )}
    </div>
  )
}

function LinkedNotesSection({ objects, linkedRefs, onChange, onCreateNote, readOnly, card }: {
  objects: userInfo.Objects[]
  linkedRefs: LinkedNoteRef[]
  onChange: (refs: LinkedNoteRef[]) => void
  onCreateNote: () => Promise<string>
  readOnly: boolean
  card: string
}) {
  const [pickerValue, setPickerValue]     = useState("")
  const [expandedId, setExpandedId]       = useState<string | null>(null)
  const [pendingEditId, setPendingEditId] = useState<string | null>(null)
  const [creating, setCreating]           = useState(false)

  const linkable = objects.filter(o =>
    (o.type === "note" || o.type === "folder") && !linkedRefs.some(r => r.id === o.id)
  )

  function handleAdd() {
    if (!pickerValue) return
    const obj = objects.find(o => o.id === pickerValue)
    if (!obj) return
    onChange([...linkedRefs, { id: obj.id, type: obj.type === "folder" ? "folder" : "note" }])
    setPickerValue("")
  }
  function handleRemove(id: string) { onChange(linkedRefs.filter(r => r.id !== id)) }

  async function handleCreate() {
    setCreating(true)
    try {
      const id = await onCreateNote()
      setExpandedId(id)
      setPendingEditId(id)
    } catch (e) {
      console.error(e)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className={`${card} p-3 flex flex-col gap-2`}>
      <div className="flex items-center justify-between shrink-0 gap-2">
        <span className="text-[10px] uppercase tracking-widest text-white/50 font-semibold">Linked Notes</span>
        {!readOnly && (
          <button type="button" onClick={handleCreate} disabled={creating}
            className="text-sm px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors disabled:opacity-40 ml-auto">
            {creating ? "Creating…" : "+ New Note"}
          </button>
        )}
      </div>

      {!readOnly && linkable.length > 0 && (
        <div className="flex items-center gap-2">
          <select value={pickerValue} onChange={e => setPickerValue(e.target.value)}
            className="flex-1 min-w-0 bg-zinc-800 rounded-lg px-3 py-2 text-xs text-white outline-none">
            <option value="" className="bg-zinc-800 text-white">Link a note or folder…</option>
            {linkable.map(o => <option key={o.id} value={o.id} className="bg-zinc-800 text-white">{o.type === "folder" ? "📁 " : ""}{o.name}</option>)}
          </select>
          <button type="button" onClick={handleAdd} disabled={!pickerValue}
            className="text-xs px-3 py-2 rounded-lg bg-primary/80 hover:bg-primary disabled:opacity-30 disabled:cursor-default text-white font-semibold transition-colors shrink-0">
            Link
          </button>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {linkedRefs.length === 0 && (
          <p className="text-xs text-white/25 italic">No notes linked yet — click "+ New Note", or link an existing note/folder above.</p>
        )}
        {linkedRefs.map(ref => {
          const obj = objects.find(o => o.id === ref.id)
          if (!obj) {
            return (
              <div key={ref.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5">
                <span className="text-xs text-white/30 italic">Not found (deleted?)</span>
                {!readOnly && <LinkMenu onUnlink={() => handleRemove(ref.id)} itemLabel="reference" />}
              </div>
            )
          }

          if (ref.type === "folder") {
            const notes = getDescendantNotes(objects, ref.id)
            return (
              <div key={ref.id} className="rounded-lg bg-white/5 border border-white/10 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2">
                  <span className="text-xs font-semibold text-white/70 flex-1 min-w-0 truncate">📁 {obj.name}</span>
                  <span className="text-[10px] text-white/30 shrink-0">{notes.length} note{notes.length === 1 ? "" : "s"}</span>
                  {!readOnly && <LinkMenu onUnlink={() => handleRemove(ref.id)} itemLabel="folder" />}
                </div>
                {notes.length > 0 && (
                  <div className="flex flex-col gap-1 px-2 pb-2">
                    {notes.map(n => (
                      <InlineNote key={n.id} note={n} readOnly={readOnly}
                        expanded={expandedId === n.id}
                        onToggle={() => setExpandedId(expandedId === n.id ? null : n.id)}
                        autoEdit={pendingEditId === n.id}
                        onAutoEditConsumed={() => setPendingEditId(null)} />
                    ))}
                  </div>
                )}
              </div>
            )
          }

          return (
            <InlineNote key={ref.id} note={obj} readOnly={readOnly}
              expanded={expandedId === ref.id}
              onToggle={() => setExpandedId(expandedId === ref.id ? null : ref.id)}
              onRemove={!readOnly ? () => handleRemove(ref.id) : undefined}
              autoEdit={pendingEditId === ref.id}
              onAutoEditConsumed={() => setPendingEditId(null)} />
          )
        })}
      </div>
    </div>
  )
}

// Notes someone invited you to collaborate on that aren't linked to THIS
// character yet — without this, being added as a collaborator was invisible;
// the note just silently started live-syncing with nothing showing it existed.
function SharedNotesSection({ objects, userId, linkedRefs, onLink, card }: {
  objects: userInfo.Objects[]
  userId?: string | null
  linkedRefs: LinkedNoteRef[]
  onLink: (id: string) => void
  card: string
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const sharedNotes = userId
    ? objects.filter(o =>
        o.type === "note" &&
        o.owner_id !== userId &&
        (safeParseJson(o.data) as { collaboratorIds?: string[] }).collaboratorIds?.includes(userId) &&
        !linkedRefs.some(r => r.id === o.id)
      )
    : []

  if (sharedNotes.length === 0) return null

  return (
    <div className={`${card} p-3 flex flex-col gap-2 animate-in fade-in duration-200`}>
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest text-purple-300 font-semibold">👥 Shared With You</span>
        <span className="text-[10px] text-white/30">{sharedNotes.length}</span>
      </div>
      <p className="text-[10px] text-white/30 -mt-1">Someone invited you to collaborate on these. Link one to keep it on this character sheet.</p>
      <div className="flex flex-col gap-1.5">
        {sharedNotes.map(note => (
          <div key={note.id} className="flex flex-col gap-1">
            <InlineNote note={note} readOnly={false}
              expanded={expandedId === note.id}
              onToggle={() => setExpandedId(expandedId === note.id ? null : note.id)} />
            <button type="button" onClick={() => onLink(note.id)}
              className="self-end text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 hover:text-purple-200 transition-colors">
              + Link to this character
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main InfoTab component ────────────────────────────────────────────────────

const SUB_TABS: [InfoSubTab, string][] = [
  ["overview",   "Notes"],
  ["raceFeats",  "Race & Feats"],
  ["features",   "Features"],
  ["items",      "Armor & Items"],
  ["profs",      "Proficiencies"]
]

export function InfoTab({ data, update, onChangeFeature, onRemoveFeature, onLinkToggle, theme, card, readOnly, userId, objects, createObject, favorites, onToggleFavorite, onAddItemToEquipment, equipmentLinkedIds, subTab, onSubTabChange }: InfoTabProps) {

  const pb = profBonus(data.level ?? 1)

  // All features across all lists (for linking UI)
  const allFeatures: Feature[] = [
    ...(data.racialTraits  ?? []),
    ...(data.feats         ?? []),
    ...(data.classFeatures ?? []),
    ...(data.items         ?? []),
    ...(data.invocations   ?? []),
  ]

  // ── Feature list helpers ─────────────────────────────────────────────────

  type FeatureKey = "racialTraits" | "feats" | "classFeatures" | "items" | "invocations"

  function addFeature(key: FeatureKey, patch?: Partial<Feature>) {
    update({ [key]: [...(data[key] ?? []), { id: nanoid(), name: "", ...patch }] })
  }

  // ── Linked Notes helpers — create a real sidebar Note object and link it ──

  async function handleCreateNote(): Promise<string> {
    const note = await createObject({ name: "New Note", type: "note" })
    update({ linkedNoteRefs: [...(data.linkedNoteRefs ?? []), { id: note.id, type: "note" }] })
    return note.id
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">

      {/* Sub-tab bar */}
      <div className="flex items-center gap-1 flex-wrap shrink-0">
        {SUB_TABS.map(([tab, label]) => (
          <button key={tab} type="button" onClick={() => onSubTabChange(tab)}
            className={`px-3 py-1 text-[10px] uppercase tracking-widest rounded-full font-semibold transition-colors ${
              subTab === tab ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70 hover:bg-white/5"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Notes (formerly Overview) ────────────────────────────────────── */}

      {subTab === "overview" && (
        <div className="flex flex-col gap-3 overflow-auto flex-1">

          <div className={`${card} p-3 flex flex-col gap-2`}>
            <span className="text-[10px] uppercase tracking-widest text-white/50 font-semibold">Background</span>
            <input value={data.background ?? ""} onChange={e => update({ background: e.target.value })}
              placeholder="Acolyte, Sage…" disabled={readOnly}
              className="bg-transparent outline-none text-xs text-white placeholder:text-white/20 border-b border-white/10 pb-1 disabled:opacity-60" />
            <input value={data.alignment ?? ""} onChange={e => update({ alignment: e.target.value })}
              placeholder="Alignment…" disabled={readOnly}
              className="bg-transparent outline-none text-xs text-white placeholder:text-white/20 disabled:opacity-60" />
          </div>

          <div className={`${card} p-3 flex flex-col gap-2`}>
            <span className="text-[10px] uppercase tracking-widest text-white/50 font-semibold">Party</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/50 shrink-0">Code</span>
              <input value={data.partyCode ?? ""} onChange={e => update({ partyCode: e.target.value.toUpperCase() })}
                placeholder="Enter party code from DM…" maxLength={8} disabled={readOnly}
                className="flex-1 bg-white/10 rounded px-2 py-1 text-xs font-mono tracking-widest text-white outline-none focus:ring-1 focus:ring-primary placeholder:text-white/20 uppercase disabled:opacity-60" />
            </div>
            {data.partyCode && (
              <p className="text-[9px] text-white/40">Joined: <span className="text-white/70 font-mono">{data.partyCode}</span></p>
            )}
          </div>

          {data.multiclass && data.classes && data.classes.length > 1 && (
            <div className={`${card} p-3 flex flex-col gap-2`}>
              <span className="text-[10px] uppercase tracking-widest text-white/50 font-semibold">Classes</span>
              {data.classes.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-white/70 flex-1">{c.cls}</span>
                  <span className="text-white/40">Lv {c.level}</span>
                </div>
              ))}
            </div>
          )}

          <SharedNotesSection
            objects={objects}
            userId={userId}
            linkedRefs={data.linkedNoteRefs ?? []}
            onLink={id => update({ linkedNoteRefs: [...(data.linkedNoteRefs ?? []), { id, type: "note" }] })}
            card={card}
          />

          <LinkedNotesSection
            objects={objects}
            linkedRefs={data.linkedNoteRefs ?? []}
            onChange={refs => update({ linkedNoteRefs: refs })}
            onCreateNote={handleCreateNote}
            readOnly={readOnly}
            card={card}
          />
        </div>
      )}

      {/* ── Race & Feats (tiled, side-by-side) ───────────────────────────────── */}

      {subTab === "raceFeats" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 flex-1 min-h-0">
          <FeatureList
            items={data.racialTraits ?? []} allFeatures={allFeatures} label="Racial Traits"
            onAdd={() => addFeature("racialTraits")}
            onChange={onChangeFeature}
            onRemove={onRemoveFeature}
            onLinkToggle={onLinkToggle}
            theme={theme} card={card} readOnly={readOnly} pb={pb}
            suggestionSource="race" userId={userId}
            favorites={favorites} onToggleFavorite={onToggleFavorite}
          />
          <FeatureList
            items={data.feats ?? []} allFeatures={allFeatures} label="Feats"
            onAdd={() => addFeature("feats")}
            onChange={onChangeFeature}
            onRemove={onRemoveFeature}
            onLinkToggle={onLinkToggle}
            theme={theme} card={card} readOnly={readOnly} pb={pb}
            suggestionSource="feat" userId={userId}
            favorites={favorites} onToggleFavorite={onToggleFavorite}
          />
          <FeatureList
            items={data.invocations ?? []} allFeatures={allFeatures} label="Eldritch Invocations"
            onAdd={() => addFeature("invocations")}
            onChange={onChangeFeature}
            onRemove={onRemoveFeature}
            onLinkToggle={onLinkToggle}
            theme={theme} card={card} readOnly={readOnly} pb={pb}
            suggestionSource="invocation" userId={userId}
            favorites={favorites} onToggleFavorite={onToggleFavorite}
          />
        </div>
      )}

      {/* ── Class Features ─────────────────────────────────────────────────── */}

      {subTab === "features" && (
        <FeatureList
          items={data.classFeatures ?? []} allFeatures={allFeatures} label="Class Features"
          onAdd={() => addFeature("classFeatures")}
          onChange={onChangeFeature}
          onRemove={onRemoveFeature}
          onLinkToggle={onLinkToggle}
          theme={theme} card={card} readOnly={readOnly} pb={pb}
          suggestionSource="class" userId={userId}
          favorites={favorites} onToggleFavorite={onToggleFavorite}
        />
      )}

      {/* ── Armor & Items ─────────────────────────────────────────────────── */}

      {subTab === "items" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 min-h-0">
          <FeatureList
            items={(data.items ?? []).filter(i => i.category === "armor")} allFeatures={allFeatures} label="Armor & Equipment"
            onAdd={() => addFeature("items", { category: "armor" })}
            onChange={onChangeFeature}
            onRemove={onRemoveFeature}
            onLinkToggle={onLinkToggle}
            theme={theme} card={card} readOnly={readOnly} pb={pb}
            suggestionSource="item" userId={userId}
            favorites={favorites} onToggleFavorite={onToggleFavorite}
            onAddToEquipment={onAddItemToEquipment}
            equipmentLinkedIds={equipmentLinkedIds}
            showAttunement
            showItemExtras
          />
          <ContainerItemsList
            items={(data.items ?? []).filter(i => i.category !== "armor")} allFeatures={allFeatures}
            onAdd={parentId => addFeature("items", { category: "item", parentId })}
            onChange={onChangeFeature}
            onRemove={onRemoveFeature}
            onLinkToggle={onLinkToggle}
            theme={theme} card={card} readOnly={readOnly} pb={pb}
            userId={userId}
            favorites={favorites} onToggleFavorite={onToggleFavorite}
          />
        </div>
      )}

      {/* ── Proficiencies ──────────────────────────────────────────────────── */}

      {subTab === "profs" && (
        <div className="flex flex-col gap-3 overflow-auto flex-1">
          <ProficiencyList label="Weapons"   value={data.weaponProfs}   onChange={v => update({ weaponProfs:   v })} readOnly={readOnly} card={card} />
          <ProficiencyList label="Armor"     value={data.armorProfs}    onChange={v => update({ armorProfs:    v })} readOnly={readOnly} card={card} />
          <ProficiencyList label="Tools"     value={data.toolProfs}     onChange={v => update({ toolProfs:     v })} readOnly={readOnly} card={card} />
          <ProficiencyList label="Languages" value={data.languageProfs} onChange={v => update({ languageProfs: v })} readOnly={readOnly} card={card} />
        </div>
      )}

    </div>
  )
}
