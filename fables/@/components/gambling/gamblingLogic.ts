// ════════════════════════════════════════════════════════════════════════════
// gamblingLogic.ts — pure game math for Coin Flip, Dice, and Slots (no React).
// Minesweeper (minesweeperLogic.ts) gets its own file since it carries more
// state/geometry than fits this single-draw shape.
// ════════════════════════════════════════════════════════════════════════════

export type CoinSide = "heads" | "tails"

export function flipCoin(): CoinSide {
  return Math.random() < 0.5 ? "heads" : "tails"
}

export function rollDie(): number {
  return 1 + Math.floor(Math.random() * 6)
}

// 1-in-6 exact match paying 6x is a fair bet (matches Coin Flip's fair 2x on
// a 1-in-2 call) — no hidden house edge on the "math" of either game.
export const DICE_PAYOUT_MULTIPLIER = 6

export interface SlotSymbol {
  id: string
  emoji: string
  multiplier: number  // payout multiplier for 3-of-a-kind
  weight: number       // relative draw frequency — higher = more common per reel
}

// Every symbol used to be equally likely (1-in-5 per reel), which means
// triple cherries was exactly as rare as triple sevens (~0.8% each,
// 1-in-125) — backwards for a slot machine, and it made the low-tier
// symbols feel pointless since you'd basically never see them land 3x
// either. Now weighted so cherries land a triple ~4.3% of spins (1-in-23)
// while sevens stay a real jackpot (~0.03%, roughly 1-in-2900), and
// multipliers are scaled up so the overall return is a generous ~93%
// (there's no real money on the line — the point is it should feel good).
export const SLOT_SYMBOLS: SlotSymbol[] = [
  { id: "cherry", emoji: "🍒", multiplier: 4,  weight: 35 },
  { id: "lemon",  emoji: "🍋", multiplier: 6,  weight: 25 },
  { id: "bell",   emoji: "🔔", multiplier: 10, weight: 20 },
  { id: "gem",    emoji: "💎", multiplier: 18, weight: 13 },
  { id: "seven",  emoji: "7️⃣", multiplier: 50, weight: 7 },
]

function weightedSymbol(): SlotSymbol {
  const totalWeight = SLOT_SYMBOLS.reduce((sum, s) => sum + s.weight, 0)
  let r = Math.random() * totalWeight
  for (const s of SLOT_SYMBOLS) {
    if (r < s.weight) return s
    r -= s.weight
  }
  return SLOT_SYMBOLS[SLOT_SYMBOLS.length - 1]
}

export function spinSlots(): SlotSymbol[] {
  return [0, 1, 2].map(() => weightedSymbol())
}

// Returns the payout multiplier for a spin: 3-of-a-kind pays that symbol's
// multiplier, 2-of-a-kind is a push (1x, wager back), otherwise a total loss (0x).
export function slotPayoutMultiplier(reels: SlotSymbol[]): number {
  const [a, b, c] = reels
  if (a.id === b.id && b.id === c.id) return a.multiplier
  if (a.id === b.id || b.id === c.id || a.id === c.id) return 1
  return 0
}
