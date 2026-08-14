// ════════════════════════════════════════════════════════════════════════════
// monster-export.ts — turns MonsterData back into Markdown, the reverse
// direction of monster-import.ts's parser.
//
// Deliberately mirrors monster-import.ts's exact labels and entry-header
// format (`**Name.**`, `ACTIONS`/`LEGENDARY ACTIONS`/etc. section headers,
// `(Recharge N–6)`/`(Costs N Actions)` suffixes) so a monster exported here
// re-imports losslessly through that same parser.
// ════════════════════════════════════════════════════════════════════════════

import type { MonsterData, MonsterAction } from "./monster-types"

// ── Shared helpers ────────────────────────────────────────────────────────────

function abilityMod(score: number): string {
  const m = Math.floor((score - 10) / 2)
  return m >= 0 ? `+${m}` : `${m}`
}

function fmtAbility(score?: number): string {
  const s = score ?? 10
  return `${s} (${abilityMod(s)})`
}

function speedLine(data: MonsterData): string {
  const s = data.speeds ?? {}
  const parts: string[] = []
  parts.push(`${s.walk ?? 0} ft.`)
  if (s.burrow) parts.push(`burrow ${s.burrow} ft.`)
  if (s.climb) parts.push(`climb ${s.climb} ft.`)
  if (s.fly) parts.push(`fly ${s.fly} ft.${s.hover ? " (hover)" : ""}`)
  if (s.swim) parts.push(`swim ${s.swim} ft.`)
  const structured = parts.join(", ")
  if (structured && data.speed) return `${structured}, ${data.speed}`
  return structured || data.speed || "0 ft."
}

// Entry header, e.g. "Bite" -> "Bite.", "Wail (Recharge 5)" -> "Wail (Recharge 5–6).",
// "Cloth Tangle" with legendaryCost 2 -> "Cloth Tangle (Costs 2 Actions)."
function entryHeader(a: MonsterAction): string {
  let name = a.name || "Unnamed"
  if (a.recharge != null) name += ` (Recharge ${a.recharge}–6)`
  if (a.legendaryCost != null && a.legendaryCost > 1) name += ` (Costs ${a.legendaryCost} Actions)`
  return `${name}.`
}

// The description field already carries whatever prose was typed or
// imported ("_Melee Weapon Attack:_ +7 to hit…"), so it's the source of
// truth when present. Only when it's empty (an action built purely from the
// structured Attack/Save/Damage fields in the edit form, no prose typed) do
// we synthesize a minimal fallback line so nothing exports blank.
function entryBody(a: MonsterAction): string {
  if (a.description?.trim()) return a.description.trim()
  const parts: string[] = []
  if (a.attackBonus) parts.push(`_Attack:_ ${a.attackBonus} to hit.`)
  if (a.saveDC != null) parts.push(`_Save:_ DC ${a.saveDC}${a.saveAbility ? ` ${a.saveAbility}` : ""}.`)
  const dmg = a.multiDamage && a.damages?.length
    ? a.damages.map(d => `${d.damage}${d.damageType ? ` ${d.damageType}` : ""}`).join(" plus ")
    : a.damage ? `${a.damage}${a.damageType ? ` ${a.damageType}` : ""}` : ""
  if (dmg) parts.push(`_Damage:_ ${dmg}.`)
  return parts.join(" ")
}

function entryMarkdown(a: MonsterAction): string {
  const body = entryBody(a)
  return body ? `**${entryHeader(a)}** ${body}` : `**${entryHeader(a)}**`
}

const ACTION_SECTIONS: { key: keyof MonsterData; enabledKey: keyof MonsterData; label: string }[] = [
  { key: "bonusActions",     enabledKey: "hasBonusActions",     label: "BONUS ACTIONS" },
  { key: "reactions",        enabledKey: "hasReactions",        label: "REACTIONS" },
  { key: "legendaryActions", enabledKey: "hasLegendaryActions", label: "LEGENDARY ACTIONS" },
  { key: "lairActions",      enabledKey: "hasLairActions",      label: "LAIR ACTIONS" },
]

// ── Markdown export ───────────────────────────────────────────────────────────

export function monsterToMarkdown(name: string, data: MonsterData): string {
  const lines: string[] = []

  lines.push(`# ${name || "Unnamed Monster"}`)
  const typeLine = [data.creatureType, data.alignment].filter(Boolean).join(", ")
  if (typeLine) lines.push(`*${typeLine}*`)
  lines.push("")

  if (data.ac != null) lines.push(`**Armor Class** ${data.ac}`)
  const hp = data.maxHp ?? data.hp
  if (hp != null) lines.push(`**Hit Points** ${hp}${data.hitDice ? ` (${data.hitDice})` : ""}`)
  lines.push(`**Speed** ${speedLine(data)}`)
  lines.push("")

  lines.push("| STR | DEX | CON | INT | WIS | CHA |")
  lines.push("|-----|-----|-----|-----|-----|-----|")
  lines.push(`| ${fmtAbility(data.strength)} | ${fmtAbility(data.dexterity)} | ${fmtAbility(data.constitution)} | ${fmtAbility(data.intelligence)} | ${fmtAbility(data.wisdom)} | ${fmtAbility(data.charisma)} |`)
  lines.push("")

  const infoLines: [string, string | undefined][] = [
    ["Saving Throws", data.savingThrows],
    ["Skills", data.skills],
    ["Damage Vulnerabilities", data.damageVulnerabilities],
    ["Damage Resistances", data.damageResistances],
    ["Damage Immunities", data.damageImmunities],
    ["Condition Immunities", data.conditionImmunities],
    ["Senses", data.senses],
    ["Languages", data.languages],
    ["Challenge", data.challengeRating],
  ]
  for (const [label, value] of infoLines) if (value) lines.push(`**${label}** ${value}`)
  if (data.proficiencyBonus != null) lines.push(`**Proficiency Bonus** +${data.proficiencyBonus}`)
  lines.push("")

  const traitsEnabled = data.hasTraits ?? (data.traits ?? []).length > 0
  if (traitsEnabled) {
    for (const t of data.traits ?? []) {
      lines.push(entryMarkdown(t))
      lines.push("")
    }
  }

  lines.push("# **ACTIONS**")
  lines.push("")
  const multiEnabled = data.hasMultiattack ?? !!data.multiattackDescription
  if (multiEnabled && data.multiattackDescription) {
    lines.push(`**Multiattack.** ${data.multiattackDescription}`)
    lines.push("")
  }
  for (const a of data.actions ?? []) {
    lines.push(entryMarkdown(a))
    lines.push("")
  }

  for (const section of ACTION_SECTIONS) {
    const enabled = (data[section.enabledKey] as boolean | undefined) ?? ((data[section.key] as MonsterAction[] | undefined) ?? []).length > 0
    if (!enabled) continue
    const list = (data[section.key] as MonsterAction[] | undefined) ?? []
    lines.push(`# **${section.label}**`)
    lines.push("")
    for (const a of list) {
      lines.push(entryMarkdown(a))
      lines.push("")
    }
  }

  if (data.hasSpellcasting) {
    lines.push("# **SPELLCASTING**")
    lines.push("")
    const castLine = [
      data.spellcastingLevel,
      data.spellcastingAbility ? `(${data.spellcastingAbility})` : undefined,
      data.spellAttackBonus != null ? `spell attack +${data.spellAttackBonus}` : undefined,
      data.spellSaveDC != null ? `save DC ${data.spellSaveDC}` : undefined,
    ].filter(Boolean).join(", ")
    if (castLine) { lines.push(castLine); lines.push("") }
    for (const s of data.spellItems ?? []) {
      const lvl = s.level ? `${s.level}` : "Cantrip"
      lines.push(`- **${s.name || "Unnamed spell"}** (${lvl}${s.school ? `, ${s.school}` : ""})`)
    }
    lines.push("")
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n"
}

export async function copyMonsterMarkdown(name: string, data: MonsterData): Promise<void> {
  await navigator.clipboard.writeText(monsterToMarkdown(name, data))
}

export function downloadMonsterMarkdown(name: string, data: MonsterData) {
  const md = monsterToMarkdown(name, data)
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${(name || "monster").replace(/[^\w\- ]+/g, "").trim() || "monster"}.md`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
