// ════════════════════════════════════════════════════════════════════════════
// NoteView.tsx — Simple markdown note: edit (textarea) ↔ preview (rendered)
//
// Personal, single-owner notes. Party-wide sharing/collaboration now lives in
// the Party Server's Party Notes canvas instead of per-note invites — see
// @/components/party/PartyNotesCanvas.tsx. Drag a note there to bring it into
// the shared space; it stays your note here either way.
//
// Preview rendering uses the shared <Markdown> component (react-markdown +
// remark-gfm) — full CommonMark plus GFM tables/images.
// ════════════════════════════════════════════════════════════════════════════

import { useRef, useState } from "react"
import type { SidebarObject } from "@/components/sidebar-utils"
import { useUserContext } from "../../src/contexts/UserContext"
import { safeParseJson } from "./character-utils"
import { MarkdownTextarea } from "./ui/MarkdownTextarea"
import { Markdown } from "./ui/Markdown"

interface NoteData {
  content?: string
}

interface NoteViewProps {
  note: SidebarObject
}

export function NoteView({ note }: NoteViewProps) {
  const { user, updateObject } = useUserContext()

  const initialData = safeParseJson(note.data) as NoteData
  const [content, setContent] = useState(initialData.content ?? "")
  const [editing, setEditing] = useState(!initialData.content)
  const [saving, setSaving] = useState(false)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleChange(next: string) {
    setContent(next)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      try { await updateObject(note.id, { data: { content: next } as unknown as JSON }) }
      catch (e) { console.error(e) }
      setSaving(false)
    }, 700)
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-card rounded-xl overflow-hidden text-foreground">

      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0 bg-card">
        <p className="text-sm font-bold tracking-wide flex-1 truncate">{note.name}</p>

        {saving && <span className="text-[10px] text-muted-foreground animate-pulse">saving…</span>}

        <button
          type="button"
          onClick={() => setEditing(v => !v)}
          className={`text-xs px-2.5 py-1 rounded-full transition-colors ${editing ? "bg-foreground/20 text-foreground" : "bg-foreground/10 hover:bg-foreground/20 text-muted-foreground hover:text-foreground"}`}
        >
          {editing ? "👁 Preview" : "✎ Edit"}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-auto p-5">

        {editing ? (
          <MarkdownTextarea
            value={content}
            onChange={handleChange}
            userId={user?.id ?? null}
            autoFocus
            placeholder={`# Note title\n\nStart writing… Supports **bold**, *italic*, \`code\`, tables, and images. Ctrl/Cmd+B/I/E for quick formatting.`}
            className="flex-1 min-h-96 w-full bg-transparent outline-none text-sm text-foreground/90 placeholder:text-muted-foreground/60 resize-none leading-relaxed font-mono"
            wrapperClassName="flex flex-col h-full gap-1"
            variant="light"
          />
        ) : (
          <div className="max-w-prose cursor-pointer" onClick={() => setEditing(true)} title="Click to edit">
            {content.trim()
              ? <Markdown text={content} tone="dark" size="sm" />
              : <p className="text-muted-foreground/60 italic text-sm">Empty note — click to start writing.</p>
            }
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-5 py-2 border-t border-border/50 bg-card/50 shrink-0">
        <p className="text-[10px] text-muted-foreground/50">
          Supports: <span className="font-mono"># headers</span>  <span className="font-mono">**bold**</span>  <span className="font-mono">*italic*</span>  <span className="font-mono">`code`</span>  <span className="font-mono">- lists</span>  <span className="font-mono">tables</span>  <span className="font-mono">images</span>  <span className="font-mono">Ctrl/Cmd+B/I/E</span>
        </p>
      </div>
    </div>
  )
}
