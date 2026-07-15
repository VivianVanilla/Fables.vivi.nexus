// ════════════════════════════════════════════════════════════════════════════
// ObjectContent.tsx — renders whatever a tab points at (character sheet,
// campaign, note, monster, or a raw-JSON fallback for anything else). Used
// identically by every pane, so opening the same object in two panes at
// once behaves exactly like opening it in one.
// ════════════════════════════════════════════════════════════════════════════

import type { SidebarObject } from "@/components/sidebar-utils"
import { CharacterSheet } from "@/components/character"
import { CampaignView } from "@/components/campaign-view"
import { NoteView } from "@/components/NoteView"
import { MonsterSheet } from "@/components/monster"

export function ObjectContent({ object }: { object: SidebarObject }) {
  if (object.type === "character") {
    return <CharacterSheet key={object.id} character={object} />
  }
  if (object.type === "campaign") {
    return <CampaignView key={object.id} campaign={object} />
  }
  if (object.type === "note") {
    return <NoteView key={object.id} note={object} />
  }
  if (object.type === "monster") {
    return <MonsterSheet key={object.id} monster={object} />
  }
  return (
    <div className="h-full min-h-0 overflow-auto p-4">
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Raw JSON — {object.name}
      </span>
      <pre className="mt-2 rounded-lg bg-slate-900 p-4 text-xs text-green-400 whitespace-pre-wrap wrap-break-word">
        {JSON.stringify(object, null, 2)}
      </pre>
    </div>
  )
}
