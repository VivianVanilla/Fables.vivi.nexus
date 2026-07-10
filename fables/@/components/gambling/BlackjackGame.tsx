// ════════════════════════════════════════════════════════════════════════════
// BlackjackGame.tsx — wager tokens, single hand vs. the dealer, turn-based:
// your turn (hit/stand) resolves fully, then the dealer's turn plays out one
// card at a time (not an instant jump to the final hand). Blackjack pays
// 2.5x, a regular win pays 2x, a push returns the wager, a loss pays 0.
// ════════════════════════════════════════════════════════════════════════════

import { useState } from "react"
import { useGamblingWallet } from "./useGamblingWallet"
import {
  drawCard, isRed, handValue, isBust, isBlackjack, dealerShouldHit, resolveOutcome,
  type Card,
} from "./blackjackLogic"
import { WagerStepper } from "./WagerStepper"

type Phase = "betting" | "playing" | "dealer" | "done"

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function CardFace({ card, hidden }: { card: Card; hidden?: boolean }) {
  if (hidden) {
    return (
      <div className="w-11 h-16 rounded-lg bg-white/10 border-2 border-white/15 flex items-center justify-center text-white/20 text-lg animate-in fade-in zoom-in-90 duration-200">?</div>
    )
  }
  return (
    <div className={`w-11 h-16 rounded-lg bg-white border-2 border-white/20 flex flex-col items-center justify-center leading-none animate-in fade-in zoom-in-90 duration-200 ${isRed(card.suit) ? "text-red-600" : "text-zinc-900"}`}>
      <span className="text-sm font-bold">{card.rank}</span>
      <span className="text-lg">{card.suit}</span>
    </div>
  )
}

export function BlackjackGame() {
  const { tokens, settleWager } = useGamblingWallet()
  const [wager, setWager] = useState(1)
  const [phase, setPhase] = useState<Phase>("betting")
  const [playerCards, setPlayerCards] = useState<Card[]>([])
  const [dealerCards, setDealerCards] = useState<Card[]>([])
  const [outcome, setOutcome] = useState<{ multiplier: number } | null>(null)

  const canDeal = phase === "betting" && wager >= 1 && wager <= tokens

  function deal() {
    if (!canDeal) return
    const p = [drawCard(), drawCard()]
    const d = [drawCard(), drawCard()]
    setPlayerCards(p)
    setDealerCards(d)
    setOutcome(null)
    if (isBlackjack(p)) {
      setPhase("dealer")
      playDealerTurn(p, d)
    } else {
      setPhase("playing")
    }
  }

  function hit() {
    if (phase !== "playing") return
    const next = [...playerCards, drawCard()]
    setPlayerCards(next)
    if (isBust(next)) {
      setPhase("dealer")
      playDealerTurn(next, dealerCards)
    }
  }

  function stand() {
    if (phase !== "playing") return
    setPhase("dealer")
    playDealerTurn(playerCards, dealerCards)
  }

  // The dealer's turn plays out one card at a time — each hit is its own
  // visible step with a pause, not an instant jump to the final hand.
  async function playDealerTurn(finalPlayer: Card[], startingDealer: Card[]) {
    await sleep(600)
    let dealerHand = startingDealer
    setDealerCards(dealerHand)
    if (!isBust(finalPlayer)) {
      while (dealerShouldHit(dealerHand)) {
        await sleep(700)
        dealerHand = [...dealerHand, drawCard()]
        setDealerCards(dealerHand)
      }
    }
    await sleep(500)
    const multiplier = resolveOutcome(finalPlayer, dealerHand)
    await settleWager(wager, multiplier)
    setOutcome({ multiplier })
    setPhase("done")
  }

  function newHand() {
    setPlayerCards([])
    setDealerCards([])
    setOutcome(null)
    setPhase("betting")
  }

  const playerTotal = playerCards.length ? handValue(playerCards).total : 0
  const dealerTotal = dealerCards.length ? handValue(dealerCards).total : 0
  const showDealerHole = phase === "playing"

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      {phase !== "betting" && (
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[10px] text-white/30 uppercase tracking-widest">
            Dealer {!showDealerHole && `· ${dealerTotal}`} {phase === "dealer" && <span className="text-primary/70">— Dealer's Turn</span>}
          </span>
          <div className="flex gap-1.5">
            {dealerCards.map((c, i) => <CardFace key={i} card={c} hidden={showDealerHole && i === 1} />)}
          </div>
        </div>
      )}

      {phase !== "betting" && (
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex gap-1.5">
            {playerCards.map((c, i) => <CardFace key={i} card={c} />)}
          </div>
          <span className="text-[10px] text-white/30 uppercase tracking-widest">
            You · {playerTotal}{isBlackjack(playerCards) ? " (Blackjack!)" : isBust(playerCards) ? " (Bust)" : ""}
            {phase === "playing" && <span className="text-primary/70"> — Your Turn</span>}
          </span>
        </div>
      )}

      {phase === "betting" && (
        <WagerStepper wager={wager} onChange={setWager} maxTokens={Math.max(1, tokens)} />
      )}

      {phase === "betting" && (
        <button type="button" onClick={deal} disabled={!canDeal}
          className="text-sm font-semibold px-5 py-2 rounded-xl bg-primary/80 hover:bg-primary text-white transition-colors disabled:opacity-30">
          Deal
        </button>
      )}

      {phase === "playing" && (
        <div className="flex items-center gap-2">
          <button type="button" onClick={hit}
            className="text-sm font-semibold px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors">
            Hit
          </button>
          <button type="button" onClick={stand}
            className="text-sm font-semibold px-4 py-2 rounded-xl bg-primary/80 hover:bg-primary text-white transition-colors">
            Stand
          </button>
        </div>
      )}

      {phase === "done" && outcome && (
        <>
          <p className={`text-sm font-bold ${outcome.multiplier > 1 ? "text-emerald-300" : outcome.multiplier === 1 ? "text-amber-300" : "text-red-300"}`}>
            {outcome.multiplier === 2.5 ? `Blackjack! You won ${Math.round(wager * 1.5)} tokens.`
              : outcome.multiplier === 2 ? `You won ${wager} tokens.`
              : outcome.multiplier === 1 ? `Push — you got your ${wager} back.`
              : `You lost ${wager}.`}
          </p>
          <button type="button" onClick={newHand}
            className="text-sm font-semibold px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors">
            New Hand
          </button>
        </>
      )}

      {phase === "betting" && tokens < 1 && <p className="text-xs text-white/30 italic">Not enough tokens to play.</p>}
      <p className="text-[10px] text-white/25 text-center">Blackjack pays 3:2 · win pays 2x · push returns your wager</p>
    </div>
  )
}
