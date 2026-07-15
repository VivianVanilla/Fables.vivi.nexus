// ════════════════════════════════════════════════════════════════════════════
// ShareCard.tsx — stylized chat-message rendering for a feature/spell/
// familiar a player sent for review. Read-only display — no in-chat action.
// ════════════════════════════════════════════════════════════════════════════

import type { FeatureBucket, SharePayload } from "./partyTypes"

const BUCKET_LABEL: Record<FeatureBucket, string> = {
  racialTraits: "Racial Trait",
  feats: "Feat",
  classFeatures: "Class Feature",
  items: "Item",
  invocations: "Invocation",
}

function kindLabel(payload: SharePayload) {
  if (payload.kind === "feature") return BUCKET_LABEL[payload.bucket ?? "items"]
  if (payload.kind === "spell") return "Spell"
  return "Familiar"
}

export function ShareCard({ payload }: { payload: SharePayload }) {
  const item = payload.item as Record<string, unknown>
  const name = typeof item.name === "string" ? item.name : "Unnamed"
  const description = typeof item.description === "string" ? item.description
    : typeof item.notes === "string" ? item.notes : ""

  return (
    <div className="rounded-xl border border-violet-400/30 bg-violet-500/10 overflow-hidden max-w-lg w-full">
      <div className="px-3 py-1.5 bg-violet-500/15">
        <span className="text-[9px] uppercase tracking-widest font-bold text-violet-300">{kindLabel(payload)}</span>
      </div>
      <div className="px-3 py-2">
        <p className="text-sm font-semibold text-foreground">{name}</p>
        {/* Capped and self-scrolling — a long backstory/notes field (a whole
            page of prose isn't unusual) would otherwise render at full,
            uncapped height inline in the message list. */}
        {description && (
          <p className="text-xs text-foreground/60 mt-1 whitespace-pre-wrap max-h-48 overflow-y-auto">{description}</p>
        )}
      </div>
    </div>
  )
}
