import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CLASS_COLORS } from './constants'
import type { Spell } from './types'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Props {
  spell: Spell | null
  onClose: () => void
}

export function SpellModal({ spell, onClose }: Props) {
  return (
    <Dialog open={!!spell} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto bg-slate-950 border-slate-800">
        {spell && (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl pr-8">{spell.name}</DialogTitle>
              <p className="text-sm text-muted-foreground">
                {spell.school?.name} &middot; {spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`}
              </p>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm mb-4">
              <div><span className="text-slate-500">Casting Time</span><br /><span className="text-slate-200">{spell.casting_time}</span></div>
              <div><span className="text-slate-500">Range</span><br /><span className="text-slate-200">{spell.range}</span></div>
              <div><span className="text-slate-500">Duration</span><br /><span className="text-slate-200">{spell.duration}</span></div>
              <div><span className="text-slate-500">Components</span><br /><span className="text-slate-200">{spell.components?.join(', ')}</span></div>
            </div>

            {spell.materialComponents && spell.materials && (
              <p className="text-xs text-slate-500 -mt-2 mb-3">
                <span className="text-slate-400">Materials:</span> {spell.materials}
              </p>
            )}

            {spell.ritual && (
              <span className="inline-block mb-3 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/10 text-white border border-white/20">
                Ritual
              </span>
            )}

            <div className="text-sm leading-relaxed border-t border-slate-800 pt-4">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => <p className="text-slate-300 mb-2.5">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1 text-slate-300">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1 text-slate-300">{children}</ol>,
                  li: ({ children }) => <li>{children}</li>,
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-3">
                      <table className="w-full border border-slate-700 text-xs rounded">{children}</table>
                    </div>
                  ),
                  th: ({ children }) => <th className="border border-slate-700 px-3 py-1.5 bg-slate-900 text-left text-slate-300 font-medium">{children}</th>,
                  td: ({ children }) => <td className="border border-slate-800 px-3 py-1.5 text-slate-400">{children}</td>,
                  code: ({ children }) => <code className="bg-slate-900 px-1 py-0.5 rounded text-purple-300 text-xs">{children}</code>,
                }}
              >
                {Array.isArray(spell.desc) ? spell.desc.join('\n\n') : (spell.desc ?? '')}
              </ReactMarkdown>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-3 border-t border-slate-800">
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
