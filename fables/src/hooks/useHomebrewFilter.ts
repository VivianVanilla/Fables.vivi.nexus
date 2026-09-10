// ════════════════════════════════════════════════════════════════════════════
// useHomebrewFilter — whether homebrew / campaign spell content (Squain,
// Twilight; see HOMEBREW_TAGS) should be hidden for the current user.
//
// It's hidden for everyone by default and auto-unlocked only for
// administrators (isAdminEmail). There's no manual toggle anymore — Profile
// Settings shows an "Administrator" badge instead. Consumed by SpellBrowser,
// SpellSearch, and the character-sheet spell/class pickers.
// ════════════════════════════════════════════════════════════════════════════

import { useUser } from "../contexts/UserContext"
import { isAdminEmail } from "@/components/shared/adminAccess"

/** True for administrators — they see homebrew / campaign content everywhere. */
export function useIsAdmin(): boolean {
  const user = useUser()
  return isAdminEmail(user?.email)
}

/** True when homebrew / campaign spells should be filtered out for this user. */
export function useHomebrewFilter(): boolean {
  return !useIsAdmin()
}
