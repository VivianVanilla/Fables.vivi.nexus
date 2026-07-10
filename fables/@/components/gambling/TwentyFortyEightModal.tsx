// ════════════════════════════════════════════════════════════════════════════
// TwentyFortyEightModal.tsx — classic 2048, unlocked via the gamVIVIling shop.
// Arrow keys on desktop, swipe on touch. Session-only state, no persistence.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react"
import { newGame, move, spawnTile, hasMoves, hasWon, type Direction } from "./twentyFortyEightLogic"

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

const SWIPE_THRESHOLD = 30

export function TwentyFortyEightModal({ onClose }: Props) {
  const [grid, setGrid] = useState(() => newGame())
  const [score, setScore] = useState(0)
  const [wonBannerShown, setWonBannerShown] = useState(false)
  const [wonDismissed, setWonDismissed] = useState(false)
  const [over, setOver] = useState(false)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  function reset() {
    setGrid(newGame())
    setScore(0)
    setWonBannerShown(false)
    setWonDismissed(false)
    setOver(false)
  }

  function handleMove(dir: Direction) {
    if (over) return
    setGrid(prev => {
      const result = move(prev, dir)
      if (!result.moved) return prev
      const next = spawnTile(result.grid)
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
            className="grid grid-cols-4 gap-2 select-none touch-none"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {grid.flatMap((row, r) => row.map((v, c) => (
              <div key={`${r}-${c}`}
                className={`aspect-square rounded-lg flex items-center justify-center text-lg font-bold transition-colors ${v === 0 ? "bg-white/5" : tileClass(v)}`}>
                {v !== 0 && v}
              </div>
            )))}
          </div>

          {wonBannerShown && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-lg animate-in fade-in duration-200">
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
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-lg animate-in fade-in duration-200">
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
