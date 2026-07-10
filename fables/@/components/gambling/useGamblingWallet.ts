// ════════════════════════════════════════════════════════════════════════════
// useGamblingWallet.ts — token wallet backed by a single `objects` row
// (type: "gambling_wallet"), reusing the same createObject/updateObject
// plumbing every other feature already uses. No new table, no new RLS.
//
// Every mutation goes through mutateWallet(), which re-reads the wallet's
// current data at write time rather than trusting a component's
// closure-captured `tokens` value. A wager's spend-then-payout used to be
// two separate calls (spend, then credit ~1s later after the flip/roll/spin
// animation) — the credit call closed over the *pre-spend* balance, so every
// win paid out double what it should have. settleWager() below does the
// whole "subtract wager, add payout" as one atomic read-modify-write.
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

  // Resolves one wager atomically: balance - wager + round(wager * payoutMultiplier).
  // payoutMultiplier is 0 on a loss, 1 on a push (wager back), >1 on a win.
  // No-ops (aborts the write) if the fresh balance can't actually cover the wager.
  async function settleWager(wager: number, payoutMultiplier: number) {
    if (wager <= 0) return
    await mutateWallet(current => {
      const balance = current.tokens ?? 0
      if (balance < wager) return null
      const payout = Math.round(wager * payoutMultiplier)
      return { tokens: Math.max(0, balance - wager + payout) }
    })
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

  return {
    tokens,
    claimSpelldleToken,
    settleWager,
    unlockedTagIds,
    equippedTagId,
    equipTag,
    buyTag,
    unlockedThemeIds,
    buyTheme,
    unlocked2048,
    buy2048,
  }
}
