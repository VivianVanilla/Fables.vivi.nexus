// ════════════════════════════════════════════════════════════════════════════
// NoteView.tsx — Simple markdown note: edit (textarea) ↔ preview (rendered)
//
// Preview rendering is the same shared <Markdown> component (react-markdown +
// remark-gfm) used everywhere else in the app — full CommonMark plus GFM
// tables, so tables/images inserted via the toolbar render correctly instead
// of only supporting the hand-rolled headers/bold/italic/code/list subset
// this file used to parse itself.
//
// Collaborative editing: content is backed by a Yjs Y.Text CRDT, live-synced
// with any other party member the owner has invited via a per-note Supabase
// Realtime broadcast channel, plus a colored named cursor per collaborator via
// Realtime Presence (see ./collab/useCollaborativeNote.ts and ./collab/noteSync.ts).
// Two people editing at once merge character-by-character instead of
// last-write-wins clobbering.
// ════════════════════════════════════════════════════════════════════════════

import { useState } from "react"
import type { SidebarObject } from "@/components/sidebar-utils"
import { MarkdownTextarea } from "./ui/MarkdownTextarea"
import { Markdown } from "./ui/Markdown"
import { ShareMenu } from "./collab/ShareMenu"
import { CollabCursorOverlay } from "./collab/CollabCursorOverlay"
import { useCollaborativeNote } from "./collab/useCollaborativeNote"

// ── Types ─────────────────────────────────────────────────────────────────────

interface NoteViewProps {
  note: SidebarObject
  onClose: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NoteView({ note, onClose }: NoteViewProps) {
  const {
    isOwner, canEdit, userId, ownerEmail, content, handleChange, saving,
    collaboratorEmails, pendingInviteEmails, collaboratorRoles,
    handleInvite, handleCancelInvite, handleRemoveCollaborator, handleSetRole,
    textareaRef, peers, handleSelectionChange,
  } = useCollaborativeNote(note)

  const [editing, setEditing] = useState(!content && canEdit)

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-0 bg-card rounded-xl overflow-hidden text-white">

      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 shrink-0 bg-card">
        <p className="text-sm font-bold tracking-wide flex-1 truncate">{note.name}</p>

        {peers.length > 0 && (
          <div className="flex items-center -space-x-1.5 shrink-0" title={peers.map(p => p.name).join(", ")}>
            {peers.map(p => (
              <span key={p.id} className="size-5 rounded-full ring-2 ring-slate-900 flex items-center justify-center text-[9px] font-bold text-white"
                style={{ backgroundColor: p.color }}>
                {p.name.charAt(0).toUpperCase()}
              </span>
            ))}
          </div>
        )}

        {saving && <span className="text-[10px] text-white/40 animate-pulse">saving…</span>}

        <ShareMenu
          isOwner={isOwner}
          ownerEmail={ownerEmail}
          collaboratorEmails={collaboratorEmails}
          pendingInviteEmails={pendingInviteEmails}
          collaboratorRoles={collaboratorRoles}
          onInvite={handleInvite}
          onCancelInvite={handleCancelInvite}
          onRemoveCollaborator={handleRemoveCollaborator}
          onSetRole={handleSetRole}
          topSlot={canEdit ? (
            <button type="button" onClick={() => setEditing(v => !v)}
              className="w-full text-left px-3 py-2 text-xs text-white/80 hover:bg-white/10 transition-colors">
              {editing ? "👁 Preview" : "✎ Edit"}
            </button>
          ) : undefined}
        />

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
        {editing && canEdit && (
          <MarkdownTextarea
            value={content}
            onChange={handleChange}
            onSelectionChange={handleSelectionChange}
            textareaRef={textareaRef}
            userId={userId}
            overlay={<CollabCursorOverlay textareaRef={textareaRef} peers={peers} text={content} />}
            autoFocus
            placeholder={`# Note title\n\nStart writing… Supports **bold**, *italic*, \`code\`, and - lists. Ctrl/Cmd+B/I/E for quick formatting.`}
            className="flex-1 min-h-96 w-full bg-transparent outline-none text-sm text-white/80 placeholder:text-white/20 resize-none leading-relaxed font-mono"
            wrapperClassName="flex flex-col h-full gap-1"
            variant="light"
          />
        )}

        {/* Preview mode (also the only mode for view-only collaborators) */}
        {(!editing || !canEdit) && (
          <div
            className={canEdit ? "max-w-prose cursor-pointer" : "max-w-prose"}
            onClick={canEdit ? () => setEditing(true) : undefined}
            title={canEdit ? "Click to edit" : undefined}
          >
            {!canEdit && (
              <p className="text-[10px] text-white/30 italic mb-2">👁 View only — the owner hasn't given you edit access.</p>
            )}
            {content.trim()
              ? <Markdown text={content} tone="dark" size="sm" />
              : <p className="text-white/25 italic text-sm">Empty note — click to start writing.</p>
            }
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-5 py-2 border-t border-white/5 bg-slate-900/50 shrink-0 flex items-center justify-between gap-3">
        <p className="text-[10px] text-white/20">
          Supports: <span className="font-mono"># headers</span>  <span className="font-mono">**bold**</span>  <span className="font-mono">*italic*</span>  <span className="font-mono">`code`</span>  <span className="font-mono">- lists</span>  <span className="font-mono">tables</span>  <span className="font-mono">images</span>  <span className="font-mono">Ctrl/Cmd+B/I/E</span>
        </p>
        {collaboratorEmails.length > 0 && (
          <p className="text-[10px] text-purple-300/70 shrink-0">Live-syncing with {collaboratorEmails.length} collaborator{collaboratorEmails.length === 1 ? "" : "s"}</p>
        )}
      </div>
    </div>
  )
}
