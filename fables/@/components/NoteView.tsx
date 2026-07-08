// ════════════════════════════════════════════════════════════════════════════
// NoteView.tsx — Simple markdown note: edit (textarea) ↔ preview (rendered)
//
// Supported markdown:
//   # H1  ## H2  ### H3  — headers
//   **bold**  *italic*   — inline emphasis
//   `code`               — inline code
//   - item               — unordered list items
//   blank line           — paragraph break
//
// Collaborative editing: content is backed by a Yjs Y.Text CRDT, live-synced
// with any other party member the owner has invited via a per-note Supabase
// Realtime broadcast channel (see ./collab/noteSync.ts). Two people editing
// at once merge character-by-character instead of last-write-wins clobbering.
// ════════════════════════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect, useMemo } from "react"
import * as Y from "yjs"
import type { SidebarObject } from "@/components/sidebar-utils"
import { useUserContext } from "../../src/contexts/UserContext"
import { safeParseJson } from "./character-utils"
import { MarkdownTextarea } from "./ui/MarkdownTextarea"
import { connectNoteChannel, applyTextDiff, encodeDocState, applyEncodedState } from "./collab/noteSync"
import { ShareMenu } from "./collab/ShareMenu"

// ── Types ─────────────────────────────────────────────────────────────────────

interface NoteData {
  content?: string
  ydocState?: string
  collaboratorIds?: string[]
  pendingInviteIds?: string[]
}

interface NoteViewProps {
  note: SidebarObject
  onClose: () => void
}

// ── Markdown parser ───────────────────────────────────────────────────────────

function parseInline(text: string, keyBase: string): React.ReactNode[] {
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g
  const parts: React.ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    if (m[0].startsWith("**"))     parts.push(<strong key={keyBase + m.index}>{m[2]}</strong>)
    else if (m[0].startsWith("*")) parts.push(<em     key={keyBase + m.index}>{m[3]}</em>)
    else                           parts.push(<code   key={keyBase + m.index} className="bg-white/10 rounded px-1 font-mono text-[11px]">{m[4]}</code>)
    last = re.lastIndex
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

function renderMarkdown(md: string): React.ReactNode {
  const lines = md.split("\n")
  const nodes: React.ReactNode[] = []
  let inList = false

  const flushList = () => { inList = false }

  lines.forEach((line, i) => {
    const key = `line-${i}`

    if (line.startsWith("# ")) {
      flushList()
      nodes.push(<h1 key={key} className="text-xl font-bold text-white mt-4 mb-1 first:mt-0 whitespace-pre-wrap">{parseInline(line.slice(2), key)}</h1>)
    } else if (line.startsWith("## ")) {
      flushList()
      nodes.push(<h2 key={key} className="text-lg font-bold text-white mt-4 mb-1 whitespace-pre-wrap">{parseInline(line.slice(3), key)}</h2>)
    } else if (line.startsWith("### ")) {
      flushList()
      nodes.push(<h3 key={key} className="text-base font-semibold text-white/90 mt-3 mb-0.5 whitespace-pre-wrap">{parseInline(line.slice(4), key)}</h3>)
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      inList = true
      nodes.push(
        <li key={key} className="ml-5 list-disc text-sm text-white/75 leading-relaxed whitespace-pre-wrap">
          {parseInline(line.slice(2), key)}
        </li>
      )
    } else if (line.trim() === "") {
      flushList()
      nodes.push(<div key={key} className="h-3" />)
    } else {
      if (inList) flushList()
      nodes.push(
        <p key={key} className="text-sm text-white/75 leading-relaxed whitespace-pre-wrap">
          {parseInline(line, key)}
        </p>
      )
    }
  })

  return <>{nodes}</>
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NoteView({ note, onClose }: NoteViewProps) {
  const { user, updateObject, updateSharedObject } = useUserContext()

  const initialData = safeParseJson(note.data) as NoteData
  const isOwner = note.owner_id === user?.id

  const [content, setContent] = useState(initialData.content ?? "")
  const [editing, setEditing] = useState(!initialData.content)
  const [saving,  setSaving]  = useState(false)
  const [collaboratorIds, setCollaboratorIds]   = useState(initialData.collaboratorIds ?? [])
  const [pendingInviteIds, setPendingInviteIds] = useState(initialData.pendingInviteIds ?? [])

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // One Y.Doc per opened note. Seeded from the last saved CRDT snapshot if
  // present, otherwise migrated once from the plain-text `content` field.
  const ydoc = useMemo(() => {
    const doc = new Y.Doc()
    if (initialData.ydocState) {
      applyEncodedState(doc, initialData.ydocState)
    } else if (initialData.content) {
      doc.getText("content").insert(0, initialData.content)
    }
    return doc
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id])

  const ytext = ydoc.getText("content")

  useEffect(() => {
    setContent(ytext.toString())
    const observer = () => setContent(ytext.toString())
    ytext.observe(observer)
    const disconnect = connectNoteChannel(note.id, ydoc)
    return () => { ytext.unobserve(observer); disconnect() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id])

  // ── Auto-save ─────────────────────────────────────────────────────────────
  //
  // Owners save via the normal owner-scoped updateObject(). Collaborators use
  // updateSharedObject(), which drops the owner_id filter — that only
  // actually persists once a matching Supabase RLS policy exists (see
  // updateSharedObject's comment in UserContext.tsx); until then a
  // collaborator's edits still broadcast live to anyone else viewing the note,
  // they just won't survive a reload.

  function scheduleSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      const patch = { content: ytext.toString(), ydocState: encodeDocState(ydoc), collaboratorIds, pendingInviteIds }
      try {
        if (isOwner) await updateObject(note.id, { data: patch as unknown as JSON })
        else await updateSharedObject(note.id, { data: patch as unknown as JSON })
      } catch (e) { console.error(e) }
      setSaving(false)
    }, 700)
  }

  function handleChange(next: string) {
    applyTextDiff(ytext, next)  // triggers the observer above, which sets `content`
    scheduleSave()
  }

  function persistSharing(nextCollaboratorIds: string[], nextPendingInviteIds: string[]) {
    setCollaboratorIds(nextCollaboratorIds)
    setPendingInviteIds(nextPendingInviteIds)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    updateObject(note.id, { data: { content: ytext.toString(), ydocState: encodeDocState(ydoc), collaboratorIds: nextCollaboratorIds, pendingInviteIds: nextPendingInviteIds } as unknown as JSON })
      .catch(e => console.error(e))
  }

  function handleInvite(userId: string) {
    if (collaboratorIds.includes(userId) || pendingInviteIds.includes(userId)) return
    persistSharing(collaboratorIds, [...pendingInviteIds, userId])
  }
  function handleCancelInvite(userId: string) {
    persistSharing(collaboratorIds, pendingInviteIds.filter(id => id !== userId))
  }
  function handleRemoveCollaborator(userId: string) {
    persistSharing(collaboratorIds.filter(id => id !== userId), pendingInviteIds)
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-900 rounded-xl overflow-hidden text-white">

      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 shrink-0 bg-slate-900">
        <p className="text-sm font-bold tracking-wide flex-1 truncate">{note.name}</p>

        {saving && <span className="text-[10px] text-white/40 animate-pulse">saving…</span>}

        <ShareMenu
          isOwner={isOwner}
          collaboratorIds={collaboratorIds}
          pendingInviteIds={pendingInviteIds}
          onInvite={handleInvite}
          onCancelInvite={handleCancelInvite}
          onRemoveCollaborator={handleRemoveCollaborator}
        />

        <button
          type="button"
          onClick={() => setEditing(v => !v)}
          className={`text-xs px-2.5 py-1 rounded-full transition-colors ${editing ? "bg-white/20 text-white" : "bg-white/10 hover:bg-white/20 text-white/60 hover:text-white"}`}
        >
          {editing ? "Preview" : "✎ Edit"}
        </button>

        <button
          type="button"
          onClick={onClose}
          className="size-7 flex items-center justify-center rounded-md hover:bg-white/10 text-white/50 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-auto p-5">

        {/* Edit mode */}
        {editing && (
          <MarkdownTextarea
            value={content}
            onChange={handleChange}
            autoFocus
            placeholder={`# Note title\n\nStart writing… Supports **bold**, *italic*, \`code\`, and - lists.`}
            className="flex-1 min-h-96 w-full bg-transparent outline-none text-sm text-white/80 placeholder:text-white/20 resize-none leading-relaxed font-mono"
            wrapperClassName="flex flex-col h-full gap-1"
            variant="light"
          />
        )}

        {/* Preview mode */}
        {!editing && (
          <div
            className="max-w-prose cursor-pointer"
            onClick={() => setEditing(true)}
            title="Click to edit"
          >
            {content.trim()
              ? renderMarkdown(content)
              : <p className="text-white/25 italic text-sm">Empty note — click to start writing.</p>
            }
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-5 py-2 border-t border-white/5 bg-slate-900/50 shrink-0 flex items-center justify-between gap-3">
        <p className="text-[10px] text-white/20">
          Supports: <span className="font-mono"># headers</span>  <span className="font-mono">**bold**</span>  <span className="font-mono">*italic*</span>  <span className="font-mono">`code`</span>  <span className="font-mono">- lists</span>
        </p>
        {collaboratorIds.length > 0 && (
          <p className="text-[10px] text-purple-300/70 shrink-0">Live-syncing with {collaboratorIds.length} collaborator{collaboratorIds.length === 1 ? "" : "s"}</p>
        )}
      </div>
    </div>
  )
}
