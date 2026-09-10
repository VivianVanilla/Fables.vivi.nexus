// The "+" / right-click popover on a SpellCard — pick one of your own
// characters and the spell is added straight to their spellItems, Spotify's
// "add to playlist" menu but for spells. Positioned like SkillsCard.tsx's
// hand-rolled right-click menu (this app has no context-menu library).
import { useState } from "react"
import { Check, Loader2, User } from "lucide-react"
import { useUserContext } from "../contexts/UserContext"
import type { Spell } from "./types"
import { addSpellToCharacter } from "./addSpellToCharacter"

export function AddToCharacterMenu({ spell, x, y, onClose }: { spell: Spell; x: number; y: number; onClose: () => void }) {
  const { objects, updateObject } = useUserContext()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [addedId, setAddedId] = useState<string | null>(null)

  const characters = objects.filter(o => o.type === "character")

  async function pick(characterId: string) {
    const character = objects.find(o => o.id === characterId)
    if (!character || pendingId) return
    setPendingId(characterId)
    try {
      await addSpellToCharacter(character, spell, updateObject)
      setAddedId(characterId)
      setTimeout(onClose, 600)
    } catch (e) {
      console.error("Failed to add spell to character:", e)
      setPendingId(null)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} onContextMenu={e => { e.preventDefault(); onClose() }} />
      <div
        style={{ left: x, top: y }}
        className="fixed z-50 w-60 max-h-72 overflow-y-auto rounded-lg bg-zinc-900 border border-white/10 shadow-xl"
      >
        <div className="px-3 py-2 text-[10px] uppercase tracking-widest text-white/40 font-semibold border-b border-white/10 truncate">
          Add "{spell.name}" to…
        </div>
        {characters.length === 0 ? (
          <p className="px-3 py-3 text-xs text-white/30 italic">No characters yet</p>
        ) : (
          characters.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => pick(c.id)}
              disabled={pendingId !== null}
              className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-white/70"
            >
              <User className="size-3.5 text-white/30 shrink-0" />
              <span className="flex-1 truncate">{c.name}</span>
              {pendingId === c.id && <Loader2 className="size-3.5 animate-spin shrink-0 text-white/40" />}
              {addedId === c.id && <Check className="size-3.5 shrink-0 text-emerald-400" />}
            </button>
          ))
        )}
      </div>
    </>
  )
}
