// ════════════════════════════════════════════════════════════════════════════
// GamblingModal.tsx — "gamVIVIling" overlay: 3 mini-games + shop, same modal
// chrome as SpelldleModal for visual consistency.
// ════════════════════════════════════════════════════════════════════════════

import { useState } from "react"
import { useGamblingWallet } from "./useGamblingWallet"
import { CoinFlipGame } from "./CoinFlipGame"
import { DiceRollGame } from "./DiceRollGame"
import { SlotsGame } from "./SlotsGame"
import { ShopPanel } from "./ShopPanel"

interface Props {
  onClose: () => void
  onOpen2048: () => void
}

type Tab = "coinflip" | "dice" | "slots" | "shop"

const TABS: [Tab, string][] = [
  ["coinflip", "Coin Flip"],
  ["dice",     "Dice"],
  ["slots",    "Slots"],
  ["shop",     "Shop"],
]

export function GamblingModal({ onClose, onOpen2048 }: Props) {
  const { tokens, unlocked2048 } = useGamblingWallet()
  const [tab, setTab] = useState<Tab>("coinflip")

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-white/15 rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto overflow-x-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10 shrink-0">
          <span className="text-3xl">🎰</span>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-bold text-white">gamVIVIling</p>
            <p className="text-xs text-white/40">{tokens} 🪙 tokens</p>
          </div>
          {unlocked2048 && (
            <button type="button" onClick={onOpen2048} title="Play 2048"
              className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors shrink-0">
              🔢 2048
            </button>
          )}
          <button type="button" onClick={onClose}
            className="size-9 flex items-center justify-center rounded-md hover:bg-white/10 text-white/50 hover:text-white transition-colors shrink-0">
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-4 pt-3 shrink-0">
          {TABS.map(([id, label]) => (
            <button key={id} type="button" onClick={() => setTab(id)}
              className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-colors ${tab === id ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70 hover:bg-white/5"}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="px-6 pb-6">
          {tab === "coinflip" && <CoinFlipGame />}
          {tab === "dice" && <DiceRollGame />}
          {tab === "slots" && <SlotsGame />}
          {tab === "shop" && <ShopPanel />}
        </div>
      </div>
    </div>
  )
}
