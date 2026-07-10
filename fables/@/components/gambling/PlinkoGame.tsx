// ════════════════════════════════════════════════════════════════════════════
// PlinkoGame.tsx — wager tokens, drop a ball down a full peg board. Rendered
// on a <canvas> and driven by a requestAnimationFrame loop calling stepBall()
// every frame — a real gravity/bounce animation, not a CSS drop to a slot.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react"
import { useGamblingWallet } from "./useGamblingWallet"
import { WagerStepper } from "./WagerStepper"
import {
  buildPegs, rollPlinkoPath, buildPlinkoLegs, initialBall, stepBall,
  PLINKO_ROWS, PLINKO_MULTIPLIERS, PLINKO_SLOT_COUNT, BOARD_WIDTH, BOARD_HEIGHT,
  PEG_ROW_SPACING, PEG_COL_SPACING, TOP_MARGIN,
  SLOTS_LEFT, SLOT_WIDTH, SLOTS_FLOOR_Y, BALL_RADIUS, PEG_RADIUS,
  DROP_START_Y, DROP_POSITIONS,
  type BallState,
} from "./plinkoLogic"

const PEGS = buildPegs()
const DIVIDER_TOP_Y = SLOTS_FLOOR_Y - 24
const CHUTE_HALF_WIDTH = 9
const CHUTE_TOP_Y = 4
const CHUTE_BOTTOM_Y = DROP_START_Y

// A full, constant-width backdrop grid (same column count every row) behind
// the actual bounce path — the ball only ever touches PEGS above, but this
// is what makes the board read as a square pegboard instead of a triangle
// that narrows to a single point at the top.
const FULL_GRID_COLS = PLINKO_ROWS
const FULL_GRID_PEGS: { x: number; y: number }[] = []
for (let row = 0; row < PLINKO_ROWS; row++) {
  const rowWidth = (FULL_GRID_COLS - 1) * PEG_COL_SPACING
  for (let i = 0; i < FULL_GRID_COLS; i++) {
    FULL_GRID_PEGS.push({
      x: BOARD_WIDTH / 2 - rowWidth / 2 + i * PEG_COL_SPACING,
      y: TOP_MARGIN + row * PEG_ROW_SPACING,
    })
  }
}

function drawBoard(ctx: CanvasRenderingContext2D, ball: BallState | null, dropX: number) {
  ctx.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT)

  // A separate little chute for every selectable drop position, each ending
  // in its own entrance peg — 5 real, distinct entrances into the board.
  for (const pos of DROP_POSITIONS) {
    const selected = pos === dropX
    ctx.fillStyle = selected ? "rgba(96,165,250,0.16)" : "rgba(255,255,255,0.04)"
    ctx.fillRect(pos - CHUTE_HALF_WIDTH, CHUTE_TOP_Y, CHUTE_HALF_WIDTH * 2, CHUTE_BOTTOM_Y - CHUTE_TOP_Y)
    ctx.strokeStyle = selected ? "rgba(96,165,250,0.6)" : "rgba(255,255,255,0.12)"
    ctx.lineWidth = 1
    ctx.strokeRect(pos - CHUTE_HALF_WIDTH, CHUTE_TOP_Y, CHUTE_HALF_WIDTH * 2, CHUTE_BOTTOM_Y - CHUTE_TOP_Y)
  }

  ctx.fillStyle = "rgba(255,255,255,0.10)"
  for (const peg of FULL_GRID_PEGS) {
    ctx.beginPath()
    ctx.arc(peg.x, peg.y, PEG_RADIUS, 0, Math.PI * 2)
    ctx.fill()
  }

  for (const pos of DROP_POSITIONS) {
    const selected = pos === dropX
    ctx.fillStyle = selected ? "rgba(96,165,250,0.9)" : "rgba(255,255,255,0.4)"
    ctx.beginPath()
    ctx.arc(pos, CHUTE_BOTTOM_Y, PEG_RADIUS + (selected ? 1 : 0), 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.fillStyle = "rgba(255,255,255,0.6)"
  for (const peg of PEGS) {
    ctx.beginPath()
    ctx.arc(peg.x, peg.y, PEG_RADIUS, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.strokeStyle = "rgba(255,255,255,0.15)"
  for (let i = 0; i <= PLINKO_SLOT_COUNT; i++) {
    const x = SLOTS_LEFT + i * SLOT_WIDTH
    ctx.beginPath()
    ctx.moveTo(x, DIVIDER_TOP_Y)
    ctx.lineTo(x, SLOTS_FLOOR_Y)
    ctx.stroke()
  }

  ctx.font = "bold 10px sans-serif"
  ctx.textAlign = "center"
  for (let i = 0; i < PLINKO_SLOT_COUNT; i++) {
    const cx = SLOTS_LEFT + i * SLOT_WIDTH + SLOT_WIDTH / 2
    const m = PLINKO_MULTIPLIERS[i]
    ctx.fillStyle = m >= 3 ? "#fbbf24" : m >= 1 ? "#a1a1aa" : "#f87171"
    ctx.fillText(`${m}x`, cx, SLOTS_FLOOR_Y + 14)
  }

  if (ball) {
    ctx.fillStyle = "#60a5fa"
    ctx.beginPath()
    ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2)
    ctx.fill()
  }
}

export function PlinkoGame() {
  const { tokens, settleWager } = useGamblingWallet()
  const [wager, setWager] = useState(1)
  const [dropX, setDropX] = useState(DROP_POSITIONS[Math.floor(DROP_POSITIONS.length / 2)])
  const [dropping, setDropping] = useState(false)
  const [result, setResult] = useState<{ slotIndex: number; multiplier: number } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  const canPlay = !dropping && wager >= 1 && wager <= tokens

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d")
    if (ctx) drawBoard(ctx, null, dropX)
    return () => cancelAnimationFrame(rafRef.current)
  }, [dropX])

  function drop() {
    if (!canPlay) return
    setDropping(true)
    setResult(null)

    const { path, slotIndex } = rollPlinkoPath()
    const legs = buildPlinkoLegs(path, slotIndex, dropX)
    let ball = initialBall(legs)

    function tick() {
      ball = stepBall(ball, legs, slotIndex)
      const ctx = canvasRef.current?.getContext("2d")
      if (ctx) drawBoard(ctx, ball, dropX)

      if (ball.settled) {
        const multiplier = PLINKO_MULTIPLIERS[slotIndex]
        settleWager(wager, multiplier).then(() => {
          setResult({ slotIndex, multiplier })
          setDropping(false)
        })
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  const payout = result ? Math.round(wager * result.multiplier) : 0

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <canvas
        ref={canvasRef}
        width={BOARD_WIDTH}
        height={BOARD_HEIGHT}
        className="rounded-xl bg-black/30 border border-white/10 max-w-full"
      />

      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-white/30 uppercase tracking-widest mr-1">Drop</span>
        {DROP_POSITIONS.map(x => (
          <button key={x} type="button" onClick={() => setDropX(x)} disabled={dropping}
            className={`size-6 rounded-full text-xs transition-colors flex items-center justify-center ${
              dropX === x ? "bg-primary/80 text-white" : "bg-white/10 text-white/40 hover:bg-white/20 hover:text-white"
            }`}>
            ▼
          </button>
        ))}
      </div>

      <WagerStepper wager={wager} onChange={setWager} maxTokens={Math.max(1, tokens)} />

      <button type="button" onClick={drop} disabled={!canPlay}
        className="text-sm font-semibold px-5 py-2 rounded-xl bg-primary/80 hover:bg-primary text-white transition-colors disabled:opacity-30">
        {dropping ? "Dropping…" : "Drop Ball"}
      </button>

      {result && !dropping && (
        <p className={`text-sm font-bold ${payout > wager ? "text-emerald-300" : payout === wager ? "text-amber-300" : "text-red-300"}`}>
          {payout > wager ? `Landed ${result.multiplier}x — you won ${payout - wager} tokens.`
            : payout === wager ? `Landed ${result.multiplier}x — you got your wager back.`
            : `Landed ${result.multiplier}x — you kept ${payout} of your ${wager} wager.`}
        </p>
      )}

      {tokens < 1 && <p className="text-xs text-white/30 italic">Not enough tokens to play.</p>}
      <p className="text-[10px] text-white/25 text-center">Edges pay big and are rare · the middle is common and mostly a partial loss</p>
    </div>
  )
}
