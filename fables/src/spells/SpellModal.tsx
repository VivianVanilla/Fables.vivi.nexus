import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CLASS_COLORS } from './constants'
import type { Spell } from './types'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'

interface Props {
  spell: Spell | null
  onClose: () => void
}

export function SpellModal({ spell, onClose }: Props) {
  return (
    <Dialog open={!!spell} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto bg-background border-border">
        {spell && (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl pr-8">{spell.name}</DialogTitle>
              <p className="text-sm text-muted-foreground">
                {spell.school?.name} &middot; {spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`}
              </p>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm mb-4">
              <div><span className="text-muted-foreground">Casting Time</span><br /><span className="text-foreground">{spell.casting_time}</span></div>
              <div><span className="text-muted-foreground">Range</span><br /><span className="text-foreground">{spell.range}</span></div>
              <div><span className="text-muted-foreground">Duration</span><br /><span className="text-foreground">{spell.duration}</span></div>
              <div><span className="text-muted-foreground">Components</span><br /><span className="text-foreground">{spell.components?.join(', ')}</span></div>
            </div>

            {spell.materialComponents && spell.materials && (
              <p className="text-xs text-muted-foreground -mt-2 mb-3">
                <span className="text-muted-foreground">Materials:</span> {spell.materials}
              </p>
            )}

            {spell.ritual && (
              <span className="inline-block mb-3 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-black/30 text-white border border-white/20">
                Ritual
              </span>
            )}

            <div className="text-sm leading-relaxed border-t border-border pt-4">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                components={{
                  p: ({ children }) => <p className="text-foreground mb-2.5 whitespace-pre-wrap">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1 text-foreground">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1 text-foreground">{children}</ol>,
                  li: ({ children }) => <li>{children}</li>,
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-3">
                      <table className="w-full border border-border text-xs rounded">{children}</table>
                    </div>
                  ),
                  th: ({ children }) => <th className="border border-border px-3 py-1.5 bg-card text-left text-foreground font-medium">{children}</th>,
                  td: ({ children }) => <td className="border border-border px-3 py-1.5 text-muted-foreground">{children}</td>,
                  code: ({ children }) => <code className="bg-card px-1 py-0.5 rounded text-purple-300 text-xs">{children}</code>,
                }}
              >
                {Array.isArray(spell.desc) ? spell.desc.join('\n\n') : (spell.desc ?? '')}
              </ReactMarkdown>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-3 border-t border-border">
              {spell.classes?.map((c) => {
                const color = CLASS_COLORS[c.name] ?? '#6B7280'
                return (
                  <span
                    key={c.name}
                    className="text-xs px-2 py-0.5 rounded text-white/90"
                    style={{ backgroundColor: `${color}2a`, border: `1px solid ${color}60` }}
                  >
                    {c.name}
                  </span>
                )
              })}
              {spell.ctag && (
                <span className="text-xs px-2 py-0.5 rounded border border-purple-500/30 bg-purple-950/40 text-purple-400">
                  {spell.ctag}
                </span>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
