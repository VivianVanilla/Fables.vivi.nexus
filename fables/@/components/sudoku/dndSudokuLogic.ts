// ════════════════════════════════════════════════════════════════════════════
// dndSudokuLogic.ts — a real, uniquely-solvable Sudoku puzzle, generated fresh
// each day from a deterministic seed (so it's the same puzzle all day, and a
// new one tomorrow), themed with 9 spell names pulled from the site's spell
// list instead of the digits 1-9.
// ════════════════════════════════════════════════════════════════════════════

import { getSpells } from "../../../src/spells/spellCache"

export interface SudokuSave {
  seed: string
  givens: number[]     // 81 cells, 0 = empty in the original puzzle
  solution: number[]   // 81 cells, the fully-solved grid
  userGrid: number[]   // 81 cells, 0 = empty, else 1-9 — the player's progress
  symbols: string[]    // 9 spell names — symbols[0] represents digit 1, etc.
  hintCells: number[]  // indices revealed via the Hint button — hintCells.length is "hints used"
  completed: boolean
}

const STORAGE_KEY = "fables-dnd-sudoku"

// ── Seeded PRNG (mulberry32) — deterministic per day ─────────────────────────

function mulberry32(seed: number) {
  let s = seed | 0
  return function rand() {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seedToNumber(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}

export function getDailySeed(): string {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`
}

function shuffled<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── Grid validity helpers ────────────────────────────────────────────────────

function cellValid(grid: number[], pos: number, val: number): boolean {
  const row = Math.floor(pos / 9), col = pos % 9
  for (let i = 0; i < 9; i++) {
    if (grid[row * 9 + i] === val) return false
    if (grid[i * 9 + col] === val) return false
  }
  const br = Math.floor(row / 3) * 3, bc = Math.floor(col / 3) * 3
  for (let r = br; r < br + 3; r++) for (let c = bc; c < bc + 3; c++) if (grid[r * 9 + c] === val) return false
  return true
}

// ── Full solved grid via randomized backtracking ─────────────────────────────

function generateFullGrid(rand: () => number): number[] {
  const grid = new Array(81).fill(0)
  function fill(pos: number): boolean {
    if (pos === 81) return true
    for (const n of shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9], rand)) {
      if (cellValid(grid, pos, n)) {
        grid[pos] = n
        if (fill(pos + 1)) return true
        grid[pos] = 0
      }
    }
    return false
  }
  fill(0)
  return grid
}

// Counts solutions up to 2 (we only care whether it's exactly 1 — unique)
function countSolutions(grid: number[]): number {
  const g = [...grid]
  let count = 0
  function solve(): boolean {
    if (count >= 2) return true
    const pos = g.indexOf(0)
    if (pos === -1) { count++; return count >= 2 }
    for (let n = 1; n <= 9; n++) {
      if (cellValid(g, pos, n)) {
        g[pos] = n
        if (solve()) return true
        g[pos] = 0
      }
    }
    return false
  }
  solve()
  return count
}

// Removes cells one at a time, only keeping a removal if the puzzle still has
// exactly one solution — this is what makes it a "real" sudoku, not just a
// grid with holes poked in it.
function digHoles(solution: number[], rand: () => number, targetClues: number): number[] {
  const puzzle = [...solution]
  let clues = 81
  for (const pos of shuffled([...Array(81).keys()], rand)) {
    if (clues <= targetClues) break
    const backup = puzzle[pos]
    puzzle[pos] = 0
    if (countSolutions(puzzle) !== 1) puzzle[pos] = backup
    else clues--
  }
  return puzzle
}

export function isCompleteAndValid(grid: number[]): boolean {
  if (grid.includes(0)) return false
  const allNine = (cells: number[]) => new Set(cells).size === 9
  for (let r = 0; r < 9; r++) if (!allNine(grid.slice(r * 9, r * 9 + 9))) return false
  for (let c = 0; c < 9; c++) if (!allNine([0, 1, 2, 3, 4, 5, 6, 7, 8].map(r => grid[r * 9 + c]))) return false
  for (let br = 0; br < 3; br++) for (let bc = 0; bc < 3; bc++) {
    const cells: number[] = []
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cells.push(grid[(br * 3 + r) * 9 + (bc * 3 + c)])
    if (!allNine(cells)) return false
  }
  return true
}

const FALLBACK_SYMBOLS = ["Fireball", "Magic Missile", "Cure Wounds", "Shield", "Counterspell", "Fly", "Haste", "Mage Hand", "Bless"]

async function generatePuzzle(seed: string): Promise<SudokuSave> {
  const rand = mulberry32(seedToNumber(seed))
  const solution = generateFullGrid(rand)
  const givens = digHoles(solution, rand, 30)  // ~30 clues — medium difficulty

  const spells = await getSpells()
  const names = Array.from(new Set(spells.map(s => s.name).filter(Boolean)))
  const symbols = names.length >= 9 ? shuffled(names, rand).slice(0, 9) : FALLBACK_SYMBOLS

  return { seed, givens, solution, userGrid: [...givens], symbols, hintCells: [], completed: false }
}

export async function loadOrCreateSave(): Promise<SudokuSave> {
  const seed = getDailySeed()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as SudokuSave
      if (parsed.seed === seed) return { ...parsed, hintCells: parsed.hintCells ?? [] }
    }
  } catch { /* corrupt/missing save — fall through and generate fresh */ }
  const fresh = await generatePuzzle(seed)
  saveSudoku(fresh)
  return fresh
}

export function saveSudoku(save: SudokuSave) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(save)) }
  catch (e) { console.error("Failed to save sudoku progress:", e) }
}
