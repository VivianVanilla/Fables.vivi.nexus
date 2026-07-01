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
}

export function MarkdownTextarea({
  value, onChange, placeholder, rows = 4,
  className = "", wrapperClassName, autoFocus, variant = "docs",
}: MarkdownTextareaProps) {
  function insertTable() {
    const prefix = value && !value.endsWith("\n") ? "\n\n" : value ? "\n" : ""
    onChange(value + prefix + MARKDOWN_TABLE)
  }

  const btnCls = variant === "docs"
    ? "text-[10px] uppercase tracking-wide px-2.5 py-1 rounded border border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-600 transition-colors"
    : "text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border border-white/15 text-white/30 hover:text-white/50 hover:border-white/30 transition-colors"

  return (
    <div className={wrapperClassName ?? "flex flex-col gap-1.5"}>
      <div className="flex justify-end">
        <button type="button" onClick={insertTable} className={btnCls}>
          + Insert Table
        </button>
      </div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={className}
        autoFocus={autoFocus}
      />
    </div>
  )
}
