// ════════════════════════════════════════════════════════════════════════════
// ShopOverlay.tsx — the player-side counterpart to the DM's Shops tab in
// CampaignView.tsx. Handles data-fetching/realtime/writes and the full-screen
// portal chrome; the actual "what does the shop look like" rendering (header,
// party wallets strip, item bubbles, buy popup) lives in ShopFront.tsx so the
// DM's ShopPlayerPreview can render byte-for-byte the same thing, read-only.
//
// Writes to the campaign row here (stock/history on an instant purchase, or
// a pending request on a confirmation-required shop) rely on an RLS policy
// permitting a party member to UPDATE their own campaign's object row — see
// updateSharedObject's own comment in UserContext.tsx for the same caveat on
// the (pre-existing, opposite-direction) DM→player write-through.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useRef } from "react"
import { createPortal } from "react-dom"
import { X, Store } from "lucide-react"
import { useUserContext } from "../../../src/contexts/UserContext"
import { supabase } from "../../../src/supabase"
import { safeParseJson, nanoid } from "@/components/shared/utils"
import type { CharacterData, Feature } from "@/components/shared/types"
import { orderFor, calcSpend, CP_VALUE, type CoinKey } from "@/components/shared/currencyMath"
import { usePartyRoster } from "@/components/party/usePartyServer"
import { useChannelSuffix } from "@/components/party/partyTypes"
import type { Shop, ShopPurchaseRecord, ShopPurchaseRequest } from "@/components/shops/shopTypes"
import { ShopFront, type ShopWallet } from "@/components/shops/ShopFront"

// Only the campaign-data fields this overlay actually reads/writes — the
// full CampaignData shape lives in CampaignView.tsx (not exported), and this
// only ever patches the fields below, so a narrower local shape is enough
// (and safer — an accidental broad overwrite here would clobber whatever
// else the DM has stored on this same object).
interface CampaignShopData {
  shops?: Shop[]
  currentShopId?: string | null
  shopHistory?: ShopPurchaseRecord[]
  rosterCardAccentColor?: string  // Campaign Settings' "Default Card Appearance" — fallback color for shops/items with no color of their own
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
  const { campaign, members } = usePartyRoster(partyCode)
  const suffix = useChannelSuffix()
  // Realtime-sourced overrides only (never written to synchronously from an
  // effect body) — `liveData` below falls back to the one-time `campaign`
  // fetch until the first realtime event (or a purchase's own optimistic
  // update) sets one, at which point it always wins as the more recent value.
  const [override, setOverride] = useState<CampaignShopData | null>(null)
  const [buyingItemId, setBuyingItemId] = useState<string | null>(null)
  const [justRequestedId, setJustRequestedId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])

  function showToast(message: string) {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 4000)
  }

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

  const mode = characterData.currencyMode ?? "classic"
  const coins = characterData.currency ?? {}

  // Every party member's own wallet, always visible — never summed. The
  // viewer's own row always comes from `characterData` (freshest local
  // state, no roster-fetch/realtime round-trip lag) rather than whatever
  // usePartyRoster last fetched for this same character.
  const wallets: ShopWallet[] = [
    { id: characterId, name: characterName, currency: coins, currencyMode: mode, currencyNames: characterData.currencyNames, isYou: true },
    ...members.filter(m => m.characterId !== characterId).map(m => ({
      id: m.characterId ?? m.userId, name: m.name, currency: m.currency ?? {}, currencyMode: m.currencyMode ?? "classic", currencyNames: m.currencyNames,
    })),
  ]

  function affordable(item: Feature): boolean {
    const unit = item.priceUnit ?? "gp"
    return calcSpend(coins, (item.value ?? 0) * CP_VALUE[unit], orderFor(mode)).canAfford
  }

  async function buy(item: Feature) {
    if (!shop || !campaign) return
    setBuyingItemId(item.id)
    try {
      const label = item.shopHidden ? (item.shopDisplayName || "Mystery Item") : item.name
      const unit = item.priceUnit ?? "gp"
      if (shop.requireConfirmation) {
        // Nothing changes yet — stock, gold, and the buyer's inventory all
        // wait for the DM's Approve (see CampaignView.tsx's approveShopRequest).
        const request: ShopPurchaseRequest = {
          id: nanoid(), itemId: item.id, characterId, characterName,
          itemLabel: label, price: item.value ?? 0, priceUnit: unit, quantity: 1, requestedAt: new Date().toISOString(),
        }
        const nextShops = shops.map(s => s.id === shop.id ? { ...s, pendingRequests: [...(s.pendingRequests ?? []), request] } : s)
        const nextData = { ...liveData, shops: nextShops }
        await updateSharedObject(campaign.id, { data: nextData as unknown as JSON })
        setOverride(nextData)
        setJustRequestedId(item.id)
        showToast(`Requested ${label} — waiting on the DM to confirm.`)
      } else {
        const spend = calcSpend(coins, (item.value ?? 0) * CP_VALUE[unit], orderFor(mode))
        if (!spend.canAfford) return
        const nextCoins = { ...coins }
        for (const [k, v] of Object.entries(spend.spent) as [CoinKey, number][]) nextCoins[k] = (nextCoins[k] ?? 0) - v
        for (const [k, v] of Object.entries(spend.change) as [CoinKey, number][]) nextCoins[k] = (nextCoins[k] ?? 0) + v

        const stockTracked = item.trackAmount || item.amount != null
        const nextItemAmount = stockTracked ? Math.max(0, (item.amount ?? 0) - 1) : item.amount
        const record: ShopPurchaseRecord = {
          id: nanoid(), shopId: shop.id, shopName: shop.name, characterId, characterName,
          itemLabel: label, price: item.value ?? 0, priceUnit: unit, quantity: 1, at: new Date().toISOString(),
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
        showToast(`Added ${label} to your bag!`)
      }
    } catch (e) { console.error(e) } finally { setBuyingItemId(null) }
  }

  // Covers the whole screen — header included — not just the padded content
  // column, so a shop's background image actually reads as "you're standing
  // in this place" rather than a small framed picture inside the page.
  const bgStyle: React.CSSProperties | undefined = shop?.backgroundImageUrl ? {
    backgroundImage: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.6)), url(${shop.backgroundImageUrl})`,
    backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed",
  } : undefined

  return createPortal(
    <div className={`fixed inset-0 z-50 flex flex-col ${bgStyle ? "" : "bg-background"}`} style={bgStyle}>
      <div className={`px-4 py-3 shrink-0 flex items-center gap-2 border-b ${bgStyle ? "border-white/10" : "border-border"}`}>
        <Store className={`size-4 ${bgStyle ? "text-white/70" : "text-muted-foreground"}`} />
        <span className={`text-sm font-bold ${bgStyle ? "text-white" : "text-foreground"}`}>{shop?.name ?? "Shop"}</span>
        <div className="flex-1" />
        <button type="button" onClick={onClose} title="Close"
          className={`size-7 flex items-center justify-center rounded-lg transition-colors ${bgStyle ? "bg-white/10 hover:bg-white/20 text-white/70" : "bg-foreground/8 hover:bg-foreground/15 text-foreground/70"}`}>
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 py-4">
        {/* Wide cap, not a phone-width column — a shop with several items
            was leaving most of a desktop screen empty and squeezing names
            into a narrow strip for no reason. On mobile there's no cap to
            fight, so the shop just fills the (already full-screen) overlay. */}
        <div className="max-w-5xl mx-auto">
          <ShopFront
            shop={shop}
            wallets={wallets}
            defaultAccentColor={liveData?.rosterCardAccentColor}
            viewerMode={mode}
            viewerNames={characterData.currencyNames}
            interactive={{ affordable, onBuy: buy, buyingItemId, justRequestedId }}
          />
        </div>
      </div>

      {toast && (
        // Full-width banner near the bottom on mobile (a corner toast is a
        // desktop-notification pattern that reads as an afterthought on a
        // phone); a normal compact corner toast once there's room for one.
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-xs z-[60] px-3 py-2 rounded-lg bg-zinc-900 border border-white/15 text-white text-xs shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
          {toast}
        </div>
      )}
    </div>,
    document.body,
  )
}
