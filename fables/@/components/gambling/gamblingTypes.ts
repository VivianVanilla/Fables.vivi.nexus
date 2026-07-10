// ════════════════════════════════════════════════════════════════════════════
// gamblingTypes.ts — wallet shape + shop catalogs for gamVIVIling
// ════════════════════════════════════════════════════════════════════════════

import type { AppTheme } from "../../../src/contexts/ThemeContext"

export interface GamblingWalletData {
  tokens?: number
  lastSpelldleAwardSeed?: string   // today's spelldle daily seed once claimed — prevents double-award
  unlockedTagIds?: string[]
  equippedTagId?: string | null
  unlockedThemeIds?: string[]      // AppTheme ids beyond the free set
  unlocked2048?: boolean
}

export const SPELLDLE_TOKEN_AWARD = 10

export interface ShopTag {
  id: string
  emoji: string
  label: string
  cost: number
}

// Prices are 10x the original catalog (100/100/150/150/200) — at 10 tokens/day
// from Spelldle alone, nothing here is reachable without actually gambling;
// Spelldle is just a small daily bonus, gambling is the real token source.
export const TAGS: ShopTag[] = [
  { id: "high-roller", emoji: "🎲", label: "High Roller", cost: 100 },
  { id: "degenerate",  emoji: "💀", label: "Degenerate",  cost: 190 },
  { id: "lucky",       emoji: "🍀", label: "Lucky",       cost: 250 },
  { id: "on-fire",     emoji: "🔥", label: "On Fire",     cost: 250 },
  { id: "vivip",       emoji: "👑", label: "VIVIP",       cost: 200 },
]

export interface ShopTheme {
  id: AppTheme
  label: string
  cost: number
}

export const THEME_UNLOCKS: ShopTheme[] = [
  { id: "trippy",    label: "Trippy",       cost: 400 },
  { id: "vaporwave", label: "Vaporwave",    cost: 400 },
  { id: "synthwave", label: "Synthwave",    cost: 400 },
  { id: "toxic",     label: "Toxic",        cost: 400 },
  { id: "gold",      label: "High Roller",  cost: 500 },
]

export const TWO048_COST = 950
