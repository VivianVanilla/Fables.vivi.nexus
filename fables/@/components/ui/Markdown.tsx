// ════════════════════════════════════════════════════════════════════════════
// Markdown.tsx — shared renderer for text entered via MarkdownTextarea
//
// Renders with explicit Tailwind classes (not the `prose` typography plugin,
// which isn't installed in this project) so spacing and table styling are
// actually under our control.
// ════════════════════════════════════════════════════════════════════════════

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkBreaks from "remark-breaks"

// Users often type/paste table rows or list items separated by blank lines.
// A GFM table requires its rows on consecutive lines (a stray blank line
// breaks it into disconnected paragraphs instead of a table), and a markdown
// list with a blank line between items becomes a "loose" list, where each
// item's text gets wrapped in its own <p> — which visually shoves the text
// away from its bullet. Collapse blank lines that sit between two rows/items
// of the same kind so both parse the way the user actually intended.
function normalizeBlankLines(md: string): string {
  const isRow  = (l: string) => /\|/.test(l) && l.trim().length > 0
  const isItem = (l: string) => /^\s*([-*+]|\d+[.)])\s+/.test(l)

  const lines = md.split("\n")
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim() === "") {
      const prev = out[out.length - 1] ?? ""
      const next = lines.slice(i + 1).find(l => l.trim() !== "") ?? ""
      if (isRow(prev) && isRow(next)) continue
      if (isItem(next) && (isItem(prev) || out.length === 0)) continue
    }
    out.push(line)
  }
  return out.join("\n")
}

interface Tone {
  text: string
  heading: string
  muted: string
  border: string
  headBg: string
  code: string
}

const TONES: Record<"dark" | "slate", Tone> = {
  dark:  { text: "text-white/70",   heading: "text-white",        muted: "text-white/55",   border: "border-white/10",   headBg: "bg-white/5",     code: "bg-white/10 text-white/80" },
  slate: { text: "text-slate-400",  heading: "text-slate-100",    muted: "text-slate-400",  border: "border-slate-700",  headBg: "bg-slate-800/70", code: "bg-slate-800 text-purple-300" },
}

interface MarkdownProps {
  text: string
  tone?: "dark" | "slate"
  size?: "sm" | "xs"
  className?: string
}

export function Markdown({ text, tone = "dark", size = "sm", className = "" }: MarkdownProps) {
  const c = TONES[tone]

  return (
    // `space-y-*` only spaces DIRECT children of this div — unlike a margin baked into
    // the `p`/`h1`/etc. components themselves, it never touches a `<p>` nested inside a
    // `<li>` (which happens whenever a list has a blank line between items), so list
    // items stay flush against their bullet instead of getting pushed down.
    <div className={`${size === "xs" ? "text-xs" : "text-sm"} leading-relaxed ${c.text} space-y-2 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          p:  ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
          h1: ({ children }) => <h1 className={`text-lg font-bold ${c.heading}`}>{children}</h1>,
          h2: ({ children }) => <h2 className={`text-base font-bold ${c.heading}`}>{children}</h2>,
          h3: ({ children }) => <h3 className={`text-sm font-bold ${c.heading}`}>{children}</h3>,
          ul: ({ children }) => <ul className="list-disc pl-5 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="whitespace-pre-wrap">{children}</li>,
          strong: ({ children }) => <strong className={`font-semibold ${c.heading}`}>{children}</strong>,
          hr: () => <hr className={c.border} />,
          code: ({ children }) => <code className={`px-1 py-0.5 rounded text-xs font-mono ${c.code}`}>{children}</code>,
          img: ({ src, alt }) => <img src={src} alt={alt ?? ""} className={`max-w-full rounded-lg border ${c.border}`} />,
          a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer" className="underline decoration-dotted hover:opacity-80">{children}</a>,
          table: ({ children }) => (
            <div className={`overflow-x-auto rounded-md border ${c.border}`}>
              <table className="w-full text-xs border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className={c.headBg}>{children}</thead>,
          th: ({ children }) => <th className={`px-2.5 py-1.5 text-left font-semibold border-b whitespace-pre-wrap ${c.border} ${c.heading}`}>{children}</th>,
          td: ({ children }) => <td className={`px-2.5 py-1.5 align-top border-b whitespace-pre-wrap ${c.border} ${c.muted}`}>{children}</td>,
        }}
      >
        {normalizeBlankLines(text)}
      </ReactMarkdown>
    </div>
  )
}
