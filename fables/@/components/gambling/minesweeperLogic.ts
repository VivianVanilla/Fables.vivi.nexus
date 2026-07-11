// ════════════════════════════════════════════════════════════════════════════
// minesweeperLogic.ts — real Minesweeper board (mine placement, adjacency
// counts, flood-fill reveal) for the bet-to-clear-the-board mini-game. The
// multiplier is a flat number per difficulty tier — you either clear every
// safe tile and collect it, or you hit a mine and lose the wager outright.
// ════════════════════════════════════════════════════════════════════════════

export type Difficulty = "easy" | "normal" | "hard"

export interface DifficultyConfig {
  label: string
  size: number   // board is size x size
  mines: number
  multiplier: number
}

export const MINESWEEPER_DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  easy:   { label: "Easy",   size: 5, mines: 3,  multiplier: 1.2 },
  normal: { label: "Normal", size: 6, mines: 6,  multiplier: 1.5 },
  hard:   { label: "Hard",   size: 7, mines: 12, multiplier: 3 },
}

export interface Cell {
  mine: boolean
  adjacent: number  // count of mines in the 8 surrounding cells (0 if this cell is a mine)
}

// Mines are never placed on `safeIndex` or its immediate neighbors, so the
// opening click can never be an instant loss — standard Minesweeper courtesy.
export function generateBoard(size: number, mines: number, safeIndex: number): Cell[] {
  const total = size * size
  const sr = Math.floor(safeIndex / size), sc = safeIndex % size
  const safeZone = new Set<number>()
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = sr + dr, c = sc + dc
      if (r >= 0 && r < size && c >= 0 && c < size) safeZone.add(r * size + c)
    }
  }

  const candidates = Array.from({ length: total }, (_, i) => i).filter(i => !safeZone.has(i))
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
  }
  const mineSet = new Set(candidates.slice(0, Math.min(mines, candidates.length)))

  const cells: Cell[] = Array.from({ length: total }, (_, i) => ({ mine: mineSet.has(i), adjacent: 0 }))
  for (let i = 0; i < total; i++) {
    if (cells[i].mine) continue
    const r = Math.floor(i / size), c = i % size
    let count = 0
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue
        const rr = r + dr, cc = c + dc
        if (rr >= 0 && rr < size && cc >= 0 && cc < size && cells[rr * size + cc].mine) count++
      }
    }
    cells[i].adjacent = count
  }
  return cells
}

// Reveals `index` and, if it has no adjacent mines, cascades to reveal its
// neighbors too (repeating through any other zero-adjacent tiles it finds) —
// the classic Minesweeper auto-clear on an empty tile.
export function floodReveal(cells: Cell[], size: number, index: number, revealed: boolean[]): boolean[] {
  const next = [...revealed]
  const stack = [index]
  while (stack.length) {
    const i = stack.pop()!
    if (next[i]) continue
    next[i] = true
    if (cells[i].mine || cells[i].adjacent > 0) continue
    const r = Math.floor(i / size), c = i % size
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue
        const rr = r + dr, cc = c + dc
        if (rr >= 0 && rr < size && cc >= 0 && cc < size) {
          const ni = rr * size + cc
          if (!next[ni]) stack.push(ni)
        }
      }
    }
  }
  return next
}

export function isBoardCleared(cells: Cell[], revealed: boolean[]): boolean {
  return cells.every((cell, i) => cell.mine || revealed[i])
}

export const NUMBER_COLORS: Record<number, string> = {
  1: "text-blue-400",
  2: "text-emerald-400",
  3: "text-red-400",
  4: "text-purple-400",
  5: "text-amber-500",
  6: "text-teal-300",
  7: "text-white",
  8: "text-white/50",
}
