// ════════════════════════════════════════════════════════════════════════════
// wikilinks.ts — pulls the note names out of [[Name]] / [[Name|Label]]
// references in a note's content. Shared by anything that auto-links notes
// by content: the party board's dashed auto-connections and the personal
// Note Web's fully-automatic ones.
// ════════════════════════════════════════════════════════════════════════════

const WIKILINK_RE = /\[\[([^\]|]+?)(?:\|[^\]]+?)?\]\]/g

export function extractWikilinkNames(content: string): string[] {
  const names: string[] = []
  let m: RegExpExecArray | null
  WIKILINK_RE.lastIndex = 0
  while ((m = WIKILINK_RE.exec(content))) names.push(m[1].trim().toLowerCase())
  return names
}
