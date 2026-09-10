// ════════════════════════════════════════════════════════════════════════════
// adminAccess.ts — who counts as an app administrator.
//
// A hardcoded email allowlist, not a DB role: this is a small app with a
// fixed circle of trusted editors, and a real roles table would be more
// moving parts than it's worth. Admins get, in one place:
//   • homebrew / campaign spell content unlocked everywhere (useHomebrewFilter)
//   • the "Administrator" badge in Profile Settings
//   • Admin Mode in the docs (src/Documentation.tsx)
//
// To add someone, add their sign-in email here. `doc-types.ts` re-exports
// these so its long-standing `ADMIN_EMAILS` import path still works.
// ════════════════════════════════════════════════════════════════════════════

export const ADMIN_EMAILS = [
  "liamlillico06@gmail.com",
  "spaghettiloverjake@gmail.com",
  "vivian.bonilla@outlook.com",
  "loganadsit@gmail.com",
  "emeraldspiders@gmail.com",
]

export function isAdminEmail(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email)
}
