// ════════════════════════════════════════════════════════════════════════════
// plinkoLogic.ts — Plinko board geometry + a real per-frame gravity/bounce
// animation for the ball.
//
// The left/right decision at each peg is rolled fairly up front (one coin
// flip per row) rather than emerging from simulated peg collisions — an
// early version bounced the ball off actual peg circles frame-to-frame and
// it reliably diverged: whichever direction the ball leaned first got
// reinforced (or, once it drifted, it could ride the outer wall down
// untouched by any peg), so it landed in the two extreme slots ~30-45% of
// the time instead of the ~0.4% a fair board implies. That's the same
// approach real-money Plinko implementations use under the hood (the RNG
// outcome is decided up front for provable fairness, then animated) — the
// ball still falls under real gravity and visibly bounces off every peg on
// its path, it just always arrives at the peg the pre-rolled path says it
// should. Rows are independent fair coin flips, so the final slot follows
// Binomial(PLINKO_ROWS, 0.5): the middle slots are common, the edges rare.
// Multipliers are weighted against that same distribution (rare edges pay
// big, common middle pays a partial loss) for a ~93% RTP — see
// PLINKO_MULTIPLIERS.
//
// The drop position is a player choice (DROP_POSITIONS), not just always
// dead-center — it only changes the ball's entry swoop into the first peg
// (see buildPlinkoLegs), it never touches the fair per-row coin flip, so it
// can't be used to game the odds. It's there so the board feels like
// something you're aiming, not just a button you press.
//
// A version where the drop column genuinely changed the peg lattice the ball
// walks (a real quincunx, offset rows of 9/8 pegs, off-center entrances
// biasing the walk) was tried and measured: with simple edge-clamping an
// off-center entrance drove RTP over 400% by piling probability onto the
// big-multiplier edge slots, and a real reflecting-wall model needed a
// different multiplier table per entrance to stay fair — too much surface
// area for what's meant to be a feel/visual choice. PlinkoGame's backdrop
// grid (FULL_GRID_PEGS) gives the board a square, full-width look instead of
// a triangle, purely as decoration behind the real (unchanged) path.
// ════════════════════════════════════════════════════════════════════════════

export const PLINKO_ROWS = 8
export const PLINKO_SLOT_COUNT = PLINKO_ROWS + 1 // 9

export const BOARD_WIDTH = 280
export const BOARD_HEIGHT = 320
export const PEG_ROW_SPACING = 28
export const PEG_COL_SPACING = 28
export const TOP_MARGIN = 46
export const BALL_RADIUS = 6
export const PEG_RADIUS = 4
export const SLOT_ZONE_HEIGHT = 50

// Where the ball's simulated fall actually begins — below the static entrance
// chutes drawn above it (see PlinkoGame's CHUTE_* constants, which end right
// at this y), leaving enough vertical room for a natural diagonal swoop from
// whichever chute was chosen into the shared apex peg.
export const DROP_START_Y = TOP_MARGIN - 20

// A handful of selectable release points across the top of the board.
export const DROP_POSITIONS = [0.2, 0.35, 0.5, 0.65, 0.8].map(f => Math.round(BOARD_WIDTH * f))

const GRAVITY = 0.32
const MAX_VY = 7
const BOUNCE_VY_RETAIN = 0.32

// Symmetric, edges pay big / center pays worst — weighted against the
// binomial odds of landing there (see header comment).
export const PLINKO_MULTIPLIERS = [7, 2.5, 1.3, 0.8, 0.3, 0.8, 1.3, 2.5, 7]

export interface Peg {
  row: number
  x: number
  y: number
}

export function buildPegs(): Peg[] {
  const pegs: Peg[] = []
  const centerX = BOARD_WIDTH / 2
  for (let row = 0; row < PLINKO_ROWS; row++) {
    const count = row + 1
    const rowWidth = (count - 1) * PEG_COL_SPACING
    for (let i = 0; i < count; i++) {
      pegs.push({
        row,
        x: centerX - rowWidth / 2 + i * PEG_COL_SPACING,
        y: TOP_MARGIN + row * PEG_ROW_SPACING,
      })
    }
  }
  return pegs
}

const LAST_ROW_WIDTH = (PLINKO_ROWS - 1) * PEG_COL_SPACING
export const SLOTS_LEFT = BOARD_WIDTH / 2 - LAST_ROW_WIDTH / 2 - PEG_COL_SPACING / 2
export const SLOT_WIDTH = (LAST_ROW_WIDTH + PEG_COL_SPACING) / PLINKO_SLOT_COUNT
export const SLOTS_FLOOR_Y = TOP_MARGIN + (PLINKO_ROWS - 1) * PEG_ROW_SPACING + SLOT_ZONE_HEIGHT

function slotCenterX(slotIndex: number): number {
  return SLOTS_LEFT + slotIndex * SLOT_WIDTH + SLOT_WIDTH / 2
}

// One fair coin flip per row. The slot the ball lands in is just how many of
// those flips came up "right" — Binomial(PLINKO_ROWS, 0.5).
export function rollPlinkoPath(): { path: boolean[]; slotIndex: number } {
  const path = Array.from({ length: PLINKO_ROWS }, () => Math.random() < 0.5)
  const slotIndex = path.filter(Boolean).length
  return { path, slotIndex }
}

// The peg the ball is riding toward after `row` of the path has been decided
// (row 0..PLINKO_ROWS-1). Its column is just the running count of "right"
// flips so far, same indexing buildPegs() uses for that row.
function pegForRow(path: boolean[], row: number): { x: number; y: number } {
  const index = path.slice(0, row).filter(Boolean).length
  const rowWidth = row * PEG_COL_SPACING
  return {
    x: BOARD_WIDTH / 2 - rowWidth / 2 + index * PEG_COL_SPACING,
    y: TOP_MARGIN + row * PEG_ROW_SPACING,
  }
}

interface Leg {
  fromX: number
  fromY: number
  toX: number
  toY: number
  wobble: number
}

// The ball's full route as a sequence of straight-line legs between peg
// contact points, ending at the resting spot in its final slot. Horizontal
// position within a leg is driven by vertical fall progress (a simple lerp
// with a bit of cosmetic sideways wobble); the vertical fall itself is real
// gravity + a bounce impulse at the end of every leg, which is what gives
// the animation its physical, bouncy feel despite the path being fixed.
export function buildPlinkoLegs(path: boolean[], slotIndex: number, startX: number = BOARD_WIDTH / 2): Leg[] {
  const legs: Leg[] = []
  let prev = { x: startX, y: DROP_START_Y }
  for (let row = 0; row < PLINKO_ROWS; row++) {
    const peg = pegForRow(path, row)
    legs.push({ fromX: prev.x, fromY: prev.y, toX: peg.x, toY: peg.y, wobble: (Math.random() - 0.5) * 6 })
    prev = peg
  }
  legs.push({ fromX: prev.x, fromY: prev.y, toX: slotCenterX(slotIndex), toY: SLOTS_FLOOR_Y, wobble: 0 })
  return legs
}

export interface BallState {
  x: number
  y: number
  vy: number
  legIndex: number
  settled: boolean
  slotIndex: number | null
}

export function initialBall(legs: Leg[]): BallState {
  return { x: legs[0].fromX, y: legs[0].fromY, vy: 0, legIndex: 0, settled: false, slotIndex: null }
}

// One physics tick: integrates gravity for the fall, bounces at the end of
// each leg, and hands back settled + the final slot once the last leg (the
// drop into the slot) completes.
export function stepBall(ball: BallState, legs: Leg[], finalSlotIndex: number): BallState {
  if (ball.settled) return ball

  const leg = legs[ball.legIndex]
  const vy = Math.min(ball.vy + GRAVITY, MAX_VY)
  const rawY = ball.y + vy

  const span = leg.toY - leg.fromY
  const frac = span === 0 ? 1 : Math.max(0, Math.min(1, (rawY - leg.fromY) / span))
  const x = leg.fromX + (leg.toX - leg.fromX) * frac + Math.sin(frac * Math.PI) * leg.wobble

  if (frac >= 1) {
    const nextLegIndex = ball.legIndex + 1
    if (nextLegIndex >= legs.length) {
      return { x: leg.toX, y: leg.toY, vy, legIndex: ball.legIndex, settled: true, slotIndex: finalSlotIndex }
    }
    return { x: leg.toX, y: leg.toY, vy: -Math.abs(vy) * BOUNCE_VY_RETAIN, legIndex: nextLegIndex, settled: false, slotIndex: null }
  }

  return { x, y: rawY, vy, legIndex: ball.legIndex, settled: false, slotIndex: null }
}
