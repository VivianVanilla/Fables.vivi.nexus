// ════════════════════════════════════════════════════════════════════════════
// PartyNotesCanvas.tsx — party-scoped wrapper around the shared NoteWebBoard.
// ════════════════════════════════════════════════════════════════════════════

import { NoteWebBoard } from "./NoteWebBoard"
import type { PartyMember } from "./partyTypes"

export function PartyNotesCanvas({
  partyCode, currentUserId, isDM, members, dmUserId, leftAccessory,
}: {
  partyCode: string
  currentUserId: string
  isDM: boolean
  members: PartyMember[]
  dmUserId?: string | null
  leftAccessory?: React.ReactNode
}) {
  function resolveOwnerName(ownerId: string) {
    if (ownerId === currentUserId) return "You"
    if (ownerId === dmUserId) return "Dungeon Master"
    return members.find(m => m.userId === ownerId)?.name ?? "Party member"
  }

  return (
    <NoteWebBoard
      boardKey={{ mode: "party", partyCode }}
      currentUserId={currentUserId}
      isDM={isDM}
      resolveOwnerName={resolveOwnerName}
      title="Party Notes"
      leftAccessory={leftAccessory}
    />
  )
}
