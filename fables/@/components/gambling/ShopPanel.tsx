// ════════════════════════════════════════════════════════════════════════════
// ShopPanel.tsx — spend tokens on cosmetic tags, app themes, and the 2048 unlock
// ════════════════════════════════════════════════════════════════════════════

import { useGamblingWallet } from "./useGamblingWallet"
import { TAGS, THEME_UNLOCKS, TWO048_COST } from "./gamblingTypes"

export function ShopPanel() {
  const {
    tokens, unlockedTagIds, equippedTagId, equipTag, buyTag,
    unlockedThemeIds, buyTheme, unlocked2048, buy2048,
  } = useGamblingWallet()

  return (
    <div className="flex flex-col gap-5 py-2">
      {/* Tags */}
      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-widest text-white/40 font-semibold">Tags</span>
        <div className="flex flex-col gap-1.5">
          {TAGS.map(tag => {
            const owned = unlockedTagIds.includes(tag.id)
            const equipped = equippedTagId === tag.id
            return (
              <div key={tag.id} className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2">
                <span className="text-lg shrink-0">{tag.emoji}</span>
                <span className="flex-1 text-sm text-white/80">{tag.label}</span>
                {!owned && <span className="text-xs text-white/40 shrink-0">{tag.cost} 🪙</span>}
                {owned ? (
                  <button type="button" onClick={() => equipTag(equipped ? null : tag.id)}
                    className={`text-[10px] px-2.5 py-1 rounded-full font-semibold transition-colors shrink-0 ${equipped ? "bg-primary/30 text-primary" : "bg-white/10 hover:bg-white/20 text-white/60 hover:text-white"}`}>
                    {equipped ? "Equipped" : "Equip"}
                  </button>
                ) : (
                  <button type="button" onClick={() => buyTag(tag.id, tag.cost)} disabled={tokens < tag.cost}
                    className="text-[10px] px-2.5 py-1 rounded-full font-semibold bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30 transition-colors disabled:opacity-30 shrink-0">
                    Buy
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Themes */}
      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-widest text-white/40 font-semibold">Trippy Themes</span>
        <p className="text-[10px] text-white/30 -mt-1">Unlocked themes become selectable in Profile Settings → App Theme.</p>
        <div className="flex flex-col gap-1.5">
          {THEME_UNLOCKS.map(theme => {
            const owned = unlockedThemeIds.includes(theme.id)
            return (
              <div key={theme.id} className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2">
                <span className="flex-1 text-sm text-white/80">{theme.label}</span>
                {owned ? (
                  <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 font-semibold shrink-0">Unlocked</span>
                ) : (
                  <>
                    <span className="text-xs text-white/40 shrink-0">{theme.cost} 🪙</span>
                    <button type="button" onClick={() => buyTheme(theme.id, theme.cost)} disabled={tokens < theme.cost}
                      className="text-[10px] px-2.5 py-1 rounded-full font-semibold bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30 transition-colors disabled:opacity-30 shrink-0">
                      Buy
                    </button>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 2048 unlock */}
      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-widest text-white/40 font-semibold">Mini-Game</span>
        <div className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2">
          <span className="flex-1 text-sm text-white/80">🔢 2048</span>
          {unlocked2048 ? (
            <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 font-semibold shrink-0">Unlocked</span>
          ) : (
            <>
              <span className="text-xs text-white/40 shrink-0">{TWO048_COST} 🪙</span>
              <button type="button" onClick={() => buy2048(TWO048_COST)} disabled={tokens < TWO048_COST}
                className="text-[10px] px-2.5 py-1 rounded-full font-semibold bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30 transition-colors disabled:opacity-30 shrink-0">
                Buy
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
