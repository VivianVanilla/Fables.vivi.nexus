// ════════════════════════════════════════════════════════════════════════════
// spelldleLogic.ts — Wordle, but the answer is today's D&D spell
//
// One spell is picked deterministically each day (same seeded-PRNG approach
// as the old sudoku easter egg) from the site's live spell list. Guesses are
// scored letter-by-letter (spaces/punctuation stripped, like "Cure Wounds" ->
// "CUREWOUNDS") using the standard two-pass Wordle algorithm so duplicate
// letters are handled correctly.
// ════════════════════════════════════════════════════════════════════════════

import { getSpells } from "../../../src/spells/spellCache"

export type LetterStatus = "correct" | "present" | "absent"

export interface GuessResult {
  guess: string
  statuses: LetterStatus[]
}

export interface SpelldleSave {
  seed: string
  target: string          // the real spell name, e.g. "Cure Wounds"
  targetLetters: string   // uppercase, letters-only, e.g. "CUREWOUNDS"
  guesses: GuessResult[]
  won: boolean
  lost: boolean
}

const STORAGE_KEY = "fables-spelldle"
export const MAX_GUESSES = 6

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

export function lettersOnly(name: string): string {
  return name.toUpperCase().replace(/[^A-Z]/g, "")
}

// ── Spell list access (cached by spellCache — cheap to call repeatedly) ─────

export async function getAllSpellNames(): Promise<string[]> {
  const spells = await getSpells()
  return Array.from(new Set(spells.map(s => s.name).filter(Boolean)))
}

const FALLBACK_TARGET = "Fireball"

function pickDailyTarget(seed: string, names: string[]): string {
  const rand = mulberry32(seedToNumber(seed))
  const eligible = names.filter(n => lettersOnly(n).length >= 4)
  const pool = eligible.length > 0 ? eligible : names
  if (pool.length === 0) return FALLBACK_TARGET
  return pool[Math.floor(rand() * pool.length)]
}

// ── Scoring — standard two-pass Wordle algorithm (handles duplicate letters) ─

export function scoreGuess(guess: string, target: string): LetterStatus[] {
  const g = lettersOnly(guess).split("")
  const t = lettersOnly(target).split("")
  const statuses: LetterStatus[] = new Array(g.length).fill("absent")
  const remaining: Record<string, number> = {}

  for (let i = 0; i < g.length; i++) {
    if (t[i] === g[i]) statuses[i] = "correct"
    else remaining[t[i]] = (remaining[t[i]] ?? 0) + 1
  }
  for (let i = 0; i < g.length; i++) {
    if (statuses[i] === "correct") continue
    const ch = g[i]
    if (remaining[ch] > 0) { statuses[i] = "present"; remaining[ch]-- }
  }
  return statuses
}

// ── Save/load ─────────────────────────────────────────────────────────────

async function generatePuzzle(seed: string): Promise<SpelldleSave> {
  const names = await getAllSpellNames()
  const target = pickDailyTarget(seed, names)
  return { seed, target, targetLetters: lettersOnly(target), guesses: [], won: false, lost: false }
}

export async function loadOrCreateSave(): Promise<SpelldleSave> {
  const seed = getDailySeed()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as SpelldleSave
      if (parsed.seed === seed) return parsed
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
