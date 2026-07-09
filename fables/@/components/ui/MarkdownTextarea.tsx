import { useRef, useState } from "react"
import { Bold, Italic, Code as CodeIcon, Table2, ImageIcon, Loader2 } from "lucide-react"
import { loadUserImages, uploadUserImage, type GalleryImage } from "../imageGallery"
import { PortraitModal } from "../character/modals/PortraitModal"

const MARKDOWN_TABLE = `| Header 1 | Header 2 | Header 3 |
| -------- | -------- | -------- |
| Cell     | Cell     | Cell     |
| Cell     | Cell     | Cell     |`

interface MarkdownTextareaProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  className?: string
  wrapperClassName?: string
  autoFocus?: boolean
  variant?: "docs" | "light"
  userId?: string | null  // when set, shows an image-upload toolbar button (uploads to the shared "fableimages" bucket)
}

// Wraps (or unwraps) the current selection with `marker` — e.g. Ctrl/Cmd+B
// wraps in **bold**. Mirrors the toggle behavior of Google Docs/Notion-style
// keyboard shortcuts: hitting the shortcut again on already-wrapped text
// removes the marker instead of double-wrapping.
function toggleWrap(el: HTMLTextAreaElement, value: string, onChange: (v: string) => void, marker: string) {
  const start = el.selectionStart
  const end = el.selectionEnd
  const before = value.slice(0, start)
  const selected = value.slice(start, end)
  const after = value.slice(end)
  const alreadyWrapped = before.endsWith(marker) && after.startsWith(marker)

  let next: string, nextStart: number, nextEnd: number
  if (alreadyWrapped) {
    next = before.slice(0, -marker.length) + selected + after.slice(marker.length)
    nextStart = start - marker.length
    nextEnd = end - marker.length
  } else {
    next = before + marker + selected + marker + after
    nextStart = start + marker.length
    nextEnd = end + marker.length
  }
  onChange(next)
  requestAnimationFrame(() => { el.focus(); el.selectionStart = nextStart; el.selectionEnd = nextEnd })
}

function insertAtCursor(el: HTMLTextAreaElement | null, value: string, onChange: (v: string) => void, text: string) {
  if (!el) { onChange(value + text); return }
  const start = el.selectionStart
  const end = el.selectionEnd
  const next = value.slice(0, start) + text + value.slice(end)
  onChange(next)
  const pos = start + text.length
  requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = pos })
}

// Google Docs/Notion-style list continuation: Enter inside a "- "/"* "/"1. "
// line carries the marker to the next line; Enter on an empty marker exits
// the list instead of inserting another bullet.
function handleListEnter(el: HTMLTextAreaElement, value: string, onChange: (v: string) => void, e: React.KeyboardEvent) {
  const start = el.selectionStart
  const lineStart = value.lastIndexOf("\n", start - 1) + 1
  const line = value.slice(lineStart, start)
  const match = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/)
  if (!match) return false
  const [, indent, marker, rest] = match

  e.preventDefault()
  if (rest.trim() === "") {
    const next = value.slice(0, lineStart) + value.slice(start)
    onChange(next)
    requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = lineStart })
    return true
  }

  const nextMarker = /^\d+\.$/.test(marker) ? `${parseInt(marker, 10) + 1}.` : marker
  const insertion = `\n${indent}${nextMarker} `
  const next = value.slice(0, start) + insertion + value.slice(start)
  onChange(next)
  const pos = start + insertion.length
  requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = pos })
  return true
}

export function MarkdownTextarea({
  value, onChange, placeholder, rows = 4,
  className = "", wrapperClassName, autoFocus, variant = "docs",
  userId,
}: MarkdownTextareaProps) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [showImagePicker, setShowImagePicker] = useState(false)
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([])
  const [galleryLoading, setGalleryLoading] = useState(false)

  function insertTable() {
    const prefix = value && !value.endsWith("\n") ? "\n\n" : value ? "\n" : ""
    onChange(value + prefix + MARKDOWN_TABLE)
  }

  async function openImagePicker() {
    setShowImagePicker(true)
    if (!userId) return
    setGalleryLoading(true)
    setGalleryImages(await loadUserImages(userId))
    setGalleryLoading(false)
  }

  function chooseImage(url: string) {
    insertAtCursor(innerRef.current, value, onChange, `![image](${url})`)
    setShowImagePicker(false)
  }

  async function handleImageFile(file: File) {
    if (!userId) return
    setUploading(true)
    try {
      const url = await uploadUserImage(userId, file)
      if (url) insertAtCursor(innerRef.current, value, onChange, `![image](${url})`)
    } finally {
      setUploading(false)
      setShowImagePicker(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget
    const mod = e.metaKey || e.ctrlKey
    if (mod && e.key.toLowerCase() === "b") { e.preventDefault(); toggleWrap(el, value, onChange, "**"); return }
    if (mod && e.key.toLowerCase() === "i") { e.preventDefault(); toggleWrap(el, value, onChange, "*"); return }
    if (mod && e.key.toLowerCase() === "e") { e.preventDefault(); toggleWrap(el, value, onChange, "`"); return }
    if (e.key === "Enter") handleListEnter(el, value, onChange, e)
  }

  const toolCls = variant === "docs"
    ? "size-6 flex items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground hover:border-border transition-colors disabled:opacity-40"
    : "size-6 flex items-center justify-center rounded border border-white/15 text-white/40 hover:text-white/80 hover:border-white/30 transition-colors disabled:opacity-40"

  return (
    <div className={wrapperClassName ?? "flex flex-col gap-1.5"}>
      <div className="flex items-center justify-end gap-1">
        <button type="button" className={toolCls} title="Bold (Ctrl/Cmd+B)"
          onClick={() => innerRef.current && toggleWrap(innerRef.current, value, onChange, "**")}>
          <Bold className="size-3.5" />
        </button>
        <button type="button" className={toolCls} title="Italic (Ctrl/Cmd+I)"
          onClick={() => innerRef.current && toggleWrap(innerRef.current, value, onChange, "*")}>
          <Italic className="size-3.5" />
        </button>
        <button type="button" className={toolCls} title="Code (Ctrl/Cmd+E)"
          onClick={() => innerRef.current && toggleWrap(innerRef.current, value, onChange, "`")}>
          <CodeIcon className="size-3.5" />
        </button>
        <button type="button" className={toolCls} title="Insert table" onClick={insertTable}>
          <Table2 className="size-3.5" />
        </button>
        {userId && (
          <>
            <button type="button" className={toolCls} title="Insert image" disabled={uploading}
              onClick={openImagePicker}>
              {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <ImageIcon className="size-3.5" />}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f) }} />
          </>
        )}
      </div>
      {showImagePicker && (
        <PortraitModal
          title="Insert Image"
          galleryImages={galleryImages}
          galleryLoading={galleryLoading}
          onChoose={chooseImage}
          onUploadClick={() => fileInputRef.current?.click()}
          onClose={() => setShowImagePicker(false)}
        />
      )}
      <textarea
        ref={innerRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={className}
        autoFocus={autoFocus}
      />
    </div>
  )
}
