// ════════════════════════════════════════════════════════════════════════════
// MinesweeperGame.tsx — wager tokens, pick a difficulty, clear every safe
// tile without clicking a mine to collect that difficulty's flat multiplier.
// The board is only generated on the first click (see generateBoard's
// safe-zone carve-out) so the opening move can never be an instant loss.
// ════════════════════════════════════════════════════════════════════════════

import { useState } from "react"
import { Coins } from "lucide-react"
import { useGamblingWallet } from "./useGamblingWallet"
import { WagerStepper } from "./WagerStepper"
import { useSpendWarning, SpendWarningBanner } from "./SpendWarning"
import {
  generateBoard, floodReveal, isBoardCleared, NUMBER_COLORS,
  MINESWEEPER_DIFFICULTIES, type Difficulty, type Cell,
} from "./minesweeperLogic"

type Phase = "betting" | "playing" | "won" | "lost"

export function MinesweeperGame() {
  const { tokens, spendWager, payoutWager } = useGamblingWallet()
  const { show: showSpendWarning, trigger: warnSpend } = useSpendWarning()
  const [wager, setWager] = useState(1)
  const [difficulty, setDifficulty] = useState<Difficulty>("normal")
  const [phase, setPhase] = useState<Phase>("betting")
  const [cells, setCells] = useState<Cell[] | null>(null)
  const [revealed, setRevealed] = useState<boolean[]>([])
  const [flagged, setFlagged] = useState<Set<number>>(new Set())
  const [flagMode, setFlagMode] = useState(false)
  const [hitIndex, setHitIndex] = useState<number | null>(null)

  const config = MINESWEEPER_DIFFICULTIES[difficulty]
  const canPlay = phase === "betting" && wager >= 1 && wager <= tokens

  async function startGame() {
    if (!canPlay) return
    const spent = await spendWager(wager)
    if (!spent) return
    warnSpend()
    setCells(null)
    setRevealed([])
    setFlagged(new Set())
    setFlagMode(false)
    setHitIndex(null)
    setPhase("playing")
  }

  async function clickCell(i: number) {
    if (phase !== "playing") return
    if (flagMode) {
      setFlagged(prev => {
        const next = new Set(prev)
        next.has(i) ? next.delete(i) : next.add(i)
        return next
      })
      return
    }
    if (flagged.has(i)) return

    // First click of the round carves the mine-free board around it.
    let board = cells
    let wasRevealed = revealed
    if (!board) {
      board = generateBoard(config.size, config.mines, i)
      wasRevealed = Array(config.size * config.size).fill(false)
      setCells(board)
    }
    if (wasRevealed[i]) return

    if (board[i].mine) {
      setRevealed(floodReveal(board, config.size, i, wasRevealed))
      setHitIndex(i)
      setPhase("lost")
      return
    }

    const next = floodReveal(board, config.size, i, wasRevealed)
    setRevealed(next)
    if (isBoardCleared(board, next)) {
      await payoutWager(wager * config.multiplier)
      setPhase("won")
    }
  }

  function newGame() {
    setCells(null)
    setRevealed([])
    setFlagged(new Set())
    setHitIndex(null)
    setPhase("betting")
  }

  const payout = phase === "won" ? Math.round(wager * config.multiplier) : 0

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      {phase === "betting" && (
        <div className="flex items-center gap-1 rounded-full bg-white/10 p-0.5">
          {(Object.keys(MINESWEEPER_DIFFICULTIES) as Difficulty[]).map(d => (
            <button key={d} type="button" onClick={() => setDifficulty(d)}
              className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-colors ${difficulty === d ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70"}`}>
              {MINESWEEPER_DIFFICULTIES[d].label} · {MINESWEEPER_DIFFICULTIES[d].multiplier}x
            </button>
          ))}
        </div>
      )}

      {phase !== "betting" && (
        <div className="flex items-center gap-2 text-xs text-white/40">
          <span className="font-semibold text-white/70">{config.label}</span>
          <span>·</span>
          <span>{config.mines} mines</span>
          <span>·</span>
          <span>pays {config.multiplier}x</span>
        </div>
      )}

      {phase !== "betting" && (
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${config.size}, 2.25rem)` }}>
          {/* Before the first click, `cells` doesn't exist yet — render size×size blank covered tiles */}
          {Array.from({ length: config.size * config.size }, (_, i) => cells?.[i] ?? null).map((cell, i) => {
            const isRevealed = !!cells && revealed[i]
            const isFlagged = flagged.has(i)
            const isHit = hitIndex === i
            const showMine = phase === "lost" && cell?.mine
            return (
              <button
                key={i}
                type="button"
                onClick={() => clickCell(i)}
                disabled={phase !== "playing" || isRevealed}
                className={`size-9 rounded-lg flex items-center justify-center text-sm font-bold border transition-all ${
                  isRevealed
                    ? "border-white/10 bg-white/5"
                    : showMine
                    ? isHit ? "border-red-400 bg-red-500/20" : "border-red-400/40 bg-red-500/10"
                    : "border-white/15 bg-white/10 hover:bg-white/15 disabled:hover:bg-white/10"
                }`}
              >
                {isRevealed
                  ? (cell!.mine ? "💣" : cell!.adjacent > 0 ? <span className={NUMBER_COLORS[cell!.adjacent]}>{cell!.adjacent}</span> : "")
                  : showMine ? "💣" : isFlagged ? "🚩" : ""}
              </button>
            )
          })}
        </div>
      )}

      {phase === "playing" && (
        <button type="button" onClick={() => setFlagMode(v => !v)}
          className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-colors ${flagMode ? "bg-amber-500/20 border border-amber-500/40 text-amber-300" : "bg-white/10 hover:bg-white/20 text-white/50 hover:text-white"}`}>
          🚩 Flag Mode {flagMode ? "On" : "Off"}
        </button>
      )}

      {phase === "betting" && (
        <WagerStepper wager={wager} onChange={setWager} maxTokens={Math.max(1, tokens)} />
      )}

      <SpendWarningBanner show={showSpendWarning} />

      {phase === "betting" && (
        <button type="button" onClick={startGame} disabled={!canPlay}
          className="text-sm font-semibold px-5 py-2 rounded-xl bg-primary/80 hover:bg-primary text-white transition-colors disabled:opacity-30">
          Place Bet ({wager} <Coins className="inline size-3.5 -mt-0.5" />)
        </button>
      )}

      {phase === "won" && (
        <>
          <p className="text-sm font-bold text-emerald-300 flex items-center gap-1">
            Board cleared! {config.multiplier}x — you won {payout - wager} <Coins className="inline size-3.5" /> tokens.
          </p>
          <button type="button" onClick={newGame}
            className="text-sm font-semibold px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors">
            New Game
          </button>
        </>
      )}

      {phase === "lost" && (
        <>
          <p className="text-sm font-bold text-red-300">💥 Boom — you lost {wager} tokens.</p>
          <button type="button" onClick={newGame}
            className="text-sm font-semibold px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors">
            New Game
          </button>
        </>
      )}

      {phase === "betting" && tokens < 1 && <p className="text-xs text-white/30 italic">Not enough tokens to play.</p>}
      <p className="text-[10px] text-white/25 text-center max-w-xs">Clear every safe tile to collect the multiplier · one mine ends the round</p>
    </div>
  )
}
