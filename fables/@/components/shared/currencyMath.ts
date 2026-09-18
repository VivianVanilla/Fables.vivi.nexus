// ════════════════════════════════════════════════════════════════════════════
// currencyMath.ts — the coin-denomination math CurrencyTracker.tsx's own
// wallet uses, factored out so the Shops tab (CampaignView.tsx) and the
// player-side shop panel (ShopOverlay.tsx) can reuse the exact same "spend N
// gp" logic for a purchase's gold deduction. Split out of CurrencyTracker.tsx
// itself (a plain re-export from there broke Fast Refresh for that file —
// same reasoning as damageTypes.ts living separately from the components
// that use it) rather than duplicated.
// ════════════════════════════════════════════════════════════════════════════

export type CoinKey      = "pp" | "gp" | "ep" | "sp" | "cp"
export type CurrencyMode = "classic" | "simple" | "custom"

// CP value of each denomination (standard 5e)
export const CP_VALUE: Record<CoinKey, number> = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 }

export function orderFor(mode: CurrencyMode): CoinKey[] {
  return mode === "simple" ? ["pp", "gp", "sp", "cp"] : ["pp", "gp", "ep", "sp", "cp"]
}

interface SpendResult {
  canAfford: true
  spent:  Partial<Record<CoinKey, number>>
  change: Partial<Record<CoinKey, number>>
  needsBreaking: boolean
}

export function calcSpend(
  coins: Partial<Record<CoinKey, number>>,
  amountCP: number,
  order: CoinKey[],
): { canAfford: false } | SpendResult {
  const totalCP = order.reduce((s, k) => s + (coins[k] ?? 0) * CP_VALUE[k], 0)
  if (amountCP > totalCP) return { canAfford: false }

  let remaining = amountCP
  const spent: Partial<Record<CoinKey, number>> = {}

  // Pass 1: use exact coins highest→lowest
  for (const k of order) {
    if (remaining <= 0) break
    const have = coins[k] ?? 0
    const use  = Math.min(have, Math.floor(remaining / CP_VALUE[k]))
    if (use > 0) { spent[k] = use; remaining -= use * CP_VALUE[k] }
  }

  // Pass 2: if still remaining, overpay with smallest coin that covers it
  if (remaining > 0) {
    for (const k of [...order].reverse()) {
      const have = (coins[k] ?? 0) - (spent[k] ?? 0)
      if (have > 0 && CP_VALUE[k] >= remaining) {
        spent[k] = (spent[k] ?? 0) + 1
        remaining -= CP_VALUE[k]
        break
      }
    }
    // Fallback: use largest available (shouldn't reach here since totalCP was enough)
    if (remaining > 0) {
      for (const k of order) {
        const have = (coins[k] ?? 0) - (spent[k] ?? 0)
        if (have > 0) { spent[k] = (spent[k] ?? 0) + 1; remaining -= CP_VALUE[k] }
        if (remaining <= 0) break
      }
    }
  }

  // Change = overpayment
  const changeCP = -remaining
  const change: Partial<Record<CoinKey, number>> = {}
  if (changeCP > 0) {
    let left = changeCP
    for (const k of order) {
      const val = CP_VALUE[k]
      if (left >= val) { change[k] = Math.floor(left / val); left -= change[k]! * val }
    }
  }

  return { canAfford: true, spent, change, needsBreaking: changeCP > 0 }
}
