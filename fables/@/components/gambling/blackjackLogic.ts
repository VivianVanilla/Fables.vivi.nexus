// ════════════════════════════════════════════════════════════════════════════
// blackjackLogic.ts — single-hand blackjack vs. a dealer, infinite shoe
// (draws are independent random cards, not tracked against a finite deck —
// fine for a token toy, no real-money accuracy requirements).
// ════════════════════════════════════════════════════════════════════════════

export type Suit = "♠" | "♥" | "♦" | "♣"
export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K"

export interface Card {
  rank: Rank
  suit: Suit
}

const SUITS: Suit[] = ["♠", "♥", "♦", "♣"]
const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]

export function drawCard(): Card {
  return {
    rank: RANKS[Math.floor(Math.random() * RANKS.length)],
    suit: SUITS[Math.floor(Math.random() * SUITS.length)],
  }
}

export function isRed(suit: Suit): boolean {
  return suit === "♥" || suit === "♦"
}

function rankValue(rank: Rank): number {
  if (rank === "A") return 11
  if (rank === "J" || rank === "Q" || rank === "K") return 10
  return parseInt(rank, 10)
}

// Aces count as 11 until that busts the hand, then drop to 1 one at a time.
export function handValue(cards: Card[]): { total: number; soft: boolean } {
  let total = cards.reduce((sum, c) => sum + rankValue(c.rank), 0)
  let aces = cards.filter(c => c.rank === "A").length
  while (total > 21 && aces > 0) {
    total -= 10
    aces -= 1
  }
  // "Soft" = at least one ace is still being counted as 11
  const soft = cards.some(c => c.rank === "A") && aces > 0
  return { total, soft }
}

export function isBust(cards: Card[]): boolean {
  return handValue(cards).total > 21
}

export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21
}

// Dealer stands on all 17s (including soft 17) — the simplest common house rule.
export function dealerShouldHit(cards: Card[]): boolean {
  return handValue(cards).total < 17
}

// Resolves a finished hand into a settleWager() payout multiplier.
export function resolveOutcome(player: Card[], dealer: Card[]): number {
  if (isBust(player)) return 0
  const playerBJ = isBlackjack(player)
  const dealerBJ = isBlackjack(dealer)
  if (playerBJ && dealerBJ) return 1
  if (playerBJ) return 2.5
  if (dealerBJ) return 0
  if (isBust(dealer)) return 2
  const p = handValue(player).total
  const d = handValue(dealer).total
  if (p > d) return 2
  if (p === d) return 1
  return 0
}
