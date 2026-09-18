// ════════════════════════════════════════════════════════════════════════════
// WalletChips.tsx — a compact "12 PP · 340 GP · 5 SP" row for one character's
// wallet, showing every nonzero denomination (not just gold). Used wherever a
// full coin breakdown needs to show at a glance without the full
// CurrencyTracker wallet card: the Shops feature's always-visible party
// wallet strip (DM's Shops tab and the player's Shop panel), both fed by the
// same SLOTS/coinLabel metadata CurrencyTracker.tsx itself uses so the
// abbreviations/colors always match.
// ════════════════════════════════════════════════════════════════════════════

import { SLOTS, coinLabel, type CoinKey, type CurrencyMode } from "@/components/shared/currencyMath"

export function WalletChips({ coins, mode, names, dense }: {
  coins: Partial<Record<CoinKey, number>>
  mode: CurrencyMode
  names?: string[]
  dense?: boolean  // tighter padding/text — the DM's always-visible Party Wallets panel uses this so it doesn't dominate the tab
}) {
  const visible = SLOTS.filter(s => (mode !== "simple" || s.key !== "ep") && (coins[s.key] ?? 0) > 0)

  if (visible.length === 0) {
    return <span className="text-[10px] text-foreground/30 italic">Empty</span>
  }

  return (
    <div className={`flex items-center flex-wrap ${dense ? "gap-1" : "gap-1.5"}`}>
      {visible.map(s => (
        <span key={s.key} className={`font-semibold tabular-nums rounded-full ${s.bg} ${s.color} ${dense ? "text-[10px] px-1 py-px" : "text-[11px] px-1.5 py-0.5"}`}>
          {(coins[s.key] ?? 0).toLocaleString("en-US")} {coinLabel(s.key, mode, names)}
        </span>
      ))}
    </div>
  )
}
