// ════════════════════════════════════════════════════════════════════════════
// scratchLogic.ts — bomb/diamond scratch ticket math (no React). The whole
// 9-panel grid is rolled the moment you buy a ticket (like a real scratch
// card, the layout is fixed before you scratch a single panel), but unlike a
// real scratch card you don't have to reveal the whole thing: scratchPayoutMultiplier
// is fed just the panels revealed so far, so cashing out early settles on a
// running tally instead of the full grid. Diamonds add to the payout, bombs
// take a bigger bite out of it, floored at 0 so a bad ticket never goes negative.
// ════════════════════════════════════════════════════════════════════════════

export type ScratchCell = "diamond" | "bomb"

export const SCRATCH_GRID_SIZE = 9
// Bombs are more common than diamonds (60/40) — panels were landing mostly
// diamond and made every ticket a near-sure win, so diamonds are now the
// minority. Diamond/bomb values are re-tuned against that 60/40 split so the
// average ticket still lands around ~92% RTP (same "generous toy" range as
// Slots/Plinko) instead of the ~8% a 60% bomb chance gives at the old values.
export const SCRATCH_BOMB_CHANCE = 0.6
export const SCRATCH_DIAMOND_VALUE = 0.55
export const SCRATCH_BOMB_PENALTY = 0.23

export function generateScratchGrid(): ScratchCell[] {
  return Array.from({ length: SCRATCH_GRID_SIZE }, () =>
    Math.random() < SCRATCH_BOMB_CHANCE ? "bomb" : "diamond"
  )
}

// Takes whichever cells have been revealed so far (the full grid, or a
// partial cash-out slice) — order doesn't matter within that set, only the
// diamond/bomb counts.
export function scratchPayoutMultiplier(grid: ScratchCell[]): number {
  const diamonds = grid.filter(c => c === "diamond").length
  const bombs = grid.filter(c => c === "bomb").length
  const raw = diamonds * SCRATCH_DIAMOND_VALUE - bombs * SCRATCH_BOMB_PENALTY
  return Math.max(0, Math.round(raw * 100) / 100)
}
