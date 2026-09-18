// ════════════════════════════════════════════════════════════════════════════
// ShopOverlay.tsx — the player-side counterpart to the DM's Shops tab in
// CampaignView.tsx. Shows whichever shop the DM has marked "current" (or a
// friendly empty state if none), lets the player buy an item with their own
// gold (see currencyMath.ts for the coin math CurrencyTracker.tsx's wallet
// itself uses), and respects each item's hidden/disguise setting and each
// shop's confirmation-required setting.
//
// Writes to the campaign row here (stock/history on an instant purchase, or
// a pending request on a confirmation-required shop) rely on an RLS policy
// permitting a party member to UPDATE their own campaign's object row — see
// updateSharedObject's own comment in UserContext.tsx for the same caveat on
// the (pre-existing, opposite-direction) DM→player write-through.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { X, Store, ShoppingCart } from "lucide-react"
import { useUserContext } from "../../../src/contexts/UserContext"
import { supabase } from "../../../src/supabase"
import { safeParseJson, nanoid } from "@/components/shared/utils"
import type { CharacterData, Feature } from "@/components/shared/types"
import { categoryAccentStyle } from "@/components/character/entries/FeatureEntry"
import { orderFor, calcSpend, type CoinKey } from "@/components/shared/currencyMath"
import { usePartyRoster } from "@/components/party/usePartyServer"
import { useChannelSuffix } from "@/components/party/partyTypes"
import type { Shop, ShopPurchaseRecord, ShopPurchaseRequest } from "@/components/shops/shopTypes"

// Only the campaign-data fields this overlay actually reads/writes — the
// full CampaignData shape lives in CampaignView.tsx (not exported), and this
// only ever patches the fields below, so a narrower local shape is enough
// (and safer — an accidental broad overwrite here would clobber whatever
// else the DM has stored on this same object).
interface CampaignShopData {
  shops?: Shop[]
  currentShopId?: string | null
  shopHistory?: ShopPurchaseRecord[]
}

export function ShopOverlay({
  partyCode, characterId, characterName, characterData, onUpdateCharacter, onClose,
}: {
  partyCode: string
  characterId: string
  characterName: string
  characterData: CharacterData
  onUpdateCharacter: (patch: Partial<CharacterData>) => void
  onClose: () => void
}) {
  const { updateSharedObject } = useUserContext()
  const { campaign } = usePartyRoster(partyCode)
  const suffix = useChannelSuffix()
  // Realtime-sourced overrides only (never written to synchronously from an
  // effect body) — `liveData` below falls back to the one-time `campaign`
  // fetch until the first realtime event (or a purchase's own optimistic
  // update) sets one, at which point it always wins as the more recent value.
  const [override, setOverride] = useState<CampaignShopData | null>(null)
  const [buyingItemId, setBuyingItemId] = useState<string | null>(null)
  const [justRequestedId, setJustRequestedId] = useState<string | null>(null)

  // usePartyRoster only fetches the campaign row once — this subscription is
  // what keeps stock, the current shop, and hidden/reveal changes live
  // without needing to close and reopen the panel, same pattern
  // PartyServer.tsx's own "discreet character" subscription uses for this
  // same object.
  useEffect(() => {
    const campaignId = campaign?.id
    if (!campaignId) return
    const ch = supabase
      .channel(`shop-overlay:${campaignId}:${suffix}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "objects", filter: `id=eq.${campaignId}` },
        payload => setOverride(safeParseJson((payload.new as { data: unknown }).data) as CampaignShopData))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [campaign?.id, suffix])

  const liveData: CampaignShopData | null = override ?? (campaign ? (safeParseJson(campaign.data) as CampaignShopData) : null)
  const shops = liveData?.shops ?? []
  const shop = shops.find(s => s.id === liveData?.currentShopId)
  const cardStyle = shop ? categoryAccentStyle(shop.accentColor, shop.cardStyle) : undefined

  const mode = characterData.currencyMode ?? "classic"
  const coins = characterData.currency ?? {}

  function affordable(priceGp: number): boolean {
    return calcSpend(coins, priceGp * 100, orderFor(mode)).canAfford
  }

  async function buy(item: Feature) {
    if (!shop || !campaign) return
    setBuyingItemId(item.id)
    try {
      const label = item.shopHidden ? (item.shopDisplayName || "Mystery Item") : item.name
      if (shop.requireConfirmation) {
        // Nothing changes yet — stock, gold, and the buyer's inventory all
        // wait for the DM's Approve (see CampaignView.tsx's approveShopRequest).
        const request: ShopPurchaseRequest = {
          id: nanoid(), itemId: item.id, characterId, characterName,
          itemLabel: label, price: item.value ?? 0, quantity: 1, requestedAt: new Date().toISOString(),
        }
        const nextShops = shops.map(s => s.id === shop.id ? { ...s, pendingRequests: [...(s.pendingRequests ?? []), request] } : s)
        const nextData = { ...liveData, shops: nextShops }
        await updateSharedObject(campaign.id, { data: nextData as unknown as JSON })
        setOverride(nextData)
        setJustRequestedId(item.id)
      } else {
        const spend = calcSpend(coins, (item.value ?? 0) * 100, orderFor(mode))
        if (!spend.canAfford) return
        const nextCoins = { ...coins }
        for (const [k, v] of Object.entries(spend.spent) as [CoinKey, number][]) nextCoins[k] = (nextCoins[k] ?? 0) - v
        for (const [k, v] of Object.entries(spend.change) as [CoinKey, number][]) nextCoins[k] = (nextCoins[k] ?? 0) + v

        const stockTracked = item.trackAmount || item.amount != null
        const nextItemAmount = stockTracked ? Math.max(0, (item.amount ?? 0) - 1) : item.amount
        const record: ShopPurchaseRecord = {
          id: nanoid(), shopId: shop.id, shopName: shop.name, characterId, characterName,
          itemLabel: label, price: item.value ?? 0, quantity: 1, at: new Date().toISOString(),
        }
        const nextShops = shops.map(s => s.id === shop.id ? {
          ...s, items: s.items.map(i => i.id === item.id ? { ...i, amount: nextItemAmount } : i),
        } : s)
        // Campaign row (stock + history) and this character's own row (gold +
        // inventory) — two independent writes, same split the DM's own
        // approve flow uses, just both fired from the buyer's own client
        // since nothing here needs the DM's client to be open.
        const nextData = { ...liveData, shops: nextShops, shopHistory: [...(liveData?.shopHistory ?? []), record] }
        await updateSharedObject(campaign.id, { data: nextData as unknown as JSON })
        setOverride(nextData)
        onUpdateCharacter({
          currency: nextCoins,
          items: [...(characterData.items ?? []), { ...item, id: nanoid(), amount: 1, shopHidden: undefined, shopDisplayName: undefined }],
        })
      }
    } catch (e) { console.error(e) } finally { setBuyingItemId(null) }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="px-4 py-3 border-b border-border shrink-0 flex items-center gap-2">
        <Store className="size-4 text-muted-foreground" />
        <span className="text-sm font-bold text-foreground">{shop?.name ?? "Shop"}</span>
        <div className="flex-1" />
        <button type="button" onClick={onClose} title="Close"
          className="size-7 flex items-center justify-center rounded-lg bg-foreground/8 hover:bg-foreground/15 text-foreground/70 transition-colors">
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        <div className="max-w-lg mx-auto flex flex-col gap-3">
          {!shop ? (
            <p className="text-sm text-muted-foreground/60 italic text-center mt-10">You are not currently at a shop! Visit a shopkeeper soon :)</p>
          ) : (
            <>
              <div className="rounded-xl bg-muted ring-1 ring-border p-4 flex items-center gap-3" style={cardStyle}>
                {shop.portraitUrl && <img src={shop.portraitUrl} alt="" className="size-12 rounded-full object-cover border border-border shrink-0" />}
                <div>
                  <p className="text-sm font-bold text-foreground">{shop.name}</p>
                  <p className="text-[10px] text-foreground/40">
                    {shop.requireConfirmation ? "The shopkeeper confirms every sale before handing anything over." : "Buy items directly — gold and goods change hands immediately."}
                  </p>
                </div>
              </div>

              {shop.items.length === 0 ? (
                <p className="text-xs text-foreground/30 italic text-center py-6">Nothing for sale right now.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {shop.items.map(item => {
                    const label = item.shopHidden ? (item.shopDisplayName || "Mystery Item") : item.name
                    const price = item.value ?? 0
                    const stockTracked = item.trackAmount || item.amount != null
                    const outOfStock = stockTracked && (item.amount ?? 0) <= 0
                    const canAfford = affordable(price)
                    const requested = justRequestedId === item.id
                    return (
                      <div key={item.id} className="rounded-xl bg-muted ring-1 ring-border p-3 flex items-center gap-3" style={cardStyle}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{label || "Unnamed item"}</p>
                          {!item.shopHidden && item.description && (
                            <p className="text-[11px] text-foreground/40 line-clamp-2 mt-0.5">{item.description}</p>
                          )}
                          <p className="text-[10px] text-foreground/40 mt-1">
                            {price}gp{stockTracked && <> · {Math.max(0, item.amount ?? 0)} left</>}
                          </p>
                        </div>
                        <button type="button" disabled={outOfStock || !canAfford || buyingItemId === item.id || requested}
                          onClick={() => buy(item)}
                          className="shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold transition-colors disabled:opacity-30 disabled:hover:bg-amber-500/20">
                          <ShoppingCart className="size-3.5" />
                          {requested ? "Requested" : outOfStock ? "Sold Out" : !canAfford ? "Can't Afford" : buyingItemId === item.id ? "…" : "Buy"}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
