// ════════════════════════════════════════════════════════════════════════════
// collabColors.ts — deterministic per-person color assignment for live
// collaboration UI (note cursors, presence dots). Same seed (user id or
// email) always maps to the same color, so a given collaborator looks
// consistent across reloads and between the cursor overlay and header dots.
// ════════════════════════════════════════════════════════════════════════════

const PALETTE = [
  "#f97316", // orange
  "#22c55e", // green
  "#3b82f6", // blue
  "#ec4899", // pink
  "#eab308", // yellow
  "#a855f7", // purple
  "#14b8a6", // teal
  "#ef4444", // red
]

export function colorForId(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

export function nameForEmail(email: string): string {
  const local = email.split("@")[0] ?? email
  return local.charAt(0).toUpperCase() + local.slice(1)
}
