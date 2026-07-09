// ════════════════════════════════════════════════════════════════════════════
// spelldleLogic.ts — daily D&D spell guessing game, Loldle/onepiecedle-style
//
// One spell is picked deterministically each day (same seeded-PRNG approach
// as the old sudoku easter egg) from the site's live spell list. Each guess
// must be a real spell (picked via autocomplete, like the old letter-based
// version) — instead of scoring individual letters, each guess is compared
// attribute-by-attribute (level, school, class list, damage type, save)
// against the target, Wordle-colored per attribute: green = exact match,
// yellow = close/partial, gray = no match. Winning means guessing the actual
// spell name; the attribute grid is a hint trail, not the win condition
// (two different spells can tie on every attribute shown).
// ════════════════════════════════════════════════════════════════════════════

import { getSpells } from "../../../src/spells/spellCache"
import type { Spell } from "../../../src/spells/types"

export type CellStatus = "correct" | "close" | "absent"
export type AttrKey = "level" | "school" | "classes" | "damageType" | "saveAttr"

export interface AttributeResult {
  key: AttrKey
  label: string
  value: string           // display value for the guessed spell's attribute
  status: CellStatus
  hint?: "higher" | "lower"  // level only — points toward the target
}

export interface GuessResult {
  spellName: string
  results: AttributeResult[]
}

export interface SpellAttributes {
  level: number
  school: string
  classes: string[]
  damageType: string  // "None" when the spell deals no damage
  saveAttr: string    // "None" when the spell doesn't call for a save
}

export interface SpelldleSave {
  seed: string
  target: string             // the real spell name, e.g. "Cure Wounds"
  targetAttrs: SpellAttributes
  guesses: GuessResult[]
  won: boolean
  lost: boolean
}

const STORAGE_KEY = "fables-spelldle"
export const MAX_GUESSES = 6

const ATTR_LABELS: Record<AttrKey, string> = {
  level: "Level", school: "School", classes: "Class", damageType: "Damage", saveAttr: "Save",
}

// ── Seeded PRNG (mulberry32) — deterministic per day ─────────────────────────

function mulberry32(seed: number) {
  let s = seed | 0
  return function rand() {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seedToNumber(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}

export function getDailySeed(): string {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`
}

// ── Spell list access (cached by spellCache — cheap to call repeatedly) ─────

export async function getAllSpells(): Promise<Spell[]> {
  const spells = await getSpells()
  const seen = new Set<string>()
  return spells.filter(s => {
    if (!s?.name || seen.has(s.name.toLowerCase())) return false
    seen.add(s.name.toLowerCase())
    return true
  })
}

export function toAttrs(spell: Spell): SpellAttributes {
  return {
    level: spell.level ?? 0,
    school: spell.school?.name ?? "Unknown",
    classes: (spell.classes ?? []).map(c => c.name).sort(),
    damageType: spell.damageType || "None",
    saveAttr: spell.saveAttr || "None",
  }
}

const FALLBACK_TARGET = "Fireball"

function pickDailySpell(seed: string, spells: Spell[]): Spell {
  const rand = mulberry32(seedToNumber(seed))
  if (spells.length === 0) return { name: FALLBACK_TARGET, level: 3, school: { name: "Evocation" }, classes: [], components: [], casting_time: "", range: "", duration: "", materialComponents: false, materials: "", damageType: "Fire", ctag: "", ritual: false, desc: "", index: "fireball" } as Spell
  return spells[Math.floor(rand() * spells.length)]
}

// ── Scoring — attribute-by-attribute comparison, Wordle-colored ─────────────

export function scoreGuess(guess: Spell, target: SpellAttributes): AttributeResult[] {
  const g = toAttrs(guess)
  const results: AttributeResult[] = []

  const levelStatus: CellStatus = g.level === target.level ? "correct" : Math.abs(g.level - target.level) <= 1 ? "close" : "absent"
  results.push({
    key: "level", label: ATTR_LABELS.level, value: String(g.level), status: levelStatus,
    hint: g.level === target.level ? undefined : g.level < target.level ? "higher" : "lower",
  })

  results.push({
    key: "school", label: ATTR_LABELS.school, value: g.school,
    status: g.school === target.school ? "correct" : "absent",
  })

  const overlap = g.classes.filter(c => target.classes.includes(c))
  const sameSet = overlap.length === g.classes.length && overlap.length === target.classes.length && g.classes.length > 0
  const classesStatus: CellStatus = sameSet ? "correct" : overlap.length > 0 ? "close" : "absent"
  results.push({
    key: "classes", label: ATTR_LABELS.classes, value: g.classes.join(", ") || "—",
    status: classesStatus,
  })

  results.push({
    key: "damageType", label: ATTR_LABELS.damageType, value: g.damageType,
    status: g.damageType === target.damageType ? "correct" : "absent",
  })

  results.push({
    key: "saveAttr", label: ATTR_LABELS.saveAttr, value: g.saveAttr,
    status: g.saveAttr === target.saveAttr ? "correct" : "absent",
  })

  return results
}

// ── Save/load ─────────────────────────────────────────────────────────────

async function generatePuzzle(seed: string): Promise<SpelldleSave> {
  const spells = await getAllSpells()
  const target = pickDailySpell(seed, spells)
  return { seed, target: target.name, targetAttrs: toAttrs(target), guesses: [], won: false, lost: false }
}

export async function loadOrCreateSave(): Promise<SpelldleSave> {
  const seed = getDailySeed()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as SpelldleSave
      if (parsed.seed === seed && parsed.targetAttrs) return parsed
    }
  } catch { /* corrupt/missing save — fall through and generate fresh */ }
  const fresh = await generatePuzzle(seed)
  saveSpelldle(fresh)
  return fresh
}

export function saveSpelldle(save: SpelldleSave) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(save)) }
  catch (e) { console.error("Failed to save spelldle progress:", e) }
}
