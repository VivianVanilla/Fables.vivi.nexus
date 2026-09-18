// ════════════════════════════════════════════════════════════════════════════
// ShopFront.tsx — the actual "what a player sees" rendering: shop header, the
// always-visible party wallets strip, and the item grid (bubbles you open to
// buy, not an ever-growing list of rows). Factored out of ShopOverlay.tsx so
// the DM's ShopPlayerPreview can render the EXACT same thing read-only,
// instead of a hand-maintained lookalike that could drift from reality.
//
// Both interactive (ShopOverlay) and read-only (ShopPlayerPreview) modes
// share one masking source of truth: resolveItemDisplay() in shopTypes.ts,
// and one color source of truth: resolveItemColor() + categoryAccentStyle()
// (the same "Background" fill every other card-style setting in the app
// uses — see CampaignView.tsx's ShopItemCardBody for the DM-side twin).
// ════════════════════════════════════════════════════════════════════════════

import { useState } from "react"
import { ShoppingCart, Store, X } from "lucide-react"
import type { Feature } from "@/components/shared/types"
import type { CoinKey, CurrencyMode } from "@/components/shared/currencyMath"
import { formatPrice } from "@/components/shared/currencyMath"
import { WalletChips } from "@/components/shared/ui/WalletChips"
import { Modal } from "@/components/shared/ui/Modal"
import { categoryAccentStyle } from "@/components/character/entries/FeatureEntry"
import { Markdown } from "@/components/ui/Markdown"
import { resolveItemDisplay, resolveItemColor, shopCardStyle, groupItemsBySection, type Shop } from "@/components/shops/shopTypes"

export interface ShopWallet {
  id: string
  name: string
  currency: Partial<Record<CoinKey, number>>
  currencyMode: CurrencyMode
  currencyNames?: string[]
  isYou?: boolean  // highlights the viewer's own wallet in the strip
}

interface InteractiveProps {
  affordable: (item: Feature) => boolean
  onBuy: (item: Feature) => void
  buyingItemId: string | null
  justRequestedId: string | null
}

function stockLabel(item: Feature, outOfStock: boolean): string {
  if (outOfStock) return "Sold out"
  const current = Math.max(0, item.amount ?? 0)
  return item.shopMaxAmount != null ? `${current}/${item.shopMaxAmount} left` : `${current} left`
}

export function ShopFront({ shop, wallets, interactive, defaultAccentColor, viewerMode = "classic", viewerNames }: {
  shop: Shop | undefined
  wallets: ShopWallet[]
  interactive?: InteractiveProps
  // Campaign-wide fallback color (Campaign Settings' "Default Card
  // Appearance") — used for any item/shop that hasn't picked its own color.
  defaultAccentColor?: string
  // Whose denomination names/mode a price is rendered in — the viewing
  // player's own wallet settings (so "3 Crowns" reads right for them), or
  // omitted for the DM's preview (no single viewer, so the standard
  // abbreviations are used instead).
  viewerMode?: CurrencyMode
  viewerNames?: string[]
}) {
  const [openItemId, setOpenItemId] = useState<string | null>(null)
  const openItem = shop?.items.find(i => i.id === openItemId)

  if (!shop) {
    return <p className="text-sm text-muted-foreground/60 italic text-center mt-10">You are not currently at a shop! Visit a shopkeeper soon :)</p>
  }

  const groups = groupItemsBySection(shop)
  // The shop's own color — same formula ("Background" fill) as every other
  // "card style" in the app (roster cards, stash, feature stylings) instead
  // of a one-off alpha blend, so a shop actually looks like the color its
  // DM picked instead of a barely-tinted default gray.
  const shopColor = shop.accentColor ?? defaultAccentColor
  const shopStyle = categoryAccentStyle(shopColor, "galaxy")

  // The background image (when set) is painted by the host — the full
  // fixed-position screen in ShopOverlay.tsx, or the whole modal card in
  // ShopPlayerPreview.tsx — not by this div, so it actually covers the
  // entire screen/modal (header included) instead of just this content
  // column's own padded box.
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl bg-muted ring-1 ring-border p-4 flex items-center gap-3" style={shopStyle}>
        {shop.portraitUrl && <img src={shop.portraitUrl} alt="" className="size-12 rounded-full object-cover border border-border shrink-0" />}
        <div>
          <p className="text-sm font-bold text-foreground">{shop.name}</p>
          <p className="text-[10px] text-foreground/40">
            {shop.requireConfirmation ? "The shopkeeper confirms every sale before handing anything over." : "Buy items directly"}
          </p>
        </div>
      </div>

      {wallets.length > 0 && (
        <div className="rounded-xl bg-muted ring-1 ring-border p-3 flex flex-col gap-2" style={shopStyle}>
          <span className="text-[10px] uppercase tracking-widest text-foreground/50 font-semibold">Party Wallets</span>
          <div className="flex flex-col gap-1.5">
            {wallets.map(w => (
              <div key={w.id} className="flex items-center justify-between gap-3">
                <span className={`text-xs shrink-0 ${w.isYou ? "font-bold text-foreground" : "text-foreground/60"}`}>{w.name}{w.isYou && " (you)"}</span>
                <WalletChips coins={w.currency} mode={w.currencyMode} names={w.currencyNames} />
              </div>
            ))}
          </div>
        </div>
      )}

      {shop.items.length === 0 ? (
        <p className="text-xs text-foreground/30 italic text-center py-6">Nothing for sale right now.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map(group => (
            <div key={group.id} className="flex flex-col gap-1.5">
              {group.name && (
                <span className="text-[10px] uppercase tracking-widest font-semibold flex items-center gap-1.5"
                  style={{ color: group.color ?? "var(--color-foreground)", opacity: group.color ? 1 : 0.5 }}>
                  {group.color && <span className="size-1.5 rounded-full" style={{ backgroundColor: group.color }} />}
                  {group.name}
                </span>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {group.items.map(item => {
                  const { label, showPrice, showStock } = resolveItemDisplay(shop, item)
                  const unit = item.priceUnit ?? "gp"
                  const price = item.value ?? 0
                  const stockTracked = item.trackAmount || item.amount != null
                  const outOfStock = stockTracked && (item.amount ?? 0) <= 0
                  const color = resolveItemColor(shop, item, defaultAccentColor)
                  return (
                    <button key={item.id} type="button" onClick={() => setOpenItemId(item.id)}
                      className="flex flex-col items-center gap-1 rounded-xl bg-muted ring-1 ring-border p-3 hover:ring-foreground/30 transition-colors text-center min-h-[4.5rem]"
                      style={shopCardStyle(color)}>
                      {/* Never truncated — a cut-off name is worse than a
                          slightly taller card. Wraps up to 3 lines, which a
                          2-3 column grid comfortably has room for. */}
                      <p className="text-[11px] font-semibold text-foreground line-clamp-3 leading-snug w-full">{label}</p>
                      <p className="text-[10px] text-foreground/40 mt-auto">
                        {showPrice && formatPrice(price, unit, viewerMode, viewerNames)}
                        {showPrice && showStock && stockTracked && " · "}
                        {showStock && stockTracked && stockLabel(item, outOfStock)}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {openItem && (() => {
        const shopNow = shop
        const { label, showPrice, showStock, showDescription } = resolveItemDisplay(shopNow, openItem)
        const unit = openItem.priceUnit ?? "gp"
        const price = openItem.value ?? 0
        const stockTracked = openItem.trackAmount || openItem.amount != null
        const outOfStock = stockTracked && (openItem.amount ?? 0) <= 0
        const canAfford = interactive ? interactive.affordable(openItem) : true
        const requested = interactive?.justRequestedId === openItem.id
        const buying = interactive?.buyingItemId === openItem.id
        return (
          <Modal onClose={() => setOpenItemId(null)}>
            <div className="bg-zinc-900 border border-white/15 rounded-2xl shadow-2xl w-[min(640px,calc(100vw-2rem))] max-h-[85vh] flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
                <p className="text-sm font-bold text-white">{label}</p>
                <button type="button" onClick={() => setOpenItemId(null)}
                  className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white shrink-0">
                  <X className="size-4" />
                </button>
              </div>
              <div className="p-5 flex flex-col gap-3 overflow-y-auto">
                {showDescription && openItem.description && (
                  <div className="max-h-[50vh] overflow-y-auto">
                    <Markdown text={openItem.description} tone="dark" size="xs" />
                  </div>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  {showPrice && (
                    <span className="text-xs px-2 py-1 rounded-full bg-amber-500/15 text-amber-300 font-semibold">{formatPrice(price, unit, viewerMode, viewerNames)}</span>
                  )}
                  {showStock && stockTracked && (
                    <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-white/50">{stockLabel(openItem, outOfStock)}</span>
                  )}
                </div>
                {interactive ? (
                  <button type="button" disabled={outOfStock || !canAfford || buying || requested}
                    onClick={() => interactive.onBuy(openItem)}
                    className="flex items-center justify-center gap-1.5 text-sm px-3 py-2 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold transition-colors disabled:opacity-30 disabled:hover:bg-amber-500/20">
                    <ShoppingCart className="size-4" />
                    {requested ? "Requested" : outOfStock ? "Sold Out" : !canAfford ? "Can't Afford" : buying ? "…" : "Buy"}
                  </button>
                ) : (
                  <p className="text-[10px] text-white/30 italic flex items-center gap-1.5"><Store className="size-3" /> Preview only — no purchases happen here.</p>
                )}
              </div>
            </div>
          </Modal>
        )
      })()}
    </div>
  )
}
