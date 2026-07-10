// ════════════════════════════════════════════════════════════════════════════
// SpelldleModal.tsx — daily D&D spell guessing game (Loldle/onepiecedle-style)
//
// Each guess is a real spell name (autocomplete, so you don't have to spell
// it right — just recognize it). Instead of per-letter Wordle scoring, each
// guess renders a row of attribute cells — Level, School, Class, Damage,
// Save — colored against the target spell. Progress autosaves to
// localStorage and flushes on close.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react"
import {
  loadOrCreateSave, saveSpelldle, scoreGuess, getAllSpells,
  MAX_GUESSES, type SpelldleSave, type AttributeResult,
} from "./spelldleLogic"
import type { Spell } from "../../../src/spells/types"

interface Props {
  onClose: () => void
  onWin?: () => void
}

const STATUS_STYLES: Record<AttributeResult["status"], string> = {
  correct: "bg-green-600 border-green-500 text-white",
  close:   "bg-amber-500 border-amber-400 text-white",
  absent:  "bg-white/10 border-white/10 text-white/50",
}

// The "classes" cell can hold a long comma-separated list ("Cleric, Druid,
// Ranger, Wizard") — give it noticeably more room than the single-word
// columns and let it wrap instead of getting ellipsis-truncated illegibly.
function attrFlex(key: AttributeResult["key"]) {
  return key === "classes" ? "flex-[2]" : "flex-1"
}

function AttrCell({ result }: { result: AttributeResult }) {
  const wide = result.key === "classes"
  return (
    <div className={`${attrFlex(result.key)} min-w-0 flex flex-col items-center justify-center gap-0.5 rounded-md border px-1.5 py-2 text-center transition-colors ${STATUS_STYLES[result.status]}`}>
      <span className="text-[8px] uppercase tracking-widest opacity-70">{result.label}</span>
      <span className={`text-[11px] font-bold leading-tight max-w-full ${wide ? "whitespace-normal break-words line-clamp-2" : "truncate"}`} title={result.value}>
        {result.value}{result.hint === "higher" ? " ↑" : result.hint === "lower" ? " ↓" : ""}
      </span>
    </div>
  )
}

export function SpelldleModal({ onClose, onWin }: Props) {
  const [save, setSave] = useState<SpelldleSave | null>(null)
  const [allSpells, setAllSpells] = useState<Spell[]>([])
  const [input, setInput] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justWon, setJustWon] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const saveRef = useRef<SpelldleSave | null>(null)

  useEffect(() => {
    loadOrCreateSave().then(s => { setSave(s); saveRef.current = s })
    getAllSpells().then(setAllSpells)
  }, [])

  function handleClose() {
    if (saveRef.current) saveSpelldle(saveRef.current)  // flush immediately on close
    onClose()
  }

  const suggestions = input.trim().length === 0 ? [] : allSpells
    .filter(s => s.name.toLowerCase().includes(input.trim().toLowerCase()))
    .slice(0, 8)

  function submitGuess(rawGuess: string) {
    if (!save || save.won || save.lost) return
    const guessName = rawGuess.trim()
    if (!guessName) return
    const guessSpell = allSpells.find(s => s.name.toLowerCase() === guessName.toLowerCase())
    if (!guessSpell) {
      setError("Not a recognized spell — pick one from the suggestions below.")
      return
    }
    if (save.guesses.some(g => g.spellName.toLowerCase() === guessSpell.name.toLowerCase())) {
      setError("Already guessed that one.")
      return
    }
    setError(null)
    const results = scoreGuess(guessSpell, save.targetAttrs)
    const guesses = [...save.guesses, { spellName: guessSpell.name, results }]
    const won = guessSpell.name.toLowerCase() === save.target.toLowerCase()
    const lost = !won && guesses.length >= MAX_GUESSES
    const next = { ...save, guesses, won, lost }
    setSave(next)
    saveRef.current = next
    saveSpelldle(next)
    setInput("")
    setShowSuggestions(false)
    if (won) {
      setJustWon(true)
      onWin?.()
      setTimeout(() => setJustWon(false), 3200)
    }
  }

  const gameOver = !!save && (save.won || save.lost)

  if (!save) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="bg-zinc-900 border border-white/15 rounded-2xl shadow-2xl px-8 py-6 text-white/60 text-sm">
          Picking today's spell…
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={handleClose}>
      <div
        className="bg-zinc-900 border border-white/15 rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto overflow-x-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10 shrink-0">
          <span className="text-3xl">✨</span>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-bold text-white">Spelldle</p>
            <p className="text-xs text-white/40">
              Today's spell — {save.seed} · {save.guesses.length}/{MAX_GUESSES} guesses
            </p>
          </div>
          <button type="button" onClick={handleClose}
            className="size-9 flex items-center justify-center rounded-md hover:bg-white/10 text-white/50 hover:text-white transition-colors shrink-0">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-4">
          {/* Column headers */}
          {save.guesses.length > 0 && (
            <div className="flex gap-1.5 px-1">
              <span className="w-20 shrink-0" />
              {save.guesses[0].results.map(r => (
                <span key={r.key} className={`${attrFlex(r.key)} min-w-0 text-center text-[8px] uppercase tracking-widest text-white/30 truncate`}>{r.label}</span>
              ))}
            </div>
          )}

          {/* Guess rows */}
          <div className="flex flex-col gap-1.5">
            {save.guesses.map((g, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="w-20 shrink-0 text-[11px] text-white/70 font-semibold truncate" title={g.spellName}>{g.spellName}</span>
                {g.results.map(r => <AttrCell key={r.key} result={r} />)}
              </div>
            ))}
            {Array.from({ length: MAX_GUESSES - save.guesses.length }).map((_, i) => (
              <div key={`empty-${i}`} className="h-11 rounded-md border border-dashed border-white/10" />
            ))}
          </div>

          {/* Input + autocomplete */}
          {!gameOver && (
            <div className="relative w-full">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => { setInput(e.target.value); setShowSuggestions(true); setError(null) }}
                  onFocus={() => setShowSuggestions(true)}
                  onKeyDown={e => { if (e.key === "Enter") submitGuess(input) }}
                  placeholder="Type a spell name…"
                  className="flex-1 bg-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 transition-colors focus:bg-white/15"
                />
                <button type="button" onClick={() => submitGuess(input)}
                  className="text-xs font-semibold px-3 py-2 rounded-lg bg-primary/80 hover:bg-primary text-white transition-colors shrink-0">
                  Guess
                </button>
              </div>

              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-zinc-800 border border-white/15 rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto animate-in fade-in duration-150">
                  {suggestions.map(s => (
                    <button key={s.name} type="button"
                      onClick={() => { setInput(s.name); setShowSuggestions(false); inputRef.current?.focus() }}
                      className="w-full text-left px-3 py-2 text-xs text-white/80 hover:bg-white/10 transition-colors">
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && <p className="text-xs text-red-300 text-center">{error}</p>}

          <p className="text-[11px] text-white/30 text-center leading-relaxed">
            Green = exact match. Amber = close (level within 1, or shares a class). Gray = no match.
            Start typing to see matching spells — click one to fill it in.
          </p>
        </div>

        {/* Footer */}
        {gameOver && (
          <div className="px-6 pb-6">
            <div className={`rounded-xl border px-4 py-3 text-center ${save.won ? "bg-emerald-500/15 border-emerald-500/30" : "bg-red-500/10 border-red-500/30"}`}>
              <p className={`text-sm font-bold ${save.won ? "text-emerald-300" : "text-red-300"}`}>
                {save.won
                  ? `🎉 Solved in ${save.guesses.length}/${MAX_GUESSES}! It was ${save.target}.`
                  : `Out of guesses — it was ${save.target}. Come back tomorrow!`}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Celebration overlay */}
      {justWon && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center pointer-events-none">
          <div className="animate-in fade-in zoom-in-50 duration-300 text-center">
            <p className="text-6xl mb-2">🎉</p>
            <p className="text-3xl font-black text-white drop-shadow-lg">yay!</p>
          </div>
        </div>
      )}
    </div>
  )
}
