// ════════════════════════════════════════════════════════════════════════════
// SpelldleModal.tsx — daily D&D spell guessing game (Wordle, but spells)
//
// One spell per day (see spelldleLogic.ts). Guesses must be a real spell name
// whose letter-count matches the target — an autocomplete dropdown filters
// the full spell list as you type so you don't have to remember exact
// spelling, just recognize the right spell. Progress autosaves to
// localStorage and flushes on close.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react"
import {
  loadOrCreateSave, saveSpelldle, scoreGuess, lettersOnly, getAllSpellNames,
  MAX_GUESSES, type SpelldleSave, type LetterStatus,
} from "./spelldleLogic"

interface Props {
  onClose: () => void
}

const STATUS_STYLES: Record<LetterStatus, string> = {
  correct: "bg-green-600 border-green-500 text-white",
  present: "bg-amber-500 border-amber-400 text-white",
  absent:  "bg-white/10 border-white/10 text-white/50",
}

export function SpelldleModal({ onClose }: Props) {
  const [save, setSave] = useState<SpelldleSave | null>(null)
  const [allNames, setAllNames] = useState<string[]>([])
  const [input, setInput] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justWon, setJustWon] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const saveRef = useRef<SpelldleSave | null>(null)

  useEffect(() => {
    loadOrCreateSave().then(s => { setSave(s); saveRef.current = s })
    getAllSpellNames().then(setAllNames)
  }, [])

  function handleClose() {
    if (saveRef.current) saveSpelldle(saveRef.current)  // flush immediately on close
    onClose()
  }

  const targetLen = save?.targetLetters.length ?? 0

  const suggestions = input.trim().length === 0 ? [] : allNames
    .filter(n => lettersOnly(n).length === targetLen)
    .filter(n => n.toLowerCase().includes(input.trim().toLowerCase()))
    .slice(0, 8)

  function submitGuess(rawGuess: string) {
    if (!save || save.won || save.lost) return
    const guess = rawGuess.trim()
    if (!guess) return
    const letters = lettersOnly(guess)
    if (letters.length !== targetLen) {
      setError(`Needs to be ${targetLen} letters (like the highlighted answer length).`)
      return
    }
    const isRealSpell = allNames.some(n => n.toLowerCase() === guess.toLowerCase())
    if (!isRealSpell) {
      setError("Not a recognized spell name of the right length — try the suggestions below.")
      return
    }
    setError(null)
    const statuses = scoreGuess(guess, save.target)
    const guesses = [...save.guesses, { guess, statuses }]
    const won = statuses.every(s => s === "correct")
    const lost = !won && guesses.length >= MAX_GUESSES
    const next = { ...save, guesses, won, lost }
    setSave(next)
    saveRef.current = next
    saveSpelldle(next)
    setInput("")
    setShowSuggestions(false)
    if (won) {
      setJustWon(true)
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
        className="bg-zinc-900 border border-white/15 rounded-2xl shadow-2xl w-fit max-w-[95vw] max-h-[92vh] overflow-y-auto overflow-x-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10 shrink-0">
          <span className="text-3xl">✨</span>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-bold text-white">Spelldle</p>
            <p className="text-xs text-white/40">
              Today's spell — {save.seed} · {targetLen} letters · {save.guesses.length}/{MAX_GUESSES} guesses
            </p>
          </div>
          <button type="button" onClick={handleClose}
            className="size-9 flex items-center justify-center rounded-md hover:bg-white/10 text-white/50 hover:text-white transition-colors shrink-0">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col items-center gap-4">
          {/* Guess grid */}
          <div className="flex flex-col gap-1.5">
            {Array.from({ length: MAX_GUESSES }).map((_, rowIdx) => {
              const result = save.guesses[rowIdx]
              return (
                <div key={rowIdx} className="flex gap-1.5">
                  {Array.from({ length: targetLen }).map((_, colIdx) => {
                    const letter = result ? lettersOnly(result.guess)[colIdx] : ""
                    const status = result?.statuses[colIdx]
                    return (
                      <div key={colIdx}
                        className={`size-9 sm:size-10 flex items-center justify-center rounded-md border text-sm font-bold uppercase transition-colors
                          ${status ? STATUS_STYLES[status] : "bg-white/5 border-white/15 text-white"}`}>
                        {letter}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>

          {/* Input + autocomplete */}
          {!gameOver && (
            <div className="relative w-full max-w-sm">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => { setInput(e.target.value); setShowSuggestions(true); setError(null) }}
                  onFocus={() => setShowSuggestions(true)}
                  onKeyDown={e => { if (e.key === "Enter") submitGuess(input) }}
                  placeholder={`Type a ${targetLen}-letter spell…`}
                  className="flex-1 bg-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 transition-colors focus:bg-white/15"
                />
                <button type="button" onClick={() => submitGuess(input)}
                  className="text-xs font-semibold px-3 py-2 rounded-lg bg-primary/80 hover:bg-primary text-white transition-colors shrink-0">
                  Guess
                </button>
              </div>

              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-zinc-800 border border-white/15 rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto animate-in fade-in duration-150">
                  {suggestions.map(name => (
                    <button key={name} type="button"
                      onClick={() => { setInput(name); setShowSuggestions(false); inputRef.current?.focus() }}
                      className="w-full text-left px-3 py-2 text-xs text-white/80 hover:bg-white/10 transition-colors">
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && <p className="text-xs text-red-300 text-center">{error}</p>}

          <p className="text-[11px] text-white/30 text-center leading-relaxed max-w-sm">
            Green = right letter, right spot. Amber = right letter, wrong spot. Gray = not in the spell.
            Start typing to see matching spells of the right length — click one to fill it in.
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
