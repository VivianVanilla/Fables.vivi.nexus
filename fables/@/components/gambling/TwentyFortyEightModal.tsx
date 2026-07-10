// ════════════════════════════════════════════════════════════════════════════
// TwentyFortyEightModal.tsx — classic 2048, unlocked via the gamVIVIling shop.
// Arrow keys on desktop, swipe on touch. Session-only state, no persistence.
//
// Tiles are absolutely positioned (not a plain CSS grid of numbers) so a
// slide is an actual `left`/`top` transition on the same DOM node (matched
// by `tile.id` via the key prop) instead of the whole board just snapping
// to new values every move. New tiles pop in, merges pulse.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState, type CSSProperties } from "react"
import {
  newGame, moveTiles, spawnTile, hasMoves, hasWon, GRID_SIZE,
  type Direction, type Tile,
} from "./twentyFortyEightLogic"

interface Props {
  onClose: () => void
}

const TILE_STYLES: Record<number, string> = {
  2:    "bg-white/10 text-white",
  4:    "bg-white/20 text-white",
  8:    "bg-orange-400/80 text-white",
  16:   "bg-orange-500/80 text-white",
  32:   "bg-red-400/80 text-white",
  64:   "bg-red-500/80 text-white",
  128:  "bg-yellow-400/80 text-white",
  256:  "bg-yellow-500/80 text-white",
  512:  "bg-amber-400 text-white",
  1024: "bg-amber-500 text-white",
  2048: "bg-emerald-400 text-white",
}

function tileClass(v: number) {
  return TILE_STYLES[v] ?? "bg-fuchsia-500 text-white"
}

function cellStyle(row: number, col: number): CSSProperties {
  return {
    position: "absolute",
    left: `${(col / GRID_SIZE) * 100}%`,
    top: `${(row / GRID_SIZE) * 100}%`,
    width: `${100 / GRID_SIZE}%`,
    height: `${100 / GRID_SIZE}%`,
    boxSizing: "border-box",
    padding: "4px",
  }
}

const SWIPE_THRESHOLD = 30

export function TwentyFortyEightModal({ onClose }: Props) {
  const [tiles, setTiles] = useState<Tile[]>(() => newGame())
  const [newIds, setNewIds] = useState<Set<number>>(new Set())
  const [mergedIds, setMergedIds] = useState<Set<number>>(new Set())
  const [score, setScore] = useState(0)
  const [wonBannerShown, setWonBannerShown] = useState(false)
  const [wonDismissed, setWonDismissed] = useState(false)
  const [over, setOver] = useState(false)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  function reset() {
    setTiles(newGame())
    setNewIds(new Set())
    setMergedIds(new Set())
    setScore(0)
    setWonBannerShown(false)
    setWonDismissed(false)
    setOver(false)
  }

  function handleMove(dir: Direction) {
    if (over) return
    setTiles(prev => {
      const result = moveTiles(prev, dir)
      if (!result.moved) return prev
      const beforeSpawnIds = new Set(result.tiles.map(t => t.id))
      const next = spawnTile(result.tiles)
      const spawned = next.find(t => !beforeSpawnIds.has(t.id))
      setNewIds(spawned ? new Set([spawned.id]) : new Set())
      setMergedIds(result.mergedIds)
      setScore(s => s + result.gained)
      if (!wonDismissed && hasWon(next)) setWonBannerShown(true)
      if (!hasMoves(next)) setOver(true)
      return next
    })
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const map: Record<string, Direction> = {
        ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
      }
      const dir = map[e.key]
      if (!dir) return
      e.preventDefault()
      handleMove(dir)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over, wonDismissed])

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (!touchStart.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - touchStart.current.x
    const dy = t.clientY - touchStart.current.y
    touchStart.current = null
    if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return
    if (Math.abs(dx) > Math.abs(dy)) handleMove(dx > 0 ? "right" : "left")
    else handleMove(dy > 0 ? "down" : "up")
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-white/15 rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
          <span className="text-2xl">🔢</span>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-white">2048</p>
            <p className="text-xs text-white/40">Score {score}</p>
          </div>
          <button type="button" onClick={reset}
            className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors">
            New Game
          </button>
          <button type="button" onClick={onClose}
            className="size-8 flex items-center justify-center rounded-md hover:bg-white/10 text-white/50 hover:text-white transition-colors">
            ✕
          </button>
        </div>

        {/* Board */}
        <div className="p-4 relative">
          <div
            className="relative aspect-square w-full select-none touch-none"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {/* Static empty-slot backdrop */}
            {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => (
              <div key={i} style={cellStyle(Math.floor(i / GRID_SIZE), i % GRID_SIZE)}>
                <div className="w-full h-full rounded-lg bg-white/5" />
              </div>
            ))}

            {/* Tiles — same cell math as the backdrop, but transitions on
                left/top so a slide animates instead of snapping. */}
            {tiles.map(tile => (
              <div key={tile.id} style={{ ...cellStyle(tile.row, tile.col), transition: "left 120ms ease-out, top 120ms ease-out" }}>
                <div
                  className={`w-full h-full rounded-lg flex items-center justify-center text-lg font-bold ${tileClass(tile.value)} ${
                    newIds.has(tile.id) ? "animate-in zoom-in-50 fade-in duration-200" : ""
                  } ${mergedIds.has(tile.id) ? "animate-[fables-2048-merge_220ms_ease-out]" : ""}`}
                >
                  {tile.value}
                </div>
              </div>
            ))}
          </div>

          {wonBannerShown && (
            <div className="absolute inset-4 flex items-center justify-center bg-black/70 rounded-lg animate-in fade-in duration-200">
              <div className="text-center">
                <p className="text-3xl mb-1">🎉</p>
                <p className="text-lg font-bold text-white mb-3">You hit 2048!</p>
                <button type="button" onClick={() => { setWonBannerShown(false); setWonDismissed(true) }}
                  className="text-xs px-4 py-2 rounded-lg bg-primary/80 hover:bg-primary text-white font-semibold transition-colors">
                  Keep playing
                </button>
              </div>
            </div>
          )}

          {over && (
            <div className="absolute inset-4 flex items-center justify-center bg-black/70 rounded-lg animate-in fade-in duration-200">
              <div className="text-center">
                <p className="text-lg font-bold text-white mb-1">Game over</p>
                <p className="text-xs text-white/40 mb-3">Final score {score}</p>
                <button type="button" onClick={reset}
                  className="text-xs px-4 py-2 rounded-lg bg-primary/80 hover:bg-primary text-white font-semibold transition-colors">
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-[10px] text-white/25 text-center pb-4">Arrow keys, or swipe on mobile.</p>
      </div>
    </div>
  )
}
