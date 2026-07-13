// Spell-related pure helpers shared between SpellEntry (autofill-while-typing),
// ClassPickerModal (class spell list previews), and the monster sheet's
// spell-picker menu — kept out of any component file so none of them drag a
// Fast Refresh boundary along with a plain-function import.

import type { SpellItem } from "./character-types"
import type { Spell } from "../../src/spells/types"

const SAVE_NAMES: Record<string, string> = {
  strength: "STR", dexterity: "DEX", constitution: "CON",
  intelligence: "INT", wisdom: "WIS", charisma: "CHA",
}

// Extracts save/damage/attack-roll info from a spell's prose description —
// spells in the SRD data don't carry these as structured fields.
export function parseSpellCombat(desc: string | string[]): { damage?: string; saveAttr?: string; attackRoll?: boolean } {
  const text = (Array.isArray(desc) ? desc.join(" ") : desc).toLowerCase()

  const attackRoll = /(?:ranged|melee)\s+spell\s+attack|spell\s+attack\s+roll/.test(text) || undefined

  let saveAttr: string | undefined
  const saveMatch = text.match(/\b(strength|dexterity|constitution|intelligence|wisdom|charisma)\s+saving\s+throw/)
  if (saveMatch) saveAttr = SAVE_NAMES[saveMatch[1]]

  let damage: string | undefined
  // Match patterns like "2d6", "10d10", "1d4 + 2d6", capturing the first dice expression near a damage type
  const dmgPattern = /(\d+d\d+(?:\s*[+]\s*\d+d\d+)?(?:\s*[+]\s*\d+)?)\s+(?:acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder|sickness)/
  const dmgMatch = (Array.isArray(desc) ? desc.join(" ") : desc).match(dmgPattern)
  if (dmgMatch) damage = dmgMatch[1].replace(/\s+/g, "")

  return { damage, saveAttr, attackRoll: attackRoll ?? undefined }
}

// Builds a SpellItem's fields from a database Spell record — shared by the
// character sheet's autofill-while-typing (SpellNameInput, inside SpellEntry)
// and the monster sheet's spell-picker menu, so picking a spell from the SRD
// list always fills in the same fields the same way.
export function spellItemFieldsFromSpell(s: Spell): Omit<SpellItem, "id"> {
  const parsed = parseSpellCombat(s.desc ?? "")
  const dur = s.duration ?? ""
  return {
    name: s.name,
    level: s.level,
    school: s.school?.name ?? "",
    castTime: s.casting_time ?? "",
    range: s.range ?? "",
    duration: dur,
    components: s.components?.join(", ") ?? "",
    materialComponents: s.materialComponents ? (s.materials ?? "") : "",
    ritual: s.ritual ?? false,
    concentration: dur.toLowerCase().includes("concentration"),
    damage: s.damage ?? parsed.damage ?? "",
    damageType: s.damageType !== "None" ? s.damageType : "",
    saveAttr: s.saveAttr ?? parsed.saveAttr ?? "",
    notes: Array.isArray(s.desc) ? s.desc.join("\n\n") : (s.desc ?? ""),
  }
}
