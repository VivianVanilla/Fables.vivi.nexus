// ════════════════════════════════════════════════════════════════════════════
// useGamblingWallet.ts — token wallet backed by a single `objects` row
// (type: "gambling_wallet"), reusing the same createObject/updateObject
// plumbing every other feature already uses. No new table, no new RLS.
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

  async function patch(next: Partial<GamblingWalletData>) {
    const wallet = await ensureWallet()
    const current = safeParseJson(wallet.data) as GamblingWalletData
    return updateObject(wallet.id, { data: { ...current, ...next } as unknown as JSON })
  }

  // +SPELLDLE_TOKEN_AWARD once per day, keyed off Spelldle's own daily puzzle
  // seed so reopening/replaying the same day's already-won puzzle never double-pays.
  async function claimSpelldleToken() {
    const seed = getDailySeed()
    const wallet = await ensureWallet()
    const current = safeParseJson(wallet.data) as GamblingWalletData
    if (current.lastSpelldleAwardSeed === seed) return
    await updateObject(wallet.id, {
      data: { ...current, tokens: (current.tokens ?? 0) + SPELLDLE_TOKEN_AWARD, lastSpelldleAwardSeed: seed } as unknown as JSON,
    })
  }

  async function spend(amount: number) {
    if (amount <= 0) return
    await patch({ tokens: Math.max(0, tokens - amount) })
  }

  async function credit(amount: number) {
    if (amount <= 0) return
    await patch({ tokens: tokens + amount })
  }

  async function buyTag(id: string, cost: number) {
    if (tokens < cost || unlockedTagIds.includes(id)) return
    await patch({ tokens: tokens - cost, unlockedTagIds: [...unlockedTagIds, id] })
  }

  async function equipTag(id: string | null) {
    await patch({ equippedTagId: id })
  }

  async function buyTheme(id: AppTheme, cost: number) {
    if (tokens < cost || unlockedThemeIds.includes(id)) return
    await patch({ tokens: tokens - cost, unlockedThemeIds: [...unlockedThemeIds, id] })
  }

  async function buy2048(cost: number) {
    if (tokens < cost || unlocked2048) return
    await patch({ tokens: tokens - cost, unlocked2048: true })
  }

  return {
    tokens,
    claimSpelldleToken,
    spend,
    credit,
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
