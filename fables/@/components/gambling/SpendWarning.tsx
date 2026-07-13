// ════════════════════════════════════════════════════════════════════════════
// SpendWarning.tsx — shared "your tokens are already gone" banner. Every
// mini-game now spends the wager the instant you click Play (see
// useGamblingWallet's spendWager/payoutWager split), so this fires right
// then to make that real, not at the end once the result is already known.
// ════════════════════════════════════════════════════════════════════════════

import { useRef, useState } from "react"

export function useSpendWarning() {
  const [show, setShow] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function trigger() {
    setShow(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setShow(false), 1800)
  }

  return { show, trigger }
}

export function SpendWarningBanner({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <p className="text-[11px] font-bold tracking-wide text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-1.5 text-center animate-in fade-in slide-in-from-top-1 duration-150">
      ⚠️ YOUR CREDITS HAVE BEEN SPENT. DON'T LEAVE.
    </p>
  )
}
