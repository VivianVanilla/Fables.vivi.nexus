// ════════════════════════════════════════════════════════════════════════════
// twentyFortyEightLogic.ts — classic 2048 grid mechanics (no React)
// ════════════════════════════════════════════════════════════════════════════

export type Direction = "left" | "right" | "up" | "down"
export const GRID_SIZE = 4

export function createEmptyGrid(): number[][] {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0))
}

function emptyCells(grid: number[][]): [number, number][] {
  const cells: [number, number][] = []
  for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++)
      if (grid[r][c] === 0) cells.push([r, c])
  return cells
}

export function spawnTile(grid: number[][]): number[][] {
  const cells = emptyCells(grid)
  if (cells.length === 0) return grid
  const [r, c] = cells[Math.floor(Math.random() * cells.length)]
  const next = grid.map(row => [...row])
  next[r][c] = Math.random() < 0.9 ? 2 : 4
  return next
}

function slideRowLeft(row: number[]): { row: number[]; gained: number } {
  const nonZero = row.filter(v => v !== 0)
  const merged: number[] = []
  let gained = 0
  let i = 0
  while (i < nonZero.length) {
    if (i + 1 < nonZero.length && nonZero[i] === nonZero[i + 1]) {
      const val = nonZero[i] * 2
      merged.push(val)
      gained += val
      i += 2
    } else {
      merged.push(nonZero[i])
      i += 1
    }
  }
  while (merged.length < row.length) merged.push(0)
  return { row: merged, gained }
}

function transpose(grid: number[][]): number[][] {
  return grid[0].map((_, c) => grid.map(row => row[c]))
}

function reverseRows(grid: number[][]): number[][] {
  return grid.map(row => [...row].reverse())
}

export function move(grid: number[][], dir: Direction): { grid: number[][]; moved: boolean; gained: number } {
  let working = grid.map(row => [...row])
  if (dir === "up" || dir === "down") working = transpose(working)
  if (dir === "right" || dir === "down") working = reverseRows(working)

  let gained = 0
  let result = working.map(row => {
    const { row: newRow, gained: g } = slideRowLeft(row)
    gained += g
    return newRow
  })

  if (dir === "right" || dir === "down") result = reverseRows(result)
  if (dir === "up" || dir === "down") result = transpose(result)

  const moved = JSON.stringify(result) !== JSON.stringify(grid)
  return { grid: result, moved, gained }
}

export function hasMoves(grid: number[][]): boolean {
  if (emptyCells(grid).length > 0) return true
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const v = grid[r][c]
      if (c + 1 < GRID_SIZE && grid[r][c + 1] === v) return true
      if (r + 1 < GRID_SIZE && grid[r + 1][c] === v) return true
    }
  }
  return false
}

export function hasWon(grid: number[][]): boolean {
  return grid.some(row => row.some(v => v >= 2048))
}

export function newGame(): number[][] {
  return spawnTile(spawnTile(createEmptyGrid()))
}
