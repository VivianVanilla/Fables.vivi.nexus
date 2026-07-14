// ════════════════════════════════════════════════════════════════════════════
// monster-import.ts — best-effort parser turning pasted stat block text (the
// common layout used by Homebrewery, D&D Beyond exports, and the official
// books alike: name, then Armor Class/Hit Points/Speed lines, an ability
// score row, Saves/Skills/etc. lines, then unlabeled Traits followed by an
// ACTIONS/BONUS ACTIONS/REACTIONS/LEGENDARY ACTIONS header) into MonsterData.
//
// This is a plain line-by-line heuristic parser, not an LLM call: stat blocks
// are a de facto standard (every homebrew tool and every official book lays
// them out the same way), so matching known field labels plus a few
// structural cues — a short "Name." line followed by prose, an ALL-CAPS
// section header, a "DC 12 Dex" or "+5 to hit" phrase — covers the common
// case reliably, instantly, and without sending anyone's homebrew content to
// a third-party API. It won't get everything right on a weirdly-formatted
// paste — this is meant as a head start, not a guarantee, so always skim the
// result afterward.
// ════════════════════════════════════════════════════════════════════════════

import { nanoid } from "./character-utils"
import type { MonsterData, MonsterAction } from "./monster-types"
import type { DamageEntry } from "./character-types"

export interface ParsedMonster {
  name: string
  data: Partial<MonsterData>
}

type ActionSectionKey = "actions" | "bonusActions" | "reactions" | "legendaryActions" | "lairActions"

const SIZE_WORDS = ["fine", "diminutive", "tiny", "small", "medium", "large", "huge", "gargantuan", "colossal"]

const SECTION_ALIASES: Record<string, ActionSectionKey> = {
  "action": "actions", "actions": "actions",
  "bonus action": "bonusActions", "bonus actions": "bonusActions",
  "reaction": "reactions", "reactions": "reactions",
  "legendary action": "legendaryActions", "legendary actions": "legendaryActions",
  "lair action": "lairActions", "lair actions": "lairActions",
}

const DAMAGE_TYPE_WORDS = [
  "acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic",
  "piercing", "poison", "psychic", "radiant", "slashing", "thunder",
]

const ABILITY_ABBR_TO_KEY: Record<string, "strength" | "dexterity" | "constitution" | "intelligence" | "wisdom" | "charisma"> = {
  str: "strength", dex: "dexterity", con: "constitution", int: "intelligence", wis: "wisdom", cha: "charisma",
}

const ABILITY_FULL_TO_ABBR: Record<string, string> = {
  strength: "Str", dexterity: "Dex", constitution: "Con", intelligence: "Int", wisdom: "Wis", charisma: "Cha",
  str: "Str", dex: "Dex", con: "Con", int: "Int", wis: "Wis", cha: "Cha",
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Strips markdown wrapping (##, **, *, _) from a line so it can be matched by
// plain-text rules regardless of how a given source chose to style it.
//
// Bold/italic markers are stripped everywhere in the line, not just off each
// edge — the single most common stat block layout is "**Label** value"
// (bold wraps only the label, not the whole line), so the closing `**` sits
// in the *middle* of the line, not at the end. Asterisks/underscores never
// show up as literal content in a stat block, so a global strip is safe, and
// it also cleans up nested/mixed decoration in one pass ("###### **Name.**",
// "_**Name**_") instead of only handling one layer at a time.
function stripDecoration(line: string): string {
  let s = line.trim()
  s = s.replace(/^#{1,6}\s*/, "")
  s = s.replace(/\*{1,3}/g, "")
  s = s.replace(/_{1,3}/g, "")
  return s.trim()
}

function isRuleLine(line: string): boolean {
  return /^[\s\-_*]{3,}$/.test(line.trim())
}

function isTableRowLine(line: string): boolean {
  return line.trim().startsWith("|")
}

function isTableSeparatorRow(line: string): boolean {
  const t = line.trim()
  return t.includes("-") && /^\|?[\s:|-]+\|?$/.test(t)
}

function splitRow(line: string): string[] {
  return line.split("|").map(c => c.trim())
}

function matchLabel(line: string, label: string): string | null {
  const cleaned = stripDecoration(line)
  const m = cleaned.match(new RegExp(`^${label}\\s+(.+)$`, "i"))
  return m ? m[1].trim() : null
}

function looksLikeTypeLine(line: string): boolean {
  const cleaned = stripDecoration(line).toLowerCase()
  return SIZE_WORDS.some(w => cleaned.startsWith(w))
}

function matchSectionHeader(line: string): ActionSectionKey | null {
  const cleaned = stripDecoration(line).toLowerCase().replace(/[:.]+$/, "").trim()
  return SECTION_ALIASES[cleaned] ?? null
}

// ── Ability scores — markdown table first, then a plain-text fallback ───────

function extractAbilityScoresFromTable(lines: string[]) {
  for (let i = 0; i < lines.length - 1; i++) {
    if (!lines[i].includes("|")) continue
    const headerCells = splitRow(lines[i])
    const abilityCols: { idx: number; key: string }[] = []
    headerCells.forEach((c, idx) => {
      const k = c.toLowerCase()
      if (ABILITY_ABBR_TO_KEY[k]) abilityCols.push({ idx, key: k })
    })
    if (abilityCols.length < 3) continue

    let j = i + 1
    if (j < lines.length && isTableSeparatorRow(lines[j])) j++
    if (j >= lines.length || !lines[j].includes("|")) continue

    const valueCells = splitRow(lines[j])
    const result: Partial<Record<string, number>> = {}
    for (const { idx, key } of abilityCols) {
      const cell = valueCells[idx]
      const m = cell?.match(/-?\d+/)
      if (m) result[ABILITY_ABBR_TO_KEY[key]] = parseInt(m[0])
    }
    if (Object.keys(result).length >= 3) return result
  }
  return null
}

function extractAbilityScoresInline(text: string) {
  const result: Partial<Record<string, number>> = {}
  for (const abbr of Object.keys(ABILITY_ABBR_TO_KEY)) {
    const m = text.match(new RegExp(`\\b${abbr}\\b\\D{0,6}?(-?\\d{1,2})`, "i"))
    if (m) result[ABILITY_ABBR_TO_KEY[abbr]] = parseInt(m[1])
  }
  return Object.keys(result).length >= 3 ? result : null
}

// ── Trait/action entry header detection ──────────────────────────────────────
//
// An entry can start as a markdown heading ("###### Name."), a fully bold/
// italic line ("**Name.**", optionally with the rest of the sentence right
// after), a short line that's just "Name." on its own, or the classic inline
// "Name. Description starts right here." — all four show up across real
// pastes depending on the source.

interface EntryHeader {
  name: string
  rest?: string
  recharge?: number
  legendaryCost?: number
}

function cleanEntryName(raw: string): { name: string; recharge?: number; legendaryCost?: number } {
  let name = raw.trim()
  let recharge: number | undefined
  let legendaryCost: number | undefined

  const rechargeMatch = name.match(/\(recharge\s*(\d)(?:\s*[–-]\s*6)?\)/i)
  if (rechargeMatch) {
    recharge = parseInt(rechargeMatch[1])
    name = name.replace(rechargeMatch[0], "").trim()
  }
  const costMatch = name.match(/\(costs?\s*(\d+)\s*actions?\)/i)
  if (costMatch) {
    legendaryCost = parseInt(costMatch[1])
    name = name.replace(costMatch[0], "").trim()
  }

  return { name: name.replace(/\.$/, "").trim(), recharge, legendaryCost }
}

// A plain-text (non-heading, non-bold) line only counts as a *weak* signal —
// it also has to not look like ongoing prose, which rules out the two most
// common false positives: a "Label: details" continuation clause ("Hit:
// 12 (2d6) fire damage.", "Melee Weapon Attack: +5 to hit…" — excluded by
// requiring no colon before the period) and a plain description sentence
// ("The creature regains…", "If the target fails…" — excluded by starting
// with a common sentence-opener word). Without both guards, every short
// sentence that happens to sit alone on its own line reads as a new entry.
const SENTENCE_STARTER = /^(the|a|an|each|every|all|any|some|no|other|this|that|these|those|when|whenever|if|unless|while|during|as|until|before|after|at|on|in|it|its|it's|they|their|them|you|your|yours|he|his|she|her|creature|creatures|target|targets|whoever|whatever|half|one|two|three|four|five|six|first|second|then|instead|make|makes|roll|deals|regains)\b/i

function looksLikeSentenceNotName(candidate: string): boolean {
  return SENTENCE_STARTER.test(candidate.trim())
}

function looksLikeEntryHeader(line: string): boolean {
  if (/^#{1,6}\s+/.test(line)) return true
  if (/^(\*{1,3}|_{1,3}).+\1(\s+\S.*)?$/.test(line)) return true
  const m1 = line.match(/^([A-Z][^.:]{1,58})\.\s*$/)
  if (m1 && !looksLikeSentenceNotName(m1[1])) return true
  const m2 = line.match(/^([A-Z][^.:]{1,58})\.\s+\S/)
  if (m2 && !looksLikeSentenceNotName(m2[1])) return true
  return false
}

// Attack/description boilerplate that real stat blocks routinely wrap in its
// own emphasis mid-sentence ("_Melee Weapon Attack:_ +7 to hit…", "_Hit:_ 10
// (2d6) damage."). Those read exactly like a wrapped entry title — matching
// markers, short label — so without this guard every attack's own body text
// gets shredded into bogus "Melee Weapon Attack:" / "Hit:" sub-entries
// instead of staying part of the attack that owns them.
const INLINE_LABEL_RE = /^(melee|ranged)(\s+or\s+(melee|ranged))?\s+(weapon|spell)\s+attack:?$|^hit:?$/i

function parseEntryHeaderLine(line: string): EntryHeader | null {
  function finalize(rawName: string, rest?: string): EntryHeader | null {
    if (INLINE_LABEL_RE.test(rawName.trim())) return null
    const meta = cleanEntryName(rawName)
    return { name: meta.name, rest, recharge: meta.recharge, legendaryCost: meta.legendaryCost }
  }

  // Markdown heading — an explicit, deliberate signal from the source,
  // trusted regardless of wording. Its captured text can still carry its own
  // nested bold/italic ("###### **Name.**"), so strip that too.
  let m = line.match(/^#{1,6}\s+(.+?)\.?\s*$/)
  if (m) return finalize(stripDecoration(m[1]))

  // A fully bold/italic-wrapped line — same trust level as a heading.
  m = line.match(/^(\*{1,3}|_{1,3})(.+?)\.?\1(\s+(\S.*))?$/)
  if (m) return finalize(m[2], m[4]?.trim())

  // Plain text — weaker signal, gated by the two guards above.
  m = line.match(/^([A-Z][^.:]{1,58})\.\s*$/)
  if (m && !looksLikeSentenceNotName(m[1])) return finalize(m[1])

  m = line.match(/^([A-Z][^.:]{1,58})\.\s+(\S.*)$/)
  if (m && !looksLikeSentenceNotName(m[1])) return finalize(m[1], m[2].trim())

  return null
}

// ── Attack bonus / save / damage extraction from an entry's own prose ───────

function buildAction(name: string, description: string, recharge?: number, legendaryCost?: number): MonsterAction {
  const action: MonsterAction = { id: nanoid(), name, description }
  if (recharge != null) { action.recharge = recharge; action.rechargeUsed = false }
  if (legendaryCost != null) action.legendaryCost = legendaryCost

  // Extraction runs against a decoration-stripped copy so inline markdown
  // ("_Melee Weapon Attack:_ +15 to hit…") can't land a marker right between
  // a label and the value it's matching against — `description` itself keeps
  // its original markdown, since it's rendered through the Markdown component.
  const plain = description.replace(/[*_#]+/g, "")

  const atk = plain.match(/(?:Melee|Ranged)(?:\s+or\s+Ranged)?\s+(?:Weapon|Spell)\s+Attack:?\s*([+-]?\d+)\s+to hit/i)
  if (atk) action.attackBonus = /^[+-]/.test(atk[1]) ? atk[1] : `+${atk[1]}`

  const save = plain.match(/DC\s*(\d+)\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma|Str|Dex|Con|Int|Wis|Cha)\b/i)
  if (save) {
    action.saveDC = parseInt(save[1])
    action.saveAbility = ABILITY_FULL_TO_ABBR[save[2].toLowerCase()] ?? cap(save[2].toLowerCase())
  }

  const dmgRe = new RegExp(`\\(([\\d\\s+dD-]+)\\)\\s+(${DAMAGE_TYPE_WORDS.join("|")})(?:\\s+damage)?`, "gi")
  const dmgMatches = [...plain.matchAll(dmgRe)]
  if (dmgMatches.length === 1) {
    action.damage = dmgMatches[0][1].replace(/\s+/g, "")
    action.damageType = cap(dmgMatches[0][2].toLowerCase())
  } else if (dmgMatches.length > 1) {
    const entries: DamageEntry[] = dmgMatches.map(m => ({
      id: nanoid(), damage: m[1].replace(/\s+/g, ""), damageType: cap(m[2].toLowerCase()),
    }))
    action.multiDamage = true
    action.damages = entries
    action.damage = entries[0].damage
    action.damageType = entries[0].damageType
  }

  return action
}

// ── Main entry point ─────────────────────────────────────────────────────────

export function parseMonsterStatBlock(raw: string): ParsedMonster {
  const lines = raw.replace(/\r\n/g, "\n").split("\n").map(l => l.trimEnd())
  const data: Partial<MonsterData> = {}
  let name = "Imported Monster"

  // Ability scores are extracted up front from the header region (before
  // Saving Throws / Challenge / ACTIONS) so table rows don't need to be
  // re-detected while walking line by line below.
  const headerEndIdx = lines.findIndex(l => /Saving Throws|Challenge\s|^ACTIONS?\b/i.test(stripDecoration(l)))
  const headerLines = headerEndIdx >= 0 ? lines.slice(0, headerEndIdx) : lines
  const scores = extractAbilityScoresFromTable(headerLines) ?? extractAbilityScoresInline(headerLines.join("\n"))
  if (scores) Object.assign(data, scores)

  let i = 0
  const skipBlank = () => { while (i < lines.length && lines[i].trim() === "") i++ }

  skipBlank()
  if (i < lines.length) { name = stripDecoration(lines[i]) || name; i++ }
  skipBlank()

  if (i < lines.length && looksLikeTypeLine(lines[i])) {
    const cleaned = stripDecoration(lines[i])
    const commaIdx = cleaned.indexOf(",")
    if (commaIdx >= 0) {
      data.creatureType = cleaned.slice(0, commaIdx).trim()
      data.alignment = cleaned.slice(commaIdx + 1).trim()
    } else {
      data.creatureType = cleaned
    }
    i++
  }

  type Section = "core" | "traits" | ActionSectionKey
  let section: Section = "core"

  const traits: MonsterAction[] = []
  const byKey: Record<ActionSectionKey, MonsterAction[]> = { actions: [], bonusActions: [], reactions: [], legendaryActions: [], lairActions: [] }

  let currentName: string | null = null
  let currentRest: string[] = []
  let currentRecharge: number | undefined
  let currentCost: number | undefined

  function pushCurrent() {
    if (currentName == null) return
    const description = currentRest.join("\n").trim()
    if (section === "traits") {
      traits.push({ id: nanoid(), name: currentName, description })
    } else if (/^multiattack$/i.test(currentName)) {
      data.hasMultiattack = true
      data.multiattackDescription = description
    } else {
      const key = (section === "core" ? "actions" : section) as ActionSectionKey
      byKey[key].push(buildAction(currentName, description, currentRecharge, currentCost))
    }
    currentName = null
    currentRest = []
    currentRecharge = undefined
    currentCost = undefined
  }

  while (i < lines.length) {
    const line = lines[i].trim()
    i++
    if (line === "" || isRuleLine(line) || isTableRowLine(line)) continue

    const sectionKey = matchSectionHeader(line)
    if (sectionKey) { pushCurrent(); section = sectionKey; continue }
    if (/^traits?$/i.test(stripDecoration(line))) { pushCurrent(); section = "traits"; continue }

    if (section === "core") {
      const ac = matchLabel(line, "Armor Class")
      if (ac != null) { const n = ac.match(/\d+/); if (n) data.ac = parseInt(n[0]); continue }

      const hp = matchLabel(line, "Hit Points")
      if (hp != null) {
        const n = hp.match(/\d+/); if (n) { data.maxHp = parseInt(n[0]); data.hp = parseInt(n[0]) }
        const dice = hp.match(/\(([^)]+)\)/); if (dice) data.hitDice = dice[1].replace(/\s+/g, "")
        continue
      }

      const speed = matchLabel(line, "Speed")
      if (speed != null) {
        const speeds: NonNullable<MonsterData["speeds"]> = {}
        const walk = speed.match(/^(\d+)\s*ft/i)
        if (walk) speeds.walk = parseInt(walk[1])
        for (const t of ["burrow", "climb", "fly", "swim", "hover"] as const) {
          const m = speed.match(new RegExp(`${t}\\s+(\\d+)\\s*ft`, "i"))
          if (m) speeds[t] = parseInt(m[1])
        }
        if (Object.keys(speeds).length) data.speeds = speeds
        else data.speed = speed
        continue
      }

      const saves = matchLabel(line, "Saving Throws"); if (saves != null) { data.savingThrows = saves; continue }
      const skills = matchLabel(line, "Skills"); if (skills != null) { data.skills = skills; continue }
      const dr = matchLabel(line, "Damage Resistances"); if (dr != null) { data.damageResistances = dr; continue }
      const di = matchLabel(line, "Damage Immunities"); if (di != null) { data.damageImmunities = di; continue }
      const dv = matchLabel(line, "Damage Vulnerabilities"); if (dv != null) { data.damageVulnerabilities = dv; continue }
      const ci = matchLabel(line, "Condition Immunities"); if (ci != null) { data.conditionImmunities = ci; continue }
      const senses = matchLabel(line, "Senses"); if (senses != null) { data.senses = senses; continue }
      const langs = matchLabel(line, "Languages"); if (langs != null) { data.languages = langs; continue }
      const cr = matchLabel(line, "Challenge"); if (cr != null) { data.challengeRating = cr; continue }
      const pb = matchLabel(line, "Proficiency Bonus")
      if (pb != null) { const n = pb.match(/\d+/); if (n) data.proficiencyBonus = parseInt(n[0]); continue }

      // No explicit "Traits" label in most stat blocks — the first thing that
      // looks like an entry header after the core fields quietly starts it.
      if (looksLikeEntryHeader(line)) {
        section = "traits"
      } else {
        continue
      }
    }

    const header = parseEntryHeaderLine(line)
    if (header) {
      pushCurrent()
      currentName = header.name
      currentRest = header.rest ? [header.rest] : []
      currentRecharge = header.recharge
      currentCost = header.legendaryCost
    } else if (currentName != null) {
      currentRest.push(line)
    }
  }
  pushCurrent()

  data.traits = traits
  data.hasTraits = traits.length > 0
  data.actions = byKey.actions
  data.bonusActions = byKey.bonusActions
  data.hasBonusActions = byKey.bonusActions.length > 0
  data.reactions = byKey.reactions
  data.hasReactions = byKey.reactions.length > 0
  data.legendaryActions = byKey.legendaryActions
  data.hasLegendaryActions = byKey.legendaryActions.length > 0
  data.lairActions = byKey.lairActions
  data.hasLairActions = byKey.lairActions.length > 0

  return { name, data }
}
