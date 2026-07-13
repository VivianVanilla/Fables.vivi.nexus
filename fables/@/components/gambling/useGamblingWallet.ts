// ════════════════════════════════════════════════════════════════════════════
// useGamblingWallet.ts — token wallet backed by a single `objects` row
// (type: "gambling_wallet"), reusing the same createObject/updateObject
// plumbing every other feature already uses. No new table, no new RLS.
//
// Every mutation goes through mutateWallet(), which re-reads the wallet's
// current data at write time rather than trusting a component's
// closure-captured `tokens` value — safe to call spendWager() and, later,
// payoutWager() back to back without either one clobbering the other's
// write, as long as each call is awaited (so React has re-rendered with the
// wallet's post-spend `objects` entry) before the next one fires — which the
// mini-games already do, since there's an animation/round between the two.
// ════════════════════════════════════════════════════════════════════════════

import { useUserContext } from "../../../src/contexts/UserContext"
import { safeParseJson } from "../character-utils"
import { getDailySeed } from "../spelldle/spelldleLogic"
import { SPELLDLE_TOKEN_AWARD, type GamblingWalletData } from "./gamblingTypes"
import type { AppTheme } from "../../../src/contexts/ThemeContext"

const WALLET_TYPE = "gambling_wallet"

export function useGamblingWallet() {
  const { objects, createObject, updateObject } = useUserContext()

  const walletObj = objects.find(o => o.type === WALLET_TYPE)
  const data = safeParseJson(walletObj?.data) as GamblingWalletData

  const tokens = data.tokens ?? 0
  const unlockedTagIds = data.unlockedTagIds ?? []
  const equippedTagId = data.equippedTagId ?? null
  const unlockedThemeIds = data.unlockedThemeIds ?? []
  const unlocked2048 = data.unlocked2048 ?? false
  const unlockedMeditation = data.unlockedMeditation ?? false

  async function ensureWallet() {
    if (walletObj) return walletObj
    return createObject({ name: "Gambling Wallet", type: WALLET_TYPE, data: { tokens: 0 } })
  }

  // Re-reads the wallet's own data right before writing, so two mutations
  // fired close together (spend, then a payout a second later) never stomp
  // on each other using a stale pre-mutation balance. Returning null from
  // `fn` aborts the write (used for "insufficient balance" / "already owned"
  // checks that must be validated against the fresh balance, not render state).
  async function mutateWallet(fn: (current: GamblingWalletData) => Partial<GamblingWalletData> | null) {
    const wallet = await ensureWallet()
    const current = safeParseJson(wallet.data) as GamblingWalletData
    const next = fn(current)
    if (!next) return
    return updateObject(wallet.id, { data: { ...current, ...next } as unknown as JSON })
  }

  // +SPELLDLE_TOKEN_AWARD once per day, keyed off Spelldle's own daily puzzle
  // seed so reopening/replaying the same day's already-won puzzle never double-pays.
  async function claimSpelldleToken() {
    const seed = getDailySeed()
    await mutateWallet(current => {
      if (current.lastSpelldleAwardSeed === seed) return null
      return { tokens: (current.tokens ?? 0) + SPELLDLE_TOKEN_AWARD, lastSpelldleAwardSeed: seed }
    })
  }

  // Deducts the wager immediately (before the round plays out), so the spend
  // is real the instant you click Play, not something quietly reconciled at
  // the end. Returns whether it went through — false means insufficient
  // balance, and the caller should not start the round.
  async function spendWager(wager: number): Promise<boolean> {
    if (wager <= 0) return false
    let ok = false
    await mutateWallet(current => {
      const balance = current.tokens ?? 0
      if (balance < wager) return null
      ok = true
      return { tokens: balance - wager }
    })
    return ok
  }

  // Credits winnings once a round resolves. `amount` is the full payout
  // (wager * multiplier), not just the profit — the wager itself was already
  // taken by spendWager. A loss (multiplier 0) just never calls this.
  async function payoutWager(amount: number) {
    if (amount <= 0) return
    await mutateWallet(current => ({ tokens: (current.tokens ?? 0) + Math.round(amount) }))
  }

  async function buyTag(id: string, cost: number) {
    await mutateWallet(current => {
      const balance = current.tokens ?? 0
      const owned = current.unlockedTagIds ?? []
      if (balance < cost || owned.includes(id)) return null
      return { tokens: balance - cost, unlockedTagIds: [...owned, id] }
    })
  }

  async function equipTag(id: string | null) {
    await mutateWallet(() => ({ equippedTagId: id }))
  }

  async function buyTheme(id: AppTheme, cost: number) {
    await mutateWallet(current => {
      const balance = current.tokens ?? 0
      const owned = current.unlockedThemeIds ?? []
      if (balance < cost || owned.includes(id)) return null
      return { tokens: balance - cost, unlockedThemeIds: [...owned, id] }
    })
  }

  async function buy2048(cost: number) {
    await mutateWallet(current => {
      const balance = current.tokens ?? 0
      if (balance < cost || current.unlocked2048) return null
      return { tokens: balance - cost, unlocked2048: true }
    })
  }

  async function buyMeditation(cost: number) {
    await mutateWallet(current => {
      const balance = current.tokens ?? 0
      if (balance < cost || current.unlockedMeditation) return null
      return { tokens: balance - cost, unlockedMeditation: true }
    })
  }

  return {
    tokens,
    claimSpelldleToken,
    spendWager,
    payoutWager,
    unlockedTagIds,
    equippedTagId,
    equipTag,
    buyTag,
    unlockedThemeIds,
    buyTheme,
    unlocked2048,
    buy2048,
    unlockedMeditation,
    buyMeditation,
  }
}
