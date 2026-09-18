// ════════════════════════════════════════════════════════════════════════════
// NoteView.tsx — Simple markdown note: edit (textarea) ↔ preview (rendered)
//
// Personal, single-owner notes.
//
// Preview rendering uses the shared <Markdown> component (react-markdown +
// remark-gfm) — full CommonMark plus GFM tables/images. The preview also
// supports a few Google-Docs-style reading layouts (Normal/Wide/Dual
// Page/Paged) plus alignment/font/spacing controls — see NoteViewSettingsModal
// below. These are display-only, saved per-note alongside `content`.
// ════════════════════════════════════════════════════════════════════════════

import { useRef, useState, useLayoutEffect, useMemo } from "react"
import type { SidebarObject } from "@/components/shell/sidebar-utils"
import { useUserContext } from "../../../src/contexts/UserContext"
import { safeParseJson } from "./utils"
import { MarkdownTextarea, type MarkdownTextareaHandle } from "@/components/ui/MarkdownTextarea"
import { Markdown } from "@/components/ui/Markdown"
import { useWikiLinks } from "@/components/shared/wikiLinks"
import { NpcQuickViewModal } from "@/components/npcTracker/NpcQuickViewModal"
import { Modal } from "@/components/shared/ui/Modal"
import {
  Settings2, AlignLeft, AlignCenter, AlignRight,
  Rows3, StretchHorizontal, Columns2, BookOpen, ChevronLeft, ChevronRight, Minus, Plus, SeparatorHorizontal,
} from "lucide-react"

type NoteViewMode     = "normal" | "wide" | "dual" | "paged"
type NoteAlign        = "left" | "center" | "right"
type NoteFontFamily   = "sans" | "serif" | "mono"
type NoteLineSpacing  = "tight" | "normal" | "relaxed" | "loose"

interface NoteViewSettings {
  viewMode?:    NoteViewMode
  align?:       NoteAlign
  fontFamily?:  NoteFontFamily
  lineSpacing?: NoteLineSpacing
  zoom?:        number   // 0.8–1.6, applied as CSS `zoom` — see note on Markdown's rem-based heading sizes below
}

const DEFAULT_SETTINGS: Required<NoteViewSettings> = {
  viewMode: "normal", align: "left", fontFamily: "sans", lineSpacing: "relaxed", zoom: 1,
}

interface NoteData {
  content?: string
  viewSettings?: NoteViewSettings
}

interface NoteViewProps {
  note: SidebarObject
}

// Tailwind generates fixed rem-based sizes for headings/text-sm/etc, which
// don't respond to a parent's font-size the way plain inherited text would —
// so a text-size control that actually scales headings, body text, tables,
// and spacing together uniformly (like a real "zoom level") needs the CSS
// `zoom` property on a wrapper, not a font-size override.
const ZOOM_MIN = 0.8
const ZOOM_MAX = 1.6
const ZOOM_STEP = 0.1

const LINE_SPACING_CLASS: Record<NoteLineSpacing, string> = {
  // `!` (important) is required here — Markdown.tsx's own root div already
  // carries `leading-relaxed` directly, and an appended non-important class
  // of the same CSS property isn't guaranteed to win against it (Tailwind's
  // generated stylesheet order decides ties, not className string order).
  tight: "!leading-tight", normal: "!leading-normal", relaxed: "!leading-relaxed", loose: "!leading-loose",
}
const FONT_FAMILY_CLASS: Record<NoteFontFamily, string> = {
  sans: "font-sans", serif: "font-serif", mono: "font-mono",
}
const ALIGN_CLASS: Record<NoteAlign, string> = {
  left: "text-left", center: "text-center", right: "text-right",
}

function previewClassName(s: Required<NoteViewSettings>): string {
  return `${ALIGN_CLASS[s.align]} ${FONT_FAMILY_CLASS[s.fontFamily]} ${LINE_SPACING_CLASS[s.lineSpacing]}`
}

// An explicit break the user inserts from the editor toolbar (see
// MarkdownTextarea's `extraTools`) — an HTML comment so it renders as
// nothing in Normal/Wide view (which never split the text) instead of
// leaking visible junk into modes that don't use it. Doubles as both a
// forced page break in Paged mode and the column split point in Dual Page —
// whichever view is active decides what it means.
const PAGE_BREAK_MARKER = "\n\n<!-- pagebreak -->\n\n"
const PAGE_BREAK_PATTERN = "<!--\\s*pagebreak\\s*-->"

function firstMarkerSplit(text: string): [string, string] | null {
  const m = text.match(new RegExp(`\\n{0,2}${PAGE_BREAK_PATTERN}\\n{0,2}`, "i"))
  if (!m || m.index == null) return null
  return [text.slice(0, m.index).trimEnd(), text.slice(m.index + m[0].length).trimStart()]
}

// Dual Page only splits where the user explicitly placed a break — no
// automatic halving, so everything stays in the left column until one's
// inserted.
function splitForDual(text: string): [string, string] {
  return firstMarkerSplit(text) ?? [text, ""]
}

// Paged mode: every marker is a forced page boundary — sections never merge
// across one even if they'd fit together — while content within a section
// still auto-paginates by height if it's too tall for one page.
function splitOnMarkers(text: string): string[] {
  const parts = text.split(new RegExp(`\\n{0,2}${PAGE_BREAK_PATTERN}\\n{0,2}`, "gi")).map(s => s.trim()).filter(Boolean)
  return parts.length > 0 ? parts : [text]
}

export function NoteView({ note }: NoteViewProps) {
  const { user, updateObject } = useUserContext()

  const initialData = safeParseJson(note.data) as NoteData
  const [content, setContent] = useState(initialData.content ?? "")
  const [settings, setSettings] = useState<Required<NoteViewSettings>>({ ...DEFAULT_SETTINGS, ...initialData.viewSettings })
  const [editing, setEditing] = useState(!initialData.content)
  const [saving, setSaving] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // One shared debounce for both content and settings saves, reading the
  // latest of each from refs — so a settings click that lands while a
  // content-typing save is still pending doesn't get clobbered by it (or
  // vice versa) writing a stale snapshot of the other field.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contentRef = useRef(content)
  const settingsRef = useRef(settings)
  const textareaRef = useRef<MarkdownTextareaHandle>(null)

  function schedulePersist() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      try { await updateObject(note.id, { data: { content: contentRef.current, viewSettings: settingsRef.current } as unknown as JSON }) }
      catch (e) { console.error(e) }
      setSaving(false)
    }, 700)
  }

  // A standalone note has no party — [[Name]] here only resolves against
  // the viewer's own other notes/characters, not NPCs (see wikiLinks.ts).
  const { linkify, onInternalLink, npcs: linkableNpcs, quickViewNpc, selectNpc, closeQuickView } = useWikiLinks(null)

  function handleChange(next: string) {
    setContent(next)
    contentRef.current = next
    schedulePersist()
  }
  function updateSettings(patch: Partial<NoteViewSettings>) {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      settingsRef.current = next
      return next
    })
    schedulePersist()
  }

  const linkedContent = useMemo(() => linkify(content), [linkify, content])
  const previewClass = previewClassName(settings)

  return (
    <div className="flex flex-col h-full min-h-0 bg-card rounded-xl overflow-hidden text-foreground">

      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0 bg-card">
        <p className="text-sm font-bold tracking-wide flex-1 truncate">{note.name}</p>

        {saving && <span className="text-[10px] text-muted-foreground animate-pulse">saving…</span>}

        {!editing && (
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            title="View settings"
            className="size-7 flex items-center justify-center rounded-full bg-foreground/10 hover:bg-foreground/20 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings2 className="size-3.5" />
          </button>
        )}

        <button
          type="button"
          onClick={() => setEditing(v => !v)}
          className={`text-xs px-2.5 py-1 rounded-full transition-colors ${editing ? "bg-foreground/20 text-foreground" : "bg-foreground/10 hover:bg-foreground/20 text-muted-foreground hover:text-foreground"}`}
        >
          {editing ? "👁 Preview" : "✎ Edit"}
        </button>
      </div>

      {/* Body */}
      {editing ? (
        <div className="flex-1 min-h-0 overflow-auto p-5">
          <MarkdownTextarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            userId={user?.id ?? null}
            autoFocus
            placeholder={`# Note title\n\nStart writing… Supports **bold**, *italic*, \`code\`, tables, and images. Ctrl/Cmd+B/I/E for quick formatting.`}
            className="flex-1 min-h-96 w-full bg-transparent outline-none text-sm text-foreground/90 placeholder:text-muted-foreground/60 resize-none leading-relaxed font-mono"
            wrapperClassName="flex flex-col h-full gap-1"
            variant="light"
            extraTools={
              <button type="button" onClick={() => textareaRef.current?.insertAtCursor(PAGE_BREAK_MARKER)}
                title="Insert page/column break — a forced break in Multiple Pages view, and the split point between columns in Dual Page view. Invisible in Normal/Wide."
                className="size-6 flex items-center justify-center rounded border border-white/15 text-white/40 hover:text-white/80 hover:border-white/30 transition-colors">
                <SeparatorHorizontal className="size-3.5" />
              </button>
            }
          />
        </div>
      ) : !content.trim() ? (
        <div className="flex-1 min-h-0 overflow-auto p-5">
          <div className="max-w-prose">
            <p className="text-muted-foreground/60 italic text-sm">Empty note — click "✎ Edit" to start writing.</p>
          </div>
        </div>
      ) : settings.viewMode === "dual" ? (
        <DualPageBody text={linkedContent} previewClass={previewClass} zoom={settings.zoom} onInternalLink={onInternalLink} />
      ) : settings.viewMode === "paged" ? (
        <PagedBody text={linkedContent} previewClass={previewClass} zoom={settings.zoom} onInternalLink={onInternalLink} />
      ) : (
        <div className="flex-1 min-h-0 overflow-auto p-5">
          <div className={settings.viewMode === "wide" ? "w-full" : "max-w-prose"}>
            <div style={{ zoom: settings.zoom } as React.CSSProperties}>
              <Markdown text={linkedContent} tone="dark" size="sm" onInternalLink={onInternalLink} className={previewClass} />
            </div>
          </div>
        </div>
      )}

      {/* Footer hint */}
      <div className="px-5 py-2 border-t border-border/50 bg-card/50 shrink-0">
        <p className="text-[10px] text-muted-foreground/50">
          Supports Markdown: <span className="font-mono"># headers  | </span>  <span className="font-mono">**bold**  | </span> 
           <span className="font-mono ">  *italic*   | </span>  <span className="font-mono">`code`   | </span>  <span className="font-mono">- lists  |</span>  <span className="font-mono">tables   |</span> 
            <span className="font-mono">  images (copy and paste)  | </span> 
            <span className="font-mono">[[links]]   |</span>  
           <span className="font-mono"> &lt;!--pagebreak--!&gt;</span> (Dual Column &amp; Multiple Pages settings)   |  
            <span  className="font-mono font-bold text-xs "> Shortcuts:</span>
            <span className="font-mono">  Ctrl/Cmd+B/I/U/E</span> 
        </p>
      </div>

      {quickViewNpc && (
        <NpcQuickViewModal
          npc={quickViewNpc}
          npcs={linkableNpcs}
          locationName={null}
          onClose={closeQuickView}
          onSelectNpc={selectNpc}
        />
      )}

      {showSettings && (
        <NoteViewSettingsModal settings={settings} onChange={updateSettings} onClose={() => setShowSettings(false)} />
      )}
    </div>
  )
}

// Two independently-scrollable columns, each its own <Markdown> render (see
// splitForDual) — not CSS multi-column, which would give one continuous
// scroll rather than two separate ones.
function DualPageBody({ text, previewClass, zoom, onInternalLink }: {
  text: string
  previewClass: string
  zoom: number
  onInternalLink: (target: string) => void
}) {
  const [left, right] = useMemo(() => splitForDual(text), [text])
  return (
    <div className="flex-1 min-h-0 flex gap-4 p-5 overflow-hidden">
      {[left, right].map((half, i) => (
        <div key={i} className="flex-1 min-w-0 h-full overflow-y-auto pr-1">
          <div style={{ zoom } as React.CSSProperties}>
            {half.trim()
              ? <Markdown text={half} tone="dark" size="sm" onInternalLink={onInternalLink} className={previewClass} />
              : (
                <p className="text-muted-foreground/40 italic text-xs">
                  {i === 1 ? <>Empty — click <SeparatorHorizontal className="inline size-3 -mt-0.5" /> in the editor toolbar to split content into this column.</> : "—"}
                </p>
              )}
          </div>
        </div>
      ))}
    </div>
  )
}

interface PageRange { section: number; start: number; end: number }

// Click-through pagination: the text first splits on the user's own marker
// (if any) into sections — each section is its own <Markdown> render so a
// marker always lands on a fresh page, never merging across one — and
// within each section, its top-level rendered elements (paragraphs,
// headings, lists, tables…) get bucketed into pages by cumulative height
// against the visible page box, same as before markers existed. Only the
// current page's section is shown, and only that page's element range
// within it (everything else `display:none`) — real print-style pagination
// on reflowable HTML has no simpler reliable way to avoid splitting a block
// mid-element.
function PagedBody({ text, previewClass, zoom, onInternalLink }: {
  text: string
  previewClass: string
  zoom: number
  onInternalLink: (target: string) => void
}) {
  const pageBoxRef = useRef<HTMLDivElement>(null)
  const outerRef = useRef<HTMLDivElement>(null)   // one wrapper div per section, each wrapping that section's own Markdown root
  const sections = useMemo(() => splitOnMarkers(text), [text])
  const [pages, setPages] = useState<PageRange[]>([{ section: 0, start: 0, end: Infinity }])
  const [page, setPage] = useState(0)

  function recompute() {
    const box = pageBoxRef.current
    const outer = outerRef.current
    if (!box || !outer) return
    const pageHeight = box.clientHeight
    if (pageHeight <= 0) return

    const result: PageRange[] = []
    Array.from(outer.children).forEach((sectionWrap, si) => {
      const markdownRoot = (sectionWrap as HTMLElement).firstElementChild as HTMLElement | null
      const children = markdownRoot ? (Array.from(markdownRoot.children) as HTMLElement[]) : []
      if (children.length === 0) { result.push({ section: si, start: 0, end: 0 }); return }

      let start = 0
      let pageTop = children[0].offsetTop
      for (let i = 1; i < children.length; i++) {
        const child = children[i]
        if ((child.offsetTop + child.offsetHeight) - pageTop > pageHeight) {
          result.push({ section: si, start, end: i })
          start = i
          pageTop = child.offsetTop
        }
      }
      result.push({ section: si, start, end: children.length })
    })

    setPages(result.length > 0 ? result : [{ section: 0, start: 0, end: 0 }])
    setPage(p => Math.min(p, Math.max(0, result.length - 1)))
  }

  useLayoutEffect(() => {
    recompute()
    const box = pageBoxRef.current
    if (!box) return
    const ro = new ResizeObserver(() => recompute())
    ro.observe(box)
    return () => ro.disconnect()
  }, [sections, previewClass, zoom])

  useLayoutEffect(() => {
    const outer = outerRef.current
    if (!outer) return
    const current = pages[page]
    Array.from(outer.children).forEach((sectionWrap, si) => {
      const el = sectionWrap as HTMLElement
      if (!current || si !== current.section) { el.style.display = "none"; return }
      el.style.display = ""
      const markdownRoot = el.firstElementChild as HTMLElement | null
      if (!markdownRoot) return
      Array.from(markdownRoot.children).forEach((child, i) => {
        ;(child as HTMLElement).style.display = (i >= current.start && i < current.end) ? "" : "none"
      })
    })
    // A new page starts scrolled wherever the last one left off otherwise —
    // only matters for the overflow-y-auto safety net below, but jumping to
    // the top on every page change reads as a bug either way.
    if (pageBoxRef.current) pageBoxRef.current.scrollTop = 0
  }, [pages, page])

  return (
    <div className="flex-1 min-h-0 flex flex-col p-5 gap-2">
      {/* overflow-y-auto, not hidden — recompute() sizes pages to fit
          exactly, so this never shows a scrollbar in the normal case, but a
          single element too tall for one page (a big image/table) can't be
          split further, and would otherwise just get silently clipped. */}
      <div ref={pageBoxRef} className="flex-1 min-h-0 overflow-y-auto">
        <div ref={outerRef} style={{ zoom } as React.CSSProperties}>
          {sections.map((section, i) => (
            <div key={i}>
              <Markdown text={section} tone="dark" size="sm" onInternalLink={onInternalLink} className={previewClass} />
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-center gap-3 shrink-0 pt-1">
        <button type="button" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}
          className="size-6 flex items-center justify-center rounded-full bg-foreground/10 hover:bg-foreground/20 disabled:opacity-30 disabled:hover:bg-foreground/10 text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-3.5" />
        </button>
        <span className="text-[10px] text-muted-foreground/60 tabular-nums">Page {page + 1} of {pages.length}</span>
        <button type="button" disabled={page >= pages.length - 1} onClick={() => setPage(p => Math.min(pages.length - 1, p + 1))}
          className="size-6 flex items-center justify-center rounded-full bg-foreground/10 hover:bg-foreground/20 disabled:opacity-30 disabled:hover:bg-foreground/10 text-muted-foreground hover:text-foreground">
          <ChevronRight className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

function SegButton({ active, onClick, title, children }: { active: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${active ? "bg-violet-500/80 text-white" : "bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80"}`}
    >
      {children}
    </button>
  )
}

function NoteViewSettingsModal({ settings, onChange, onClose }: {
  settings: Required<NoteViewSettings>
  onChange: (patch: Partial<NoteViewSettings>) => void
  onClose: () => void
}) {
  return (
    <Modal onClose={onClose}>
      <div className="bg-zinc-900 border border-white/15 rounded-2xl shadow-2xl w-[min(420px,92vw)] max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <p className="text-sm font-bold text-white">View Settings</p>
          <button type="button" onClick={onClose}
            className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-5">

          <div className="flex flex-col gap-2">
            <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Layout</p>
            <div className="grid grid-cols-2 gap-1.5">
              <SegButton active={settings.viewMode === "normal"} onClick={() => onChange({ viewMode: "normal" })} title="Normal — single column, comfortable reading width">
                <Rows3 className="size-3.5" /> Normal
              </SegButton>
              <SegButton active={settings.viewMode === "wide"} onClick={() => onChange({ viewMode: "wide" })} title="Wide — text fills the available width">
                <StretchHorizontal className="size-3.5" /> Wide
              </SegButton>
              <SegButton active={settings.viewMode === "dual"} onClick={() => onChange({ viewMode: "dual" })} title="Dual Column — two scrollable columns (Knonw as Dual Pag ewithin the codebase)">
                <Columns2 className="size-3.5" /> Dual Column
              </SegButton>
              <SegButton active={settings.viewMode === "paged"} onClick={() => onChange({ viewMode: "paged" })} title="Multiple Pages — click through page by page">
                <BookOpen className="size-3.5" /> Pages
              </SegButton>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Alignment</p>
            <div className="flex gap-1.5">
              <SegButton active={settings.align === "left"} onClick={() => onChange({ align: "left" })} title="Align left"><AlignLeft className="size-3.5" /></SegButton>
              <SegButton active={settings.align === "center"} onClick={() => onChange({ align: "center" })} title="Align center"><AlignCenter className="size-3.5" /></SegButton>
              <SegButton active={settings.align === "right"} onClick={() => onChange({ align: "right" })} title="Align right"><AlignRight className="size-3.5" /></SegButton>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Font</p>
            <div className="flex gap-1.5">
              <SegButton active={settings.fontFamily === "sans"} onClick={() => onChange({ fontFamily: "sans" })} title="Sans-serif"><span className="font-sans">Sans</span></SegButton>
              <SegButton active={settings.fontFamily === "serif"} onClick={() => onChange({ fontFamily: "serif" })} title="Serif"><span className="font-serif">Serif</span></SegButton>
              <SegButton active={settings.fontFamily === "mono"} onClick={() => onChange({ fontFamily: "mono" })} title="Monospace"><span className="font-mono">Mono</span></SegButton>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Text Size</p>
            <div className="flex items-center gap-2">
              <button type="button" disabled={settings.zoom <= ZOOM_MIN}
                onClick={() => onChange({ zoom: Math.max(ZOOM_MIN, Math.round((settings.zoom - ZOOM_STEP) * 100) / 100) })}
                className="size-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 text-white/60 hover:text-white">
                <Minus className="size-3.5" />
              </button>
              <span className="flex-1 text-center text-xs text-white/60 tabular-nums">{Math.round(settings.zoom * 100)}%</span>
              <button type="button" disabled={settings.zoom >= ZOOM_MAX}
                onClick={() => onChange({ zoom: Math.min(ZOOM_MAX, Math.round((settings.zoom + ZOOM_STEP) * 100) / 100) })}
                className="size-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 text-white/60 hover:text-white">
                <Plus className="size-3.5" />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Line Spacing</p>
            <div className="grid grid-cols-2 gap-1.5">
              <SegButton active={settings.lineSpacing === "tight"} onClick={() => onChange({ lineSpacing: "tight" })} title="Compact">Compact</SegButton>
              <SegButton active={settings.lineSpacing === "normal"} onClick={() => onChange({ lineSpacing: "normal" })} title="Normal">Normal</SegButton>
              <SegButton active={settings.lineSpacing === "relaxed"} onClick={() => onChange({ lineSpacing: "relaxed" })} title="Relaxed">Relaxed</SegButton>
              <SegButton active={settings.lineSpacing === "loose"} onClick={() => onChange({ lineSpacing: "loose" })} title="Loose">Loose</SegButton>
            </div>
          </div>

        </div>
      </div>
    </Modal>
  )
}
