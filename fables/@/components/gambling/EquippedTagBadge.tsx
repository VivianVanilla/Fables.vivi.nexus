// ════════════════════════════════════════════════════════════════════════════
// EquippedTagBadge.tsx — shows the user's equipped gamVIVIling tag, rendered
// next to the sidebar toggle in the app header. Renders nothing if none
// equipped or the user has never touched the gambling wallet.
// ════════════════════════════════════════════════════════════════════════════

import { useGamblingWallet } from "./useGamblingWallet"
import { TAGS } from "./gamblingTypes"

export function EquippedTagBadge() {
  const { equippedTagId } = useGamblingWallet()
  const tag = TAGS.find(t => t.id === equippedTagId)
  if (!tag) return null

  return (
    <span
      title={tag.label}
      className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary shrink-0"
    >
      <span>{tag.emoji}</span>
      <span className="hidden sm:inline">{tag.label}</span>
    </span>
  )
}
