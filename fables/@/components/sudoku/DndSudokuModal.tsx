// ════════════════════════════════════════════════════════════════════════════
// DndSudokuModal.tsx — daily D&D-themed Sudoku, easter egg for a couple users
//
// Real sudoku rules underneath (see dndSudokuLogic.ts) — the "digits" 1-9 are
// just re-skinned as 9 spell names pulled from the site's live spell list,
// re-rolled once per day from a deterministic seed. Progress autosaves to
// localStorage as you play and flushes on close.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react"
import { loadOrCreateSave, saveSudoku, isCompleteAndValid, type SudokuSave } from "./dndSudokuLogic"

interface Props {
  onClose: () => void
}

const CELL_COLORS = [
  "text-red-300", "text-orange-300", "text-amber-300", "text-lime-300", "text-emerald-300",
  "text-cyan-300", "text-sky-300", "text-violet-300", "text-fuchsia-300",
]

export function DndSudokuModal({ onClose }: Props) {
  const [save, setSave] = useState<SudokuSave | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [justCompleted, setJustCompleted] = useState(false)
  const [showRules, setShowRules] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveRef = useRef<SudokuSave | null>(null)

  useEffect(() => {
    loadOrCreateSave().then(s => { setSave(s); saveRef.current = s })
  }, [])

  function scheduleSave(next: SudokuSave) {
    setSave(next)
    saveRef.current = next
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveSudoku(next), 400)
  }

  function handleClose() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    if (saveRef.current) saveSudoku(saveRef.current)  // flush immediately on close, per the ask
    onClose()
  }

  function fillCell(value: number) {
    if (!save || selected === null || save.completed) return
    if (save.givens[selected] !== 0) return  // can't overwrite a given clue
    const userGrid = [...save.userGrid]
    userGrid[selected] = value
    const completed = isCompleteAndValid(userGrid)
    const next = { ...save, userGrid, completed }
    scheduleSave(next)
    if (completed && !save.completed) {
      setJustCompleted(true)
      setTimeout(() => setJustCompleted(false), 3200)
    }
  }

  function clearCell() {
    if (!save || selected === null) return
    if (save.givens[selected] !== 0) return
    const userGrid = [...save.userGrid]
    userGrid[selected] = 0
    const hintCells = save.hintCells.filter(c => c !== selected)
    scheduleSave({ ...save, userGrid, hintCells, completed: false })
  }

  // Reveals the correct answer for the selected empty cell and counts it as a
  // used hint (tracked via hintCells, shown in the header and styled distinctly).
  function useHint() {
    if (!save || selected === null || save.completed) return
    if (save.givens[selected] !== 0 || save.userGrid[selected] !== 0) return
    const userGrid = [...save.userGrid]
    userGrid[selected] = save.solution[selected]
    const hintCells = [...save.hintCells, selected]
    const completed = isCompleteAndValid(userGrid)
    const next = { ...save, userGrid, hintCells, completed }
    scheduleSave(next)
    if (completed && !save.completed) {
      setJustCompleted(true)
      setTimeout(() => setJustCompleted(false), 3200)
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (selected === null) return
      if (e.key >= "1" && e.key <= "9") fillCell(parseInt(e.key))
      if (e.key === "Backspace" || e.key === "Delete") clearCell()
      if (e.key.toLowerCase() === "h") useHint()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, save])

  if (!save) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="bg-zinc-900 border border-white/15 rounded-2xl shadow-2xl px-8 py-6 text-white/60 text-sm">
          Rolling today's puzzle…
        </div>
      </div>
    )
  }

  const filledCount = save.userGrid.filter(v => v !== 0).length
  const selectedIsEditable = selected !== null && save.givens[selected] === 0

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={handleClose}>
      <div
        className="bg-zinc-900 border border-white/15 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[94vh] overflow-y-auto flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10 shrink-0">
          <span className="text-3xl">🧩</span>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-bold text-white">D&D Sudoku</p>
            <p className="text-xs text-white/40">
              Today's puzzle — {save.seed} · {filledCount}/81 filled · {save.hintCells.length} hint{save.hintCells.length === 1 ? "" : "s"} used
            </p>
          </div>
          <button type="button" onClick={() => setShowRules(true)}
            className="text-xs px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors shrink-0">
            Rules
          </button>
          <button type="button" onClick={handleClose}
            className="size-9 flex items-center justify-center rounded-md hover:bg-white/10 text-white/50 hover:text-white transition-colors shrink-0">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col items-center gap-5">
          {/* Grid — cells wrap onto multiple lines so no spell name gets clipped;
              rows grow to fit their longest name instead of forcing a square */}
          <div className="grid grid-cols-9 border-2 border-white/30 rounded-lg overflow-hidden bg-white/5 w-full max-w-3xl">
            {save.userGrid.map((val, i) => {
              const isGiven = save.givens[i] !== 0
              const isHint  = save.hintCells.includes(i)
              const row = Math.floor(i / 9), col = i % 9
              const boxParity = (Math.floor(row / 3) + Math.floor(col / 3)) % 2 === 0
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelected(i)}
                  className={`relative flex items-center justify-center text-center text-[9px] sm:text-[11px] font-bold leading-[1.15] p-1 min-h-16 sm:min-h-20 transition-colors
                    ${boxParity ? "bg-white/5" : "bg-transparent"}
                    ${selected === i ? "ring-2 ring-inset ring-primary bg-primary/20" : ""}
                    ${col % 3 === 0 ? "border-l-2 border-l-white/30" : "border-l border-l-white/5"}
                    ${row % 3 === 0 ? "border-t-2 border-t-white/30" : "border-t border-t-white/5"}
                    ${isGiven ? "text-white cursor-default" : `${CELL_COLORS[(val || 1) - 1]} hover:bg-white/10 cursor-pointer`}
                  `}
                  title={val ? save.symbols[val - 1] : "Empty"}
                >
                  {isHint && <span className="absolute top-0.5 right-0.5 text-[7px] text-amber-300">✦</span>}
                  <span className="whitespace-normal break-words px-0.5">
                    {val ? save.symbols[val - 1] : ""}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Symbol palette — fewer columns so full names fit without truncation */}
          <div className="grid grid-cols-3 gap-2 w-full max-w-3xl">
            {save.symbols.map((name, i) => (
              <button
                key={name}
                type="button"
                onClick={() => fillCell(i + 1)}
                disabled={!selectedIsEditable}
                className={`text-xs font-semibold px-2 py-2.5 rounded-lg bg-white/5 hover:bg-white/15 disabled:opacity-30 disabled:cursor-default transition-colors whitespace-normal break-words leading-tight text-center ${CELL_COLORS[i]}`}
                title={name}
              >
                {name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={clearCell} disabled={!selectedIsEditable}
              className="text-xs px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white/60 hover:text-white transition-colors">
              Erase Cell
            </button>
            <button type="button" onClick={useHint} disabled={!selectedIsEditable}
              className="text-xs px-3 py-1.5 rounded-full bg-amber-500/15 hover:bg-amber-500/25 disabled:opacity-30 text-amber-300 hover:text-amber-200 transition-colors flex items-center gap-1.5">
              💡 Hint <span className="text-amber-300/60">({save.hintCells.length} used)</span>
            </button>
          </div>

          <p className="text-[11px] text-white/30 text-center leading-relaxed max-w-md">
            Click a cell, then click a spell below to fill it — or select a cell and press 1-9 on your keyboard.
            Stuck? Press Hint (or H) to reveal a cell. Need a refresher? See Rules above.
          </p>
        </div>

        {/* Footer */}
        {save.completed && (
          <div className="px-6 pb-6">
            <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-4 py-3 text-center">
              <p className="text-sm font-bold text-emerald-300">
                🎉 Solved! ({save.hintCells.length} hint{save.hintCells.length === 1 ? "" : "s"} used) — come back tomorrow for a new one.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Rules panel */}
      {showRules && (
        <div className="fixed inset-0 z-[105] flex items-center justify-center bg-black/60 p-4" onClick={() => setShowRules(false)}>
          <div className="bg-zinc-900 border border-white/15 rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-3 text-white animate-in fade-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-base font-bold">How to solve it</p>
              <button type="button" onClick={() => setShowRules(false)} className="text-white/40 hover:text-white text-sm transition-colors">✕</button>
            </div>
            <p className="text-sm text-white/70 leading-relaxed">
              It's regular Sudoku — the 9 spells just stand in for the numbers 1 through 9. The board is a 9×9 grid split into nine 3×3 boxes (outlined with thicker borders).
            </p>
            <ul className="text-sm text-white/70 leading-relaxed list-disc pl-5 flex flex-col gap-1.5">
              <li>Every <strong>row</strong> (9 cells across) must contain all 9 spells, no repeats.</li>
              <li>Every <strong>column</strong> (9 cells down) must contain all 9 spells, no repeats.</li>
              <li>Every <strong>3×3 box</strong> must contain all 9 spells, no repeats.</li>
              <li>White cells are the starting clues and can't be changed.</li>
              <li>Colored cells are yours to fill — click one, then pick a spell from the palette (or type 1-9).</li>
            </ul>
            <p className="text-sm text-white/70 leading-relaxed">
              Logic tip: if a spell already appears somewhere in a cell's row, column, or box, it can't go in that cell. Start with cells that only have one possible spell left.
            </p>
            <button type="button" onClick={() => setShowRules(false)}
              className="mt-1 text-sm font-semibold px-4 py-2 rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors self-end">
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Celebration overlay */}
      {justCompleted && (
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
