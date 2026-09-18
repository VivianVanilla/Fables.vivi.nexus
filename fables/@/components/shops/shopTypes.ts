// ════════════════════════════════════════════════════════════════════════════
// shopTypes.ts — shapes shared between the DM's Shops tab (CampaignView.tsx)
// and the player-side shop panel (ShopOverlay.tsx), both of which read/write
// the same campaign object's `data.shops`. Kept separate from CampaignView.tsx
// itself (which owns the DM-only mutators) so ShopOverlay doesn't need to pull
// in that whole file just for the shape, same reasoning as partyTypes.ts.
// ════════════════════════════════════════════════════════════════════════════

import type { Feature } from "@/components/shared/types"
import type { CardStyle } from "@/components/shared/constants"

export interface ShopPurchaseRequest {
  id: string
  itemId: string
  characterId: string
  characterName: string
  itemLabel: string   // display name at request time (respecting hidden/reveal) — so the DM's queue reads sensibly even if the DM later edits/removes the item
  price: number        // gp, snapshotted at request time — a later price edit shouldn't retroactively change what an already-pending request charges
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
  quantity: number
  at: string  // ISO timestamp
}

export interface Shop {
  id: string
  name: string
  items: Feature[]
  // Off (default) = purchases complete immediately, client-side, on both the
  // buyer's own row and this campaign row. On = a buy only ever appends a
  // ShopPurchaseRequest here; nothing else changes (stock, gold, the buyer's
  // inventory) until the DM approves it from the Shops tab.
  requireConfirmation?: boolean
  accentColor?: string
  cardStyle?: CardStyle
  portraitUrl?: string  // shopkeeper portrait, shown to players browsing this shop
  pendingRequests?: ShopPurchaseRequest[]
}

// No legacy shape to migrate from (shops are new) — unlike resolveStashes,
// this is just the empty-default read.
export function resolveShops(shops: Shop[] | undefined): Shop[] {
  return shops ?? []
}
