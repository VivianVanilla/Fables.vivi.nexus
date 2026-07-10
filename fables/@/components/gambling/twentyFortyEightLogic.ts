// ════════════════════════════════════════════════════════════════════════════
// twentyFortyEightLogic.ts — classic 2048 grid mechanics (no React)
//
// Tiles are tracked as a flat list with stable ids (not a raw number[][])
// specifically so the component can animate — React keys off `id`, so a tile
// that slides keeps the same DOM node and its row/col change can transition
// smoothly instead of the grid just snapping to new numbers every move.
// ════════════════════════════════════════════════════════════════════════════

export type Direction = "left" | "right" | "up" | "down"
export const GRID_SIZE = 4

export interface Tile {
  id: number
  value: number
  row: number
  col: number
}

let nextId = 1

export function createTiles(): Tile[] {
  return []
}

export function spawnTile(tiles: Tile[]): Tile[] {
  const occupied = new Set(tiles.map(t => `${t.row},${t.col}`))
  const empty: [number, number][] = []
  for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++)
      if (!occupied.has(`${r},${c}`)) empty.push([r, c])
  if (empty.length === 0) return tiles
  const [row, col] = empty[Math.floor(Math.random() * empty.length)]
  const value = Math.random() < 0.9 ? 2 : 4
  return [...tiles, { id: nextId++, value, row, col }]
}

export function newGame(): Tile[] {
  return spawnTile(spawnTile(createTiles()))
}

// Moves + merges every tile one direction. Each line (row for left/right,
// column for up/down) is compacted independently: adjacent equal values
// merge once (the leading tile survives with doubled value and keeps its
// id — so its position transition animates rather than popping a new tile
// in place), everything else just slides into the gap.
export function moveTiles(tiles: Tile[], dir: Direction): { tiles: Tile[]; moved: boolean; gained: number; mergedIds: Set<number> } {
  let gained = 0
  const mergedIds = new Set<number>()
  const nextTiles: Tile[] = []

  for (let i = 0; i < GRID_SIZE; i++) {
    let line: Tile[]
    if (dir === "left")       line = tiles.filter(t => t.row === i).sort((a, b) => a.col - b.col)
    else if (dir === "right") line = tiles.filter(t => t.row === i).sort((a, b) => b.col - a.col)
    else if (dir === "up")    line = tiles.filter(t => t.col === i).sort((a, b) => a.row - b.row)
    else                      line = tiles.filter(t => t.col === i).sort((a, b) => b.row - a.row)

    const compacted: Tile[] = []
    let j = 0
    while (j < line.length) {
      const cur = line[j]
      const nxt = line[j + 1]
      if (nxt && nxt.value === cur.value) {
        const mergedValue = cur.value * 2
        gained += mergedValue
        mergedIds.add(cur.id)
        compacted.push({ ...cur, value: mergedValue })
        j += 2
      } else {
        compacted.push(cur)
        j += 1
      }
    }

    compacted.forEach((tile, pos) => {
      let row = tile.row, col = tile.col
      if (dir === "left")       { row = i; col = pos }
      else if (dir === "right") { row = i; col = GRID_SIZE - 1 - pos }
      else if (dir === "up")    { col = i; row = pos }
      else                      { col = i; row = GRID_SIZE - 1 - pos }
      nextTiles.push({ ...tile, row, col })
    })
  }

  const moved = tiles.some(t => {
    const match = nextTiles.find(nt => nt.id === t.id)
    return !match || match.row !== t.row || match.col !== t.col
  })

  return { tiles: nextTiles, moved, gained, mergedIds }
}

export function hasWon(tiles: Tile[]): boolean {
  return tiles.some(t => t.value >= 2048)
}

export function hasMoves(tiles: Tile[]): boolean {
  if (tiles.length < GRID_SIZE * GRID_SIZE) return true
  const byPos = new Map<string, number>()
  tiles.forEach(t => byPos.set(`${t.row},${t.col}`, t.value))
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const v = byPos.get(`${r},${c}`)!
      if (c + 1 < GRID_SIZE && byPos.get(`${r},${c + 1}`) === v) return true
      if (r + 1 < GRID_SIZE && byPos.get(`${r + 1},${c}`) === v) return true
    }
  }
  return false
}
