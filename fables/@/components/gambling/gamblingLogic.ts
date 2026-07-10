// ════════════════════════════════════════════════════════════════════════════
// gamblingLogic.ts — pure game math for the 3 mini-games (no React)
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
}

// Slots previously topped out at 15x with the worst overall expected return
// of the 3 games (~74%, vs. Dice's fair 100% and Coin Flip's fair 100%).
// Scaled up so the jackpot actually feels worth chasing and the payout table
// tracks closer to fair — 3-of-a-kind now averages ~38%, plus the 48% chance
// of a push (any pair returns the wager), for ~86% overall.
export const SLOT_SYMBOLS: SlotSymbol[] = [
  { id: "cherry", emoji: "🍒", multiplier: 3 },
  { id: "lemon",  emoji: "🍋", multiplier: 4 },
  { id: "bell",   emoji: "🔔", multiplier: 6 },
  { id: "gem",    emoji: "💎", multiplier: 10 },
  { id: "seven",  emoji: "7️⃣", multiplier: 25 },
]

export function spinSlots(): SlotSymbol[] {
  return [0, 1, 2].map(() => SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)])
}

// Returns the payout multiplier for a spin: 3-of-a-kind pays that symbol's
// multiplier, 2-of-a-kind is a push (1x, wager back), otherwise a total loss (0x).
export function slotPayoutMultiplier(reels: SlotSymbol[]): number {
  const [a, b, c] = reels
  if (a.id === b.id && b.id === c.id) return a.multiplier
  if (a.id === b.id || b.id === c.id || a.id === c.id) return 1
  return 0
}
