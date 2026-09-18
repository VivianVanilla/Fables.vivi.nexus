// ════════════════════════════════════════════════════════════════════════════
// ShopPlayerPreview.tsx — DM-only "what are my players actually looking at
// right now" panel. Renders the live shop through the exact same ShopFront
// component ShopOverlay.tsx uses for the real player-facing panel, just in
// read-only mode and fed straight from data CampaignView.tsx already holds
// in memory (campaignData/partyMembers) — no separate fetch, so it can never
// show something a player wouldn't actually see.
//
// A full-screen portal, structurally identical to ShopOverlay.tsx itself
// (not a centered modal card) — since this feature is mostly used on
// mobile, the preview should look and behave exactly like the real thing,
// not a shrunken desktop-style dialog version of it.
// ════════════════════════════════════════════════════════════════════════════

import { createPortal } from "react-dom"
import { Eye, X } from "lucide-react"
import type { SidebarObject } from "@/components/shell/sidebar-utils"
import { safeParseJson } from "@/components/shared/utils"
import type { CoinKey, CurrencyMode } from "@/components/shared/currencyMath"
import type { Shop } from "@/components/shops/shopTypes"
import { ShopFront, type ShopWallet } from "@/components/shops/ShopFront"

interface CharWalletData {
  currency?: Partial<Record<CoinKey, number>>
  currencyMode?: CurrencyMode
  currencyNames?: string[]
}

export function ShopPlayerPreview({ shop, isLive, partyMembers, defaultAccentColor, onClose }: {
  shop: Shop | undefined
  // Whether this shop is the one actually marked "current" for players right
  // now — the DM can also preview a shop that isn't live yet, so the banner
  // below is honest about which case this is.
  isLive?: boolean
  partyMembers: SidebarObject[]
  defaultAccentColor?: string
  onClose: () => void
}) {
  const wallets: ShopWallet[] = partyMembers.map(m => {
    const d = safeParseJson(m.data) as CharWalletData
    return { id: m.id, name: m.name, currency: d.currency ?? {}, currencyMode: d.currencyMode ?? "classic", currencyNames: d.currencyNames }
  })

  // Same "covers the whole screen" treatment as ShopOverlay.tsx — a DM
  // previewing a shop with a background image should see exactly how much
  // of the screen it actually fills for a real player.
  const bgStyle: React.CSSProperties | undefined = shop?.backgroundImageUrl ? {
    backgroundImage: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.6)), url(${shop.backgroundImageUrl})`,
    backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed",
  } : undefined

  return createPortal(
    <div className={`fixed inset-0 z-50 flex flex-col ${bgStyle ? "" : "bg-background"}`} style={bgStyle}>
      <div className={`px-4 py-3 shrink-0 flex items-center gap-2 border-b ${bgStyle ? "border-white/10" : "border-border"}`}>
        <Eye className={`size-4 ${bgStyle ? "text-white/70" : "text-muted-foreground"}`} />
        <span className={`text-sm font-bold ${bgStyle ? "text-white" : "text-foreground"}`}>Player View</span>
        <div className="flex-1" />
        <button type="button" onClick={onClose} title="Close"
          className={`size-7 flex items-center justify-center rounded-lg transition-colors ${bgStyle ? "bg-white/10 hover:bg-white/20 text-white/70" : "bg-foreground/8 hover:bg-foreground/15 text-foreground/70"}`}>
          <X className="size-4" />
        </button>
      </div>

      <p className={`px-4 pt-3 text-[10px] shrink-0 ${bgStyle ? "text-white/50" : "text-foreground/40"}`}>
        {isLive ? "This is exactly what party members currently see in their own Shop panel." : "This shop isn't open to players yet — here's a preview of what they'd see if you open it."}
      </p>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 py-4">
        <div className="max-w-5xl mx-auto">
          <ShopFront shop={shop} wallets={wallets} defaultAccentColor={defaultAccentColor} />
        </div>
      </div>
    </div>,
    document.body,
  )
}
