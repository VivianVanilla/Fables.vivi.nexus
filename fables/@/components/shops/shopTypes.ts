// ════════════════════════════════════════════════════════════════════════════
// shopTypes.ts — shapes shared between the DM's Shops tab (CampaignView.tsx)
// and the player-side shop panel (ShopOverlay.tsx), both of which read/write
// the same campaign object's `data.shops`. Kept separate from CampaignView.tsx
// itself (which owns the DM-only mutators) so ShopOverlay doesn't need to pull
// in that whole file just for the shape, same reasoning as partyTypes.ts.
// ════════════════════════════════════════════════════════════════════════════

import type { CSSProperties } from "react"
import type { Feature } from "@/components/shared/types"
import type { CoinKey } from "@/components/shared/currencyMath"

export interface ShopPurchaseRequest {
  id: string
  itemId: string
  characterId: string
  characterName: string
  itemLabel: string   // display name at request time (respecting hidden/reveal) — so the DM's queue reads sensibly even if the DM later edits/removes the item
  price: number        // snapshotted at request time — a later price edit shouldn't retroactively change what an already-pending request charges
  priceUnit: CoinKey    // which denomination `price` is in — snapshotted alongside it for the same reason
  quantity: number
  requestedAt: string  // ISO timestamp
}

export interface ShopPurchaseRecord {
  id: string
  shopId: string
  shopName: string
  characterId: string
  characterName: string
  itemLabel: string
  price: number
  priceUnit: CoinKey
  quantity: number
  at: string  // ISO timestamp
}

// Shop-wide defaults for what players see per item — undefined = true (i.e.
// today's behavior, before this setting existed). Any of these can be
// overridden per item (Feature.shopShowPrice/shopShowStock/shopShowDescription).
export interface ShopDisplaySettings {
  showPrices?: boolean
  showStock?: boolean
  showDescriptions?: boolean
}

// A named group within a shop ("Potions", "Weapons") — purely organizational
// plus a color, so a shop with several sections reads as visually distinct
// bands of color instead of one flat wall of identical bubbles. An item with
// no shopSectionId (or one that no longer matches a section) just falls
// under an "Other" bucket wherever sections render.
export interface ShopSection {
  id: string
  name: string
  color?: string
}

export interface Shop {
  id: string
  name: string
  items: Feature[]
  sections?: ShopSection[]
  // Off (default) = purchases complete immediately, client-side, on both the
  // buyer's own row and this campaign row. On = a buy only ever appends a
  // ShopPurchaseRequest here; nothing else changes (stock, gold, the buyer's
  // inventory) until the DM approves it from the Shops tab.
  requireConfirmation?: boolean
  accentColor?: string          // this shop's own color, used whenever an item has no section (or its section has no color) — see resolveItemColor
  display?: ShopDisplaySettings
  portraitUrl?: string  // shopkeeper portrait, shown to players browsing this shop
  backgroundImageUrl?: string  // banner image behind the ENTIRE shop panel (header, wallets, items) — not just the shopkeeper strip
  pendingRequests?: ShopPurchaseRequest[]
}

// No legacy shape to migrate from (shops are new) — unlike resolveStashes,
// this is just the empty-default read.
export function resolveShops(shops: Shop[] | undefined): Shop[] {
  return shops ?? []
}

// Single source of truth for what a player actually sees for one item in one
// shop — combines the shop-wide Display settings with this item's own
// overrides (and the pre-existing shopHidden disguise). Both ShopFront
// (real player rendering) and ShopPlayerPreview (the DM's "what do they see"
// panel) call this exact function, so the preview can never drift from
// reality.
export interface ResolvedItemDisplay {
  label: string
  hidden: boolean
  showPrice: boolean
  showStock: boolean
  showDescription: boolean
}

export function resolveItemDisplay(shop: Shop, item: Feature): ResolvedItemDisplay {
  const hidden = !!item.shopHidden
  const label = hidden ? (item.shopDisplayName || "Mystery Item") : (item.name || "Unnamed item")
  const shopWide = shop.display ?? {}
  const showPrice = item.shopShowPrice ?? shopWide.showPrices ?? true
  const showStock = item.shopShowStock ?? shopWide.showStock ?? true
  // A hidden item's flavor text would give away its real identity just as
  // much as its name would, so description stays suppressed regardless of
  // any per-item/shop-wide override — same rule ShopOverlay always enforced.
  const showDescription = !hidden && (item.shopShowDescription ?? shopWide.showDescriptions ?? true)
  return { label, hidden, showPrice, showStock, showDescription }
}

// Which color actually tints one item's card/bubble — its section's color if
// it's in a colored section, else the shop's own color, else a campaign-wide
// default the caller can pass in (e.g. Campaign Settings' "Default Card
// Appearance" — anything that hasn't set its own color inherits that one).
export function resolveItemColor(shop: Shop, item: Feature, fallback?: string): string | undefined {
  const section = shop.sections?.find(s => s.id === item.shopSectionId)
  return section?.color ?? shop.accentColor ?? fallback
}

export interface ShopItemGroup {
  id: string
  name: string       // "" for the ungrouped case (no sections defined at all) — callers skip rendering a header for that
  color?: string
  items: Feature[]
}

// Buckets a shop's items by section, in section order, with a trailing
// "Other" bucket for anything whose shopSectionId is unset or stale (its
// section got deleted). Shared by ShopFront (player/preview) and the DM's
// own management grid so both render sections identically.
export function groupItemsBySection(shop: Shop): ShopItemGroup[] {
  const sections = shop.sections ?? []
  if (sections.length === 0) return [{ id: "__all", name: "", color: undefined, items: shop.items }]
  return [
    ...sections.map(sec => ({ id: sec.id, name: sec.name, color: sec.color, items: shop.items.filter(i => i.shopSectionId === sec.id) })),
    { id: "__other", name: "Other", color: undefined, items: shop.items.filter(i => !sections.some(s => s.id === i.shopSectionId)) },
  ].filter(g => g.items.length > 0)
}

// A shop item's actual fill: its resolved color (resolveItemColor) —
// independent of categoryAccentStyle/"galaxy" (the generic character-sheet
// card formula shop bubbles borrowed at first) since that formula piggybacks
// on a CSS var that only ever exists on the character sheet's own DOM
// subtree, so it was always a no-op layer in the shop context anyway.
export function shopCardStyle(color: string | undefined): CSSProperties | undefined {
  if (!color) return undefined
  return { backgroundColor: color, "--tw-ring-color": color } as CSSProperties
}
